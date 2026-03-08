import { Command } from "commander";

import { renderStartupListTable } from "../formatters.js";
import { buildSharedQuery, outputJson, resolveListLimit, type CommandContext, type GlobalOptions } from "./shared.js";

export function registerCategoryCommand(program: Command, context: CommandContext): void {
  program
    .command("category <name> [count]")
    .description("Filter by category")
    .action(
      async (
        name: string,
        count: string | undefined,
        _options: GlobalOptions,
        command: Command,
      ) => {
        const globals = command.optsWithGlobals<GlobalOptions>();
        const limit = resolveListLimit(parseCount(count), globals.limit, 10);
        const response = await context.client.listStartups({
          ...buildSharedQuery(globals),
          category: name,
          limit,
          sort: "mrr",
          order: "desc",
        });

        if (globals.json) {
          outputJson(response, context.writeStdout);
          return;
        }

        context.writeStdout(`${renderStartupListTable(response.data)}\n`);
      },
    );
}

function parseCount(value: string | undefined): number | undefined {
  return value === undefined ? undefined : Number.parseInt(value, 10);
}
