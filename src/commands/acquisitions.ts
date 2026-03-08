import { Command } from "commander";

import { renderTable } from "../formatters.js";
import { formatCurrency, formatGrowth } from "../formatters.js";
import {
  applyGlobalFilters,
  buildListResponse,
  hasClientSideGlobalFilters,
  outputJson,
  parseCountArgument,
  resolveListLimit,
  scanClientSideStartups,
  sortByAskingPriceDesc,
  type CommandContext,
  type GlobalOptions,
  writeTextOutput,
} from "./shared.js";

export function registerAcquisitionsCommand(program: Command, context: CommandContext): void {
  program
    .command("acquisitions [count]")
    .description("For-sale listings with financials")
    .action(async (count: string | undefined, _options: GlobalOptions, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const limit = resolveListLimit(parseCountArgument(count), globals.limit, 10);
      let note: string | null = null;
      const response = hasClientSideGlobalFilters(globals)
        ? await (async () => {
            const scan = await scanClientSideStartups(context.client, globals);
            note = scan.note;

            return buildListResponse(
              sortByAskingPriceDesc(
                applyGlobalFilters(scan.data, globals).filter((startup) => startup.onSale),
              ),
              limit,
            );
          })()
        : await context.client.listStartups({
            onSale: true,
            limit,
            sort: "askingPrice",
            order: "desc",
          });

      if (globals.json) {
        outputJson(response, context.writeStdout);
        return;
      }

      writeTextOutput(
        renderTable(response.data, [
          { header: "Name", value: (startup) => startup.name },
          { header: "Category", value: (startup) => startup.category ?? "n/a" },
          {
            header: "MRR",
            value: (startup) => formatCurrency(startup.revenue.mrr),
            align: "right",
          },
          {
            header: "Growth",
            value: (startup) => formatGrowth(startup.growth30d),
            align: "right",
          },
          {
            header: "Asking Price",
            value: (startup) => formatCurrency(startup.askingPrice),
            align: "right",
          },
        ]),
        context.writeStdout,
        note,
      );
    });
}
