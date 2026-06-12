import { text, isCancel } from "@clack/prompts";
import chalk from 'chalk';
import {DefaultAgentConfig} from './types'
import {ActionTracker} from './action-tracker'
import { ToolExecutor } from "./tool-executer";
import {createAgentTools} from './agent-tools'
import { stepCountIs, tool, ToolLoopAgent } from "ai";
import { getAgentModel } from "../../ai";
import { renderTerminalMarkdown } from "../../tds/terminal-md";
import {runApprovalFlow} from './approval'


export async function runAgentMode(){
    console.log(chalk.bold("\n agent mode \n"));
    const goal = await text({
         message: "Describe your task for the agent:",
    placeholder:
      "e.g. implement JWT auth, fix bugs, refactor search engine",
      
    });
     
    if(isCancel(goal) || !goal.trim())return;

    const config = DefaultAgentConfig()
    const tracker =  new ActionTracker()
    const executer = new ToolExecutor(tracker,config);
    const tools = createAgentTools(executer);

    const agent = new ToolLoopAgent({
        model:getAgentModel(),
        stopWhen:stepCountIs(40),
        instructions:[
            `Workspace root: ${config.codebasePath}`,
  "All file mutations are staged until explicitly approved.",
  "Use tools only when necessary.",
  "Prefer minimal, safe changes over large rewrites.",

        ].join("\n"),
        tools,
    });
   const result = await agent.generate({
  prompt: goal.trim(),

  onStepFinish: ({ toolCalls }) => {
    for (const tc of toolCalls) {
      const name = String(tc.toolName ?? "unknown");

      const shouldTruncate =
        JSON.stringify(tc).length > 160;

      console.log(
        chalk.green("[tool]"),
        chalk.bold(name),
        chalk.dim(shouldTruncate ? "..." : "")
      );
    }
}
});

    if(result.text?.trim()){
        console.log(renderTerminalMarkdown(result.text));
    }


      const ok = await runApprovalFlow(tracker);

if (!ok) return executer.clearStaging();

const { errors } = executer.applyApprovedFromTracker();

if (errors.length) {
  console.log(chalk.red("\nSome operations reported errors:\n"));

  for (const error of errors) {
    console.log(chalk.red(`  • ${error}`));
  }
} else {
  console.log(chalk.green("\n✓ Changes applied successfully.\n"));
}

executer.clearStaging();
}
