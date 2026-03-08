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
const DEFAULT_MIN_INTERVAL_MS = 3_000;

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
  sleep?: (ms: number) => Promise<void>;
}

export class TrustMrrClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly keychainLookup: () => Promise<string>;
  private readonly minIntervalMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private apiKey?: string;
  private nextRequestAt = 0;

  public constructor(options: TrustMrrClientOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchFn = options.fetchFn ?? fetch;
    this.keychainLookup = options.keychainLookup ?? lookupApiKeyFromKeychain;
    this.minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
    this.sleep =
      options.sleep ??
      ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
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

  public async getAllStartups(pageSize = 100): Promise<StartupDetail[]> {
    const all: StartupDetail[] = [];
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;

    while (offset < total) {
      const response = await this.listStartups({ limit: pageSize, offset });
      total = response.meta.total;
      offset += response.data.length;
      all.push(...response.data.map(asDetailLike));

      if (response.data.length === 0) {
        break;
      }
    }

    return all;
  }

  private async request<T>(path: string, query: StartupQuery = {}): Promise<T> {
    await this.waitForRateLimit();

    const apiKey = await this.resolveApiKey();
    const base = this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`;
    const url = new URL(path.startsWith("/") ? path.slice(1) : path, base);

    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }

      url.searchParams.set(key, String(value));
    }

    const response = await this.fetchFn(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    const body = await parseResponseBody(response);
    if (!response.ok) {
      throw this.createError(response.status, body);
    }

    return body as T;
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
      return new TrustMrrError(
        "Rate limit exceeded. TrustMRR allows 20 requests per minute.",
        status,
        body,
      );
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
