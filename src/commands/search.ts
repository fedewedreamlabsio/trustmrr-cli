import { Command } from "commander";

import { renderStartupListTable } from "../formatters.js";
import { buildSharedQuery, outputJson, type CommandContext, type GlobalOptions } from "./shared.js";

export function registerSearchCommand(program: Command, context: CommandContext): void {
  program
    .command("search <query>")
    .description("Search startups by name or description")
    .action(async (query: string, _options: GlobalOptions, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const response = await context.client.listStartups({
        ...buildSharedQuery(globals),
        limit: globals.limit ?? 10,
        search: query,
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
