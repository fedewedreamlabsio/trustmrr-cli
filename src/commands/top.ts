import { Command } from "commander";

import { renderStartupListTable } from "../formatters.js";
import { buildSharedQuery, outputJson, resolveListLimit, type CommandContext, type GlobalOptions } from "./shared.js";

export function registerTopCommand(program: Command, context: CommandContext): void {
  program
    .command("top [count]")
    .description("Leaderboard by MRR")
    .action(async (count: string | undefined, options: GlobalOptions, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const limit = resolveListLimit(parseCount(count), globals.limit, 10);
      const response = await context.client.listStartups({
        ...buildSharedQuery(globals),
        limit,
        sort: "mrr",
        order: "desc",
      });

      if (globals.json) {
        outputJson(response, context.writeStdout);
        return;
      }

      context.writeStdout(`${renderStartupListTable(response.data)}\n`);
    });
}

function parseCount(value: string | undefined): number | undefined {
  return value === undefined ? undefined : Number.parseInt(value, 10);
}
