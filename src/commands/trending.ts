import { Command } from "commander";

import { renderStartupListTable } from "../formatters.js";
import {
  applyGlobalFilters,
  buildListResponse,
  outputJson,
  parseCountArgument,
  sortByGrowth30dDesc,
  resolveListLimit,
  scanClientSideStartups,
  type CommandContext,
  type GlobalOptions,
  writeTextOutput,
} from "./shared.js";

export function registerTrendingCommand(program: Command, context: CommandContext): void {
  program
    .command("trending [count]")
    .description("Fastest growing by MoM percentage")
    .action(async (count: string | undefined, _options: GlobalOptions, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const limit = resolveListLimit(parseCountArgument(count), globals.limit, 10);
      const scan = await scanClientSideStartups(context.client, globals);
      const startups = sortByGrowth30dDesc(
        applyGlobalFilters(scan.data, globals).filter((startup) => startup.growth30d !== null),
      );
      const response = buildListResponse(startups, limit);

      if (globals.json) {
        outputJson(response, context.writeStdout);
        return;
      }

      writeTextOutput(renderStartupListTable(response.data), context.writeStdout, scan.note);
    });
}
