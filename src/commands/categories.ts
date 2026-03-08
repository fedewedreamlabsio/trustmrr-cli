import { Command } from "commander";

import {
  applyGlobalFilters,
  outputJson,
  renderSimpleList,
  scanClientSideStartups,
  type CommandContext,
  type GlobalOptions,
  uniqueNonEmptyValues,
  writeTextOutput,
} from "./shared.js";

export function registerCategoriesCommand(program: Command, context: CommandContext): void {
  program
    .command("categories")
    .description("List available categories")
    .action(async (_options: GlobalOptions, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const scan = await scanClientSideStartups(context.client, globals);
      const categories = uniqueNonEmptyValues(
        applyGlobalFilters(scan.data, globals).map((startup) => startup.category),
      );

      if (globals.json) {
        outputJson(categories, context.writeStdout);
        return;
      }

      writeTextOutput(renderSimpleList(categories), context.writeStdout, scan.note);
    });
}
