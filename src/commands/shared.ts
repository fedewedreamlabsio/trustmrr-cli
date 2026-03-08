import type { TrustMrrClient } from "../client.js";

import type { StartupSummary } from "../types.js";

export const DEFAULT_SCAN_LIMIT = 200;

export interface GlobalOptions {
  json?: boolean;
  limit?: number;
  scan?: number;
  country?: string;
  minMrr?: number;
  maxMrr?: number;
}

export interface CommandContext {
  client: TrustMrrClient;
  writeStdout: (value: string) => void;
  writeStderr: (value: string) => void;
}

export function resolveListLimit(
  count: number | undefined,
  optionLimit: number | undefined,
  fallback: number,
): number {
  return count ?? optionLimit ?? fallback;
}

export function outputJson(
  value: unknown,
  writeStdout: (value: string) => void,
): void {
  writeStdout(`${JSON.stringify(value, null, 2)}\n`);
}

export function normalizeGlobalOptions(options: GlobalOptions) {
  return {
    json: options.json ?? false,
    limit: options.limit,
    country: options.country?.toUpperCase(),
    minMrr: options.minMrr,
    maxMrr: options.maxMrr,
  };
}

export function hasClientSideGlobalFilters(options: GlobalOptions): boolean {
  const normalized = normalizeGlobalOptions(options);
  return (
    normalized.country !== undefined ||
    normalized.minMrr !== undefined ||
    normalized.maxMrr !== undefined
  );
}

export function applyGlobalFilters<
  T extends Pick<StartupSummary, "country" | "revenue">,
>(items: T[], options: GlobalOptions): T[] {
  const normalized = normalizeGlobalOptions(options);

  return items.filter((item) => {
    if (normalized.country && item.country?.toUpperCase() !== normalized.country) {
      return false;
    }

    const mrr = item.revenue.mrr;
    if (normalized.minMrr !== undefined && (mrr === null || mrr < normalized.minMrr)) {
      return false;
    }

    if (normalized.maxMrr !== undefined && (mrr === null || mrr > normalized.maxMrr)) {
      return false;
    }

    return true;
  });
}

export function filterByCategory<
  T extends Pick<StartupSummary, "category">,
>(items: T[], category: string): T[] {
  const query = normalizeText(category);
  return items.filter((item) => normalizeText(item.category).includes(query));
}

export function filterBySearch<
  T extends Pick<StartupSummary, "name" | "description">,
>(items: T[], query: string): T[] {
  const normalizedQuery = normalizeText(query);
  return items.filter((item) => {
    return (
      normalizeText(item.name).includes(normalizedQuery) ||
      normalizeText(item.description).includes(normalizedQuery)
    );
  });
}

export function sortByRevenueDesc<
  T extends Pick<StartupSummary, "revenue">,
>(items: T[]): T[] {
  return [...items].sort((left, right) =>
    compareNullableNumbersDesc(left.revenue.mrr, right.revenue.mrr),
  );
}

export function sortByGrowth30dDesc<
  T extends Pick<StartupSummary, "growth30d">,
>(items: T[]): T[] {
  return [...items].sort((left, right) =>
    compareNullableNumbersDesc(left.growth30d, right.growth30d),
  );
}

export function sortByAskingPriceDesc<
  T extends Pick<StartupSummary, "askingPrice">,
>(items: T[]): T[] {
  return [...items].sort((left, right) =>
    compareNullableNumbersDesc(left.askingPrice, right.askingPrice),
  );
}

export function uniqueNonEmptyValues(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ]
    .sort((left, right) => left.localeCompare(right));
}

export function buildListResponse<T extends StartupSummary>(items: T[], limit: number) {
  return {
    data: items.slice(0, limit),
    meta: {
      total: items.length,
      page: 1,
      limit,
      hasMore: items.length > limit,
    },
  };
}

export function resolveScanLimit(options: GlobalOptions): number {
  return options.scan ?? DEFAULT_SCAN_LIMIT;
}

export async function scanClientSideStartups(
  client: TrustMrrClient,
  options: GlobalOptions,
): Promise<{ data: Awaited<ReturnType<TrustMrrClient["scanStartups"]>>["data"]; note: string | null }> {
  const scanLimit = resolveScanLimit(options);
  const result = await client.scanStartups(scanLimit);

  return {
    data: result.data,
    note: result.isPartial ? formatPartialScanNote(scanLimit) : null,
  };
}

export function writeTextOutput(
  text: string,
  writeStdout: (value: string) => void,
  note?: string | null,
): void {
  if (note) {
    writeStdout(`${text}\n${note}\n`);
    return;
  }

  writeStdout(`${text}\n`);
}

export function renderSimpleList(values: string[]): string {
  if (values.length === 0) {
    return "No results.";
  }

  return values.join("\n");
}

export function parseCountArgument(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid count value: ${value}. Expected a positive integer.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid count value: ${value}. Expected a positive integer.`);
  }

  return parsed;
}

function normalizeText(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function compareNullableNumbersDesc(
  left: number | null | undefined,
  right: number | null | undefined,
): number {
  return (right ?? Number.NEGATIVE_INFINITY) - (left ?? Number.NEGATIVE_INFINITY);
}

function formatPartialScanNote(scanLimit: number): string {
  return `(showing results from top ${scanLimit.toLocaleString("en-US")} by revenue)`;
}
