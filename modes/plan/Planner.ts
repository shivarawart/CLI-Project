import {Output,extractJsonMiddleware,generateText,stepCountIs,tool,wrapLanguageModel} from 'ai';
import {getAgentModel} from '../../ai/ai.config';
import {ActionTracker} from '../agent/action-tracker';
import {ToolExecutor} from '../agent/tool-executer';
import {DefaultAgentConfig} from '../agent/types';
import {z} from 'zod';
import type{Plan,PlanStep} from './types';
// import { s, title } from 'framer-motion/client';
import chalk from 'chalk';
import { createWebTools } from './web-tool';

const planSchema = z.object({
  goal: z.string(),

  researchSummary: z.string().optional(),

  steps: z
    .array(
      z.object({
        id: z.string(),

        title: z.string(),
        description: z.string(),

        hints: z.array(z.string()).optional(),

        complexity: z.enum(["low", "medium", "high"]).optional(),
      })
    )
    .min(1)
    .max(15),
});

function readonlyTools(executor:ToolExecutor){
    return {
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

    }


}

const PLAN_INSTRUCTIONS = (codebase: string, hasWeb: boolean) =>
  [
    "You are a planning agent responsible for generating structured execution plans.",
    "",
    "## Core Rules",
    "- You DO NOT modify files or execute changes.",
    "- You ONLY analyze and plan.",
    "- You must use read-only tools when inspecting the codebase or skills.",
    "",
    "## Workspace",
    `- Root directory: ${codebase}`,
    "",
    "## Tool Usage",
    hasWeb
      ? "- Web tools are available (search, crawl, fetch). Use only when necessary for external context."
      : "- Web tools are NOT available. Do not assume external access.",
    "",
    "## Output Requirements",
    "- Output MUST strictly match the provided JSON schema.",
    "- Do NOT include extra commentary or markdown.",
    "- Do NOT hallucinate fields outside schema.",
    "",
    "## Planning Strategy",
    "- Break the goal into 1–10 clear, actionable steps.",
    "- Each step must be small, verifiable, and executable.",
    "- Prefer simplicity over over-engineering.",
    "- Ensure logical order of execution.",
    "",
    "## Quality Rules",
    "- Avoid vague steps like 'improve system' or 'optimize code'.",
    "- Every step must describe a concrete action.",
    "- If uncertain, prefer fewer steps.",
  ].join("\n");


export async function generatePlan(goal: string): Promise<Plan> {
  const config = DefaultAgentConfig();
  const tracker = new ActionTracker();
  const executor = new ToolExecutor(tracker,config);

  const hasweb = !!process.env.FIRECRAWL_WEB_SEARCH;
const model = wrapLanguageModel({
    model:getAgentModel(),
    middleware:extractJsonMiddleware()

});


const tools = { ...readonlyTools(executor), ...(hasweb ? createWebTools(tracker): {})};




  console.log(chalk.green("\nResearching & drafting plan...\n"));

  const result = await generateText({
    model,
    tools: readonlyTools(new ToolExecutor(new ActionTracker(), config)),

    stopWhen: stepCountIs(20),

    system: PLAN_INSTRUCTIONS(config.codebasePath, false),

    prompt: `User goal:\n${goal}`,

    output: Output.object({ schema: planSchema }),
  });

  const parsed = result.output;

  const steps: PlanStep[] = parsed.steps.map((step, i) => ({
    id: `step-${i + 1}`,
    title: step.title,
    description: step.description,
    hints: step.hints,
    complexity: step.complexity,
  }));

  return {
    goal,
    researchSummary: parsed.researchSummary,
    steps,
  };
}



