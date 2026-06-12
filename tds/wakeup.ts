import { select, isCancel } from "@clack/prompts";
import chalk from "chalk";
import figlet from "figlet";
import { runCliMode } from "../modes/cli";
import { runTelegramMode } from "../modes/telegram";

const BANNER_FONT = "ANSI Shadow";

const SHADOW = chalk.hex("#5b49de");
const FACE = chalk.hex("#e8dcf3").bold;

function printBannerWithShadow(ascii: string) {
  const bannerLines = ascii.trimEnd().split("\n");

  const maxLen = Math.max(
    ...bannerLines.map((line) => line.length)
  );

  const rowWidth = maxLen + 2;

  // Shadow Layer
  for (const line of bannerLines) {
    console.log(
      SHADOW((" " + line).padEnd(rowWidth))
    );
  }

  // Move cursor back up
  process.stdout.write(
    `\x1b[${bannerLines.length}A`
  );

  // Face Layer
  for (const line of bannerLines) {
    console.log(
      FACE(line.padEnd(rowWidth))
    );
  }

  console.log();
}

export async function runWakeup() {
  let ascii: string;

  try {
    ascii = figlet.textSync("Sukna", {
      font: BANNER_FONT,
    });
  } catch {
    ascii = figlet.textSync("Sukna", {
      font: "Standard",
    });
  }

  printBannerWithShadow(ascii);

  const mode = await select({
    message: "Which mode do you want to proceed with?",
    options: [
      {
        value: "cli",
        label: "CLI",
      },
      {
        value: "telegram",
        label: "Telegram",
      },
      {
        value: "whatsapp",
        label: "WhatsApp",
      },
    ],
  });

  if (isCancel(mode)) {
    process.exit(0);
  }

 if (mode === "cli") {
  console.log(
    chalk.dim("Starting CLI mode..."),
    await runCliMode()
  );
} else if (mode === "telegram") {
  console.log(
    chalk.dim("Starting Telegram chat..."),
    //  await runCliMode(),
     await runTelegramMode()
  );
} else if (mode === "whatsapp") {
  console.log(
    chalk.dim("Starting WhatsApp chat..."),
     await runCliMode()
  );
}
}