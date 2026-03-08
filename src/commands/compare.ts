import { Command } from "commander";

import { renderComparisonTable } from "../formatters.js";
import { outputJson, type CommandContext, type GlobalOptions } from "./shared.js";

export function registerCompareCommand(program: Command, context: CommandContext): void {
  program
    .command("compare <slug1> <slug2>")
    .description("Side-by-side comparison table")
    .action(
      async (
        slug1: string,
        slug2: string,
        _options: GlobalOptions,
        command: Command,
      ) => {
        const globals = command.optsWithGlobals<GlobalOptions>();
        const [left, right] = await Promise.all([
          context.client.getStartup(slug1),
          context.client.getStartup(slug2),
        ]);

        if (globals.json) {
          outputJson({ data: [left.data, right.data] }, context.writeStdout);
          return;
        }

        context.writeStdout(`${renderComparisonTable(left.data, right.data)}\n`);
      },
    );
}
