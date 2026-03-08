#!/usr/bin/env node

import { Command } from "commander";

import { TrustMrrClient, TrustMrrError } from "./client.js";
import { registerAcquisitionsCommand } from "./commands/acquisitions.js";
import { registerCategoriesCommand } from "./commands/categories.js";
import { registerCategoryCommand } from "./commands/category.js";
import { registerCompareCommand } from "./commands/compare.js";
import { registerCountriesCommand } from "./commands/countries.js";
import { registerSearchCommand } from "./commands/search.js";
import { registerStartupCommand } from "./commands/startup.js";
import { registerTopCommand } from "./commands/top.js";
import { registerTrendingCommand } from "./commands/trending.js";

export interface BuildProgramOptions {
  client?: TrustMrrClient;
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
}

export function buildProgram(options: BuildProgramOptions = {}): Command {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const client =
    options.client ?? new TrustMrrClient({ writeStderr: (value) => stderr.write(value) });

  const program = new Command();
  program
    .name("trustmrr")
    .description("CLI for TrustMRR startup revenue data")
    .option("--json", "Output JSON instead of formatted tables")
    .option("--limit <n>", "Override default count", parsePositiveInteger)
    .option(
      "--scan <n>",
      "Scan the top N startups by revenue for client-side commands",
      parsePositiveInteger,
    )
    .option("--country <cc>", "Filter by 2-letter country code", parseCountryCode)
    .option("--min-mrr <n>", "Minimum MRR filter", parseNumber)
    .option("--max-mrr <n>", "Maximum MRR filter", parseNumber)
    .showHelpAfterError("(run with --help for usage)")
    .configureOutput({
      writeOut: (value) => stdout.write(value),
      writeErr: (value) => stderr.write(value),
    });

  const context = {
    client,
    writeStdout: (value: string) => {
      stdout.write(value);
    },
    writeStderr: (value: string) => {
      stderr.write(value);
    },
  };

  registerTopCommand(program, context);
  registerSearchCommand(program, context);
  registerStartupCommand(program, context);
  registerCompareCommand(program, context);
  registerTrendingCommand(program, context);
  registerCategoryCommand(program, context);
  registerAcquisitionsCommand(program, context);
  registerCountriesCommand(program, context);
  registerCategoriesCommand(program, context);

  return program;
}

export async function main(argv = process.argv): Promise<void> {
  const program = buildProgram();

  try {
    await program.parseAsync(argv);
  } catch (error) {
    handleError(error, process.stderr);
    process.exitCode = 1;
  }
}

export function handleError(error: unknown, stderr: NodeJS.WritableStream): void {
  if (error instanceof TrustMrrError) {
    stderr.write(`${error.message}\n`);
    return;
  }

  if (error instanceof Error) {
    stderr.write(`${error.message}\n`);
    return;
  }

  stderr.write("Unexpected error.\n");
}

function parsePositiveInteger(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid integer value: ${value}`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid integer value: ${value}`);
  }

  return parsed;
}

function parseNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid numeric value: ${value}`);
  }

  return parsed;
}

function parseCountryCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    throw new Error(`Invalid country code: ${value}`);
  }

  return normalized;
}

import { realpathSync } from "node:fs";

const entryReal = (() => {
  try {
    return realpathSync(process.argv[1]);
  } catch {
    return process.argv[1];
  }
})();

if (import.meta.url === `file://${entryReal}` || import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
