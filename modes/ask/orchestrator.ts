import { confirm,text, isCancel } from "@clack/prompts";
import chalk from 'chalk';
import {ToolLoopAgent,stepCountIs,tool} from 'ai';
import {z} from 'zod';
import {getAgentModel} from '../../ai/ai.config';
import {ActionTracker} from '../agent/action-tracker';
import {ToolExecutor} from '../agent/tool-executer';
import {DefaultAgentConfig} from '../agent/types';
import {renderTerminalMarkdown} from '../../tds/terminal-md'
import {runApprovalFlow} from '../agent/approval';
import { createWebTools } from "../plan/web-tool";

function createAsktool(executor:ToolExecutor){
    return{
        read_file: tool({
      description: "Read a file from the workspace safely",
      inputSchema: z.object({
        path: z.string().describe("File path relative to workspace"),
      }),
      execute: async ({ path }) => executor.readFile(path),
    }),

     list_files: tool({
      description: "List files in a directory",
      inputSchema: z.object({
        path: z.string().default("."),
        recursive: z.boolean().default(true),
      }),
      execute: async ({ path, recursive }) =>
        executor.listFiles(path, recursive),
    }),

     search_files: tool({
      description: "Search files by name or content",
      inputSchema: z.object({
        query: z.string(),
        root: z.string().default("."),
        recursive: z.boolean().default(true),
        matchContent: z.boolean().default(true),
        matchFileName: z.boolean().default(true),
        limit: z.number().default(50),
      }),
      execute: async (input) => executor.searchFiles(input),
    }),

     list_skills: tool({
      description: "List all registered agent skills",
      inputSchema: z.object({}),
      execute: async () => executor.listSkills(),
    }),
      read_skills: tool({
      description: "Read available skill files from skills directory",
      inputSchema: z.object({
        dir: z.string().default("skills"),
      }),
      execute: async ({ dir }) => executor.readSkills(dir),
    }),


    };
};

function asMd(question: string, answer: string): string {
  return `# Ask Mode

## Question

${question.trim()}

## Answer

${answer.trim()}
`;
}

export async function runAskMode() {
  console.log(chalk.bold("\n? Ask Mode\n"));

  const question = await text({
    message: "What do you want to ask?",
  });

  if (isCancel(question)) return;

  const prompt = question.trim();
  if (!prompt) return;

  const config = DefaultAgentConfig();

  config.tools.allowFileCreation = true;
  config.tools.allowFileModification = false;
  config.tools.allowFolderCreation = false;
  config.tools.allowShellExecution = false;

  const tracker = new ActionTracker();
  const executor = new ToolExecutor(tracker, config);

  const tools = {
    ...createAsktool(executor),
    ...createWebTools(tracker)
  };

  const agent = new ToolLoopAgent({
    model: getAgentModel(),
    stopWhen: stepCountIs(20),
    tools,
  });

  const result = await agent.generate({
    prompt,
  });

  const answer = result.text?.trim() ?? "(No Answer)";

  console.log("\n" + renderTerminalMarkdown(answer) + "\n");

  const wantSave = await confirm({
    message: "Save this answer to a .md file?",
    initialValue: false,
  });

  if (isCancel(wantSave) || !wantSave) return;

  const filename = await text({
    message: "Filename",
    initialValue: "ask.md",
    validate: (v) => {
      const s = (v ?? "").trim();

      if (!s) return "Required";
      if (s.includes("..") || s.includes("/") || s.includes("\\")) {
        return "Invalid path";
      }
      if (!s.toLowerCase().endsWith(".md")) {
        return "Must end with .md";
      }
    },
  });

  if (isCancel(filename)) return;

  const safeFilename = filename.trim();

  executor.createFile(safeFilename, asMd(prompt, answer));

  const ok = await runApprovalFlow(tracker);

  if (!ok) {
    executor.clearStaging();
    return;
  }

  executor.applyApprovedFromTracker();
  executor.clearStaging();
}


// change with Ai