import { exec } from "node:child_process";
import { promisify } from "node:util";

import type {
  StartupDetail,
  StartupDetailResponse,
  StartupListResponse,
  StartupQuery,
} from "./types.js";

const execAsync = promisify(exec);
const DEFAULT_BASE_URL = "https://trustmrr.com/api/v1";
const DEFAULT_MIN_INTERVAL_MS = 500;
const DEFAULT_ALL_STARTUPS_CACHE_TTL_MS = 5 * 60_000;
const DEFAULT_STARTUP_SCAN_LIMIT = 200;
const MAX_STARTUPS_PAGE_SIZE = 50;
const MAX_RATE_LIMIT_RETRIES = 2;

export interface StartupScanResult {
  data: StartupDetail[];
  total: number;
  isPartial: boolean;
}

export class TrustMrrError extends Error {
  public readonly status: number;
  public readonly body: unknown;

  public constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "TrustMrrError";
    this.status = status;
    this.body = body;
  }
}

export interface TrustMrrClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
  keychainLookup?: () => Promise<string>;
  minIntervalMs?: number;
  allStartupsCacheTtlMs?: number;
  sleep?: (ms: number) => Promise<void>;
  writeStderr?: (value: string) => void;
}

export class TrustMrrClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly keychainLookup: () => Promise<string>;
  private readonly minIntervalMs: number;
  private readonly allStartupsCacheTtlMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly writeStderr: (value: string) => void;
  private apiKey?: string;
  private nextRequestAt = 0;
  private allStartupsCache?: {
    data: StartupDetail[];
    expiresAt: number;
  };
  private allStartupsRequest?: Promise<StartupDetail[]>;

  public constructor(options: TrustMrrClientOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchFn = options.fetchFn ?? fetch;
    this.keychainLookup = options.keychainLookup ?? lookupApiKeyFromKeychain;
    this.minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
    this.allStartupsCacheTtlMs =
      options.allStartupsCacheTtlMs ?? DEFAULT_ALL_STARTUPS_CACHE_TTL_MS;
    this.sleep =
      options.sleep ??
      ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.writeStderr = options.writeStderr ?? (() => undefined);
  }

  public async listStartups(query: StartupQuery = {}): Promise<StartupListResponse> {
    return this.request<StartupListResponse>("/startups", query);
  }

  public async getStartup(slug: string): Promise<StartupDetailResponse> {
    return this.request<StartupDetailResponse>(`/startups/${encodeURIComponent(slug)}`);
  }

  public async getCountries(): Promise<string[]> {
    const startups = await this.getAllStartups();
    return uniqueValues(startups.map((startup) => startup.country));
  }

  public async getCategories(): Promise<string[]> {
    const startups = await this.getAllStartups();
    return uniqueValues(startups.map((startup) => startup.category));
  }

  public async getAllStartups(pageSize = MAX_STARTUPS_PAGE_SIZE): Promise<StartupDetail[]> {
    const now = Date.now();
    if (this.allStartupsCache && this.allStartupsCache.expiresAt > now) {
      return this.allStartupsCache.data;
    }

    if (this.allStartupsRequest) {
      return this.allStartupsRequest;
    }

    this.allStartupsRequest = this.fetchAllStartups({ pageSize })
      .then(({ data }) => {
        this.allStartupsCache = {
          data,
          expiresAt: Date.now() + this.allStartupsCacheTtlMs,
        };
        return data;
      })
      .finally(() => {
        this.allStartupsRequest = undefined;
      });

    return this.allStartupsRequest;
  }

  public async scanStartups(maxItems = DEFAULT_STARTUP_SCAN_LIMIT): Promise<StartupScanResult> {
    const { data, total } = await this.fetchAllStartups({
      maxItems,
      query: {
        sort: "mrr",
        order: "desc",
      },
    });

    return {
      data,
      total,
      isPartial: data.length < total,
    };
  }

  private async fetchAllStartups(options: {
    pageSize?: number;
    maxItems?: number;
    query?: Omit<StartupQuery, "limit" | "page">;
  } = {}): Promise<{ data: StartupDetail[]; total: number }> {
    const pageSize = clampPageSize(options.pageSize ?? MAX_STARTUPS_PAGE_SIZE);
    const maxItems = options.maxItems ?? Number.POSITIVE_INFINITY;
    const query = options.query ?? {};
    const all: StartupDetail[] = [];
    let page = 1;
    let total = 0;

    while (true) {
      const remaining = Number.isFinite(maxItems) ? maxItems - all.length : pageSize;
      if (remaining <= 0) {
        break;
      }

      const response = await this.listStartups({
        ...query,
        limit: Math.min(pageSize, remaining),
        page,
      });
      total = response.meta.total;
      all.push(...response.data.map(asDetailLike));

      if (!response.meta.hasMore || response.data.length === 0) {
        break;
      }

      page += 1;
    }

    return { data: all, total };
  }

  private async request<T>(path: string, query: StartupQuery = {}): Promise<T> {
    const apiKey = await this.resolveApiKey();
    const base = this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`;
    const url = new URL(path.startsWith("/") ? path.slice(1) : path, base);

    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }

      url.searchParams.set(key, String(value));
    }

    for (let attempt = 0; ; attempt += 1) {
      await this.waitForRateLimit();

      const response = await this.fetchFn(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      });

      const body = await parseResponseBody(response);
      if (response.ok) {
        return body as T;
      }

      if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
        const waitMs = getRateLimitRetryDelayMs(response.headers.get("X-RateLimit-Reset"));
        const waitSeconds = Math.max(0, Math.ceil(waitMs / 1000));
        this.writeStderr(`Rate limited, waiting ${waitSeconds}s...\n`);

        if (waitMs > 0) {
          await this.sleep(waitMs);
        }

        this.nextRequestAt = 0;
        continue;
      }

      throw this.createError(response.status, body);
    }
  }

  private async resolveApiKey(): Promise<string> {
    if (this.apiKey) {
      return this.apiKey;
    }

    const envValue = process.env.TRUSTMRR_API_KEY?.trim();
    if (envValue) {
      this.apiKey = envValue;
      return envValue;
    }

    this.apiKey = (await this.keychainLookup()).trim();
    if (!this.apiKey) {
      throw new Error("TrustMRR API key is empty.");
    }

    return this.apiKey;
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const waitMs = Math.max(0, this.nextRequestAt - now);

    if (waitMs > 0) {
      await this.sleep(waitMs);
    }

    this.nextRequestAt = Date.now() + this.minIntervalMs;
  }

  private createError(status: number, body: unknown): TrustMrrError {
    if (status === 401) {
      return new TrustMrrError(
        "Unauthorized. Set TRUSTMRR_API_KEY or store it in the macOS keychain.",
        status,
        body,
      );
    }

    if (status === 404) {
      return new TrustMrrError("Resource not found.", status, body);
    }

    if (status === 429) {
      return new TrustMrrError("Rate limit exceeded. Retry shortly.", status, body);
    }

    return new TrustMrrError(`TrustMRR API request failed with status ${status}.`, status, body);
  }
}

export async function lookupApiKeyFromKeychain(): Promise<string> {
  const { stdout } = await execAsync(
    "security find-generic-password -s trustmrr -a api-key -w",
  );
  return stdout.trim();
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function uniqueValues(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
    .map((value) => value.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

function asDetailLike(startup: StartupListResponse["data"][number]): StartupDetail {
  return {
    ...startup,
    xFollowerCount: null,
    isMerchantOfRecord: null,
    techStack: [],
    cofounders: [],
  };
}

function clampPageSize(pageSize: number): number {
  if (!Number.isFinite(pageSize) || pageSize <= 0) {
    return MAX_STARTUPS_PAGE_SIZE;
  }

  return Math.min(Math.trunc(pageSize), MAX_STARTUPS_PAGE_SIZE);
}

function getRateLimitRetryDelayMs(resetHeader: string | null): number {
  const retryAt = parseRateLimitReset(resetHeader);
  if (retryAt === null) {
    return 0;
  }

  return Math.max(0, retryAt - Date.now());
}

function parseRateLimitReset(resetHeader: string | null): number | null {
  if (!resetHeader) {
    return null;
  }

  const numericValue = Number(resetHeader);
  if (Number.isFinite(numericValue)) {
    return numericValue >= 1_000_000_000_000 ? numericValue : numericValue * 1000;
  }

  const parsedDate = Date.parse(resetHeader);
  if (Number.isNaN(parsedDate)) {
    return null;
  }

  return parsedDate;
}
