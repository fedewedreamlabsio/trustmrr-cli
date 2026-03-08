import { Command } from "commander";

import { countOccurrences, renderCountTable } from "../formatters.js";
import { outputJson, type CommandContext, type GlobalOptions } from "./shared.js";

export function registerCategoriesCommand(program: Command, context: CommandContext): void {
  program
    .command("categories")
    .description("List available categories")
    .action(async (_options: GlobalOptions, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const response = await context.client.listStartups({ limit: 1_000, sort: "mrr", order: "desc" });
      const categories = response.data
        .map((startup) => startup.category)
        .filter((value): value is string => Boolean(value))
        .sort((left, right) => left.localeCompare(right));

      if (globals.json) {
        outputJson({ data: [...new Set(categories)] }, context.writeStdout);
        return;
      }

      context.writeStdout(`${renderCountTable(countOccurrences(categories))}\n`);
    });
}
