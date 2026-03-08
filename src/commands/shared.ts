import type { TrustMrrClient } from "../client.js";

export interface GlobalOptions {
  json?: boolean;
  limit?: number;
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

export function buildSharedQuery(options: GlobalOptions) {
  const normalized = normalizeGlobalOptions(options);
  return {
    country: normalized.country,
    minMrr: normalized.minMrr,
    maxMrr: normalized.maxMrr,
  };
}
