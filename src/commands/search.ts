import { Command } from "commander";

import { renderStartupListTable } from "../formatters.js";
import {
  applyGlobalFilters,
  buildListResponse,
  filterBySearch,
  outputJson,
  scanClientSideStartups,
  sortByRevenueDesc,
  type CommandContext,
  type GlobalOptions,
  writeTextOutput,
} from "./shared.js";

export function registerSearchCommand(program: Command, context: CommandContext): void {
  program
    .command("search <query>")
    .description("Search startups by name or description")
    .action(async (query: string, _options: GlobalOptions, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const scan = await scanClientSideStartups(context.client, globals);
      const startups = sortByRevenueDesc(
        filterBySearch(applyGlobalFilters(scan.data, globals), query),
      );
      const response = buildListResponse(startups, globals.limit ?? 10);

      if (globals.json) {
        outputJson(response, context.writeStdout);
        return;
      }

      writeTextOutput(renderStartupListTable(response.data), context.writeStdout, scan.note);
    });
}
