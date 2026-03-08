import { Command } from "commander";

import { renderTable } from "../formatters.js";
import { buildSharedQuery, outputJson, resolveListLimit, type CommandContext, type GlobalOptions } from "./shared.js";
import { formatCurrency, formatGrowth } from "../formatters.js";

export function registerAcquisitionsCommand(program: Command, context: CommandContext): void {
  program
    .command("acquisitions [count]")
    .description("For-sale listings with financials")
    .action(async (count: string | undefined, _options: GlobalOptions, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const limit = resolveListLimit(parseCount(count), globals.limit, 10);
      const response = await context.client.listStartups({
        ...buildSharedQuery(globals),
        onSale: true,
        limit,
        sort: "askingPrice",
        order: "desc",
      });

      if (globals.json) {
        outputJson(response, context.writeStdout);
        return;
      }

      context.writeStdout(
        `${renderTable(response.data, [
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
        ])}\n`,
      );
    });
}

function parseCount(value: string | undefined): number | undefined {
  return value === undefined ? undefined : Number.parseInt(value, 10);
}
