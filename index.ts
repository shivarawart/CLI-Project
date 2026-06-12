import { Command } from "commander";
import { runWakeup } from "./tds/wakeup";

const program = new Command();

program
  .name("Sukna")
  .description("Sukna CLI Yt")
  .version("1.0.0");

program
  .command("wakeup")
  .description(
    "Show the banner and choose CLI, WhatsApp or Telegram"
  )
  .action(async () => {
    console.log("wakeup calling...");
    await runWakeup();
  });

await program.parseAsync(process.argv);