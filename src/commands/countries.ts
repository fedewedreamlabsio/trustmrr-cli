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

export function registerCountriesCommand(program: Command, context: CommandContext): void {
  program
    .command("countries")
    .description("List available countries")
    .action(async (_options: GlobalOptions, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const scan = await scanClientSideStartups(context.client, globals);
      const countries = uniqueNonEmptyValues(
        applyGlobalFilters(scan.data, globals).map((startup) => startup.country),
      );

      if (globals.json) {
        outputJson(countries, context.writeStdout);
        return;
      }

      writeTextOutput(renderSimpleList(countries), context.writeStdout, scan.note);
    });
}
