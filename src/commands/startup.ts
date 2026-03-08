import { Command } from "commander";

import { renderDetailCard } from "../formatters.js";
import { outputJson, type CommandContext, type GlobalOptions } from "./shared.js";

export function registerStartupCommand(program: Command, context: CommandContext): void {
  program
    .command("startup <slug>")
    .description("Full details for one startup")
    .action(async (slug: string, _options: GlobalOptions, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const response = await context.client.getStartup(slug);

      if (globals.json) {
        outputJson(response, context.writeStdout);
        return;
      }

      context.writeStdout(`${renderDetailCard(response.data)}\n`);
    });
}
