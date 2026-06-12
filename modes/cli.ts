import { select, isCancel } from "@clack/prompts";
import chalk from 'chalk';
import {runAgentMode} from './agent/orchestrator'
import { runAskMode } from "./ask/orchestrator";
import {runPlanMode} from './plan/orchestrator'



export async function runCliMode() {
  while (true) {
    const mode = await select({
      message: "Choose CLI sub mode",
      options: [
        {
          value: "agent",
          label: "🤖 Agent Mode",
        },
        {
          value: "plan",
          label: "📋 Plan Mode",
        },
        {
          value: "ask",
          label: "❓ Ask Mode",
        },
        {
          value: "back",
          label: "← Back to Main Menu",
        },
      ],
    });

    if (isCancel(mode) || mode === "back") {
      console.log(chalk.dim("Returning to main menu..."));
      return;
    }

    if (mode === "agent") {
      await runAgentMode()
      console.log(
        chalk.green("Starting Agent Mode...")

      );

     
    } else if (mode === "plan") {
      console.log(
        chalk.blue("Starting Plan Mode...")
      );
     await runPlanMode();

      
    } else if (mode === "ask") {
       await runAskMode();
      console.log(
        chalk.yellow("Starting Ask Mode...")
      );

      
    }
  }
}