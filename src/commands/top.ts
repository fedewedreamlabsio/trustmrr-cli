import { Command } from "commander";

import { renderStartupListTable } from "../formatters.js";
import {
  applyGlobalFilters,
  buildListResponse,
  hasClientSideGlobalFilters,
  outputJson,
  parseCountArgument,
  resolveListLimit,
  scanClientSideStartups,
  sortByRevenueDesc,
  type CommandContext,
  type GlobalOptions,
  writeTextOutput,
} from "./shared.js";

export function registerTopCommand(program: Command, context: CommandContext): void {
  program
    .command("top [count]")
    .description("Leaderboard by MRR")
    .action(async (count: string | undefined, _options: GlobalOptions, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const limit = resolveListLimit(parseCountArgument(count), globals.limit, 10);
      let note: string | null = null;
      const response = hasClientSideGlobalFilters(globals)
        ? await (async () => {
            const scan = await scanClientSideStartups(context.client, globals);
            note = scan.note;

            return buildListResponse(
              sortByRevenueDesc(applyGlobalFilters(scan.data, globals)),
              limit,
            );
          })()
        : await context.client.listStartups({
            limit,
            sort: "mrr",
            order: "desc",
          });

      if (globals.json) {
        outputJson(response, context.writeStdout);
        return;
      }

      writeTextOutput(renderStartupListTable(response.data), context.writeStdout, note);
    });
}
