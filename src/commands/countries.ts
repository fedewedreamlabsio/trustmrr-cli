import { Command } from "commander";

import { countOccurrences, renderCountTable } from "../formatters.js";
import { outputJson, type CommandContext, type GlobalOptions } from "./shared.js";

export function registerCountriesCommand(program: Command, context: CommandContext): void {
  program
    .command("countries")
    .description("List available countries")
    .action(async (_options: GlobalOptions, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const response = await context.client.listStartups({ limit: 1_000, sort: "mrr", order: "desc" });
      const countries = response.data
        .map((startup) => startup.country)
        .filter((value): value is string => Boolean(value))
        .sort((left, right) => left.localeCompare(right));

      if (globals.json) {
        outputJson({ data: [...new Set(countries)] }, context.writeStdout);
        return;
      }

      context.writeStdout(`${renderCountTable(countOccurrences(countries))}\n`);
    });
}
