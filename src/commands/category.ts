import { Command } from "commander";

import { renderStartupListTable } from "../formatters.js";
import {
  applyGlobalFilters,
  buildListResponse,
  filterByCategory,
  outputJson,
  parseCountArgument,
  resolveListLimit,
  scanClientSideStartups,
  sortByRevenueDesc,
  type CommandContext,
  type GlobalOptions,
  writeTextOutput,
} from "./shared.js";

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
        const limit = resolveListLimit(parseCountArgument(count), globals.limit, 10);
        const scan = await scanClientSideStartups(context.client, globals);
        const startups = sortByRevenueDesc(
          filterByCategory(applyGlobalFilters(scan.data, globals), name),
        );
        const response = buildListResponse(startups, limit);

        if (globals.json) {
          outputJson(response, context.writeStdout);
          return;
        }

        writeTextOutput(renderStartupListTable(response.data), context.writeStdout, scan.note);
      },
    );
}
