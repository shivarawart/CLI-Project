import { confirm,text, isCancel } from "@clack/prompts";
import chalk from 'chalk';
import {ToolLoopAgent,generateId,stepCountIs} from 'ai';
import {z} from 'zod';
import {getAgentModel} from '../../ai/ai.config';
import {ActionTracker} from '../agent/action-tracker';
import {ToolExecutor} from '../agent/tool-executer';
import {DefaultAgentConfig} from '../agent/types';
import {renderTerminalMarkdown} from '../../tds/terminal-md'
import {runApprovalFlow} from '../agent/approval';
import {createAgentTools} from '../agent/agent-tools'
import { generatePlan} from "./Planner";
import {printPlan,selectSteps} from './seclection'
import type { PlanStep } from "./types";
import { createWebTools } from "./web-tool";


function stepPrompt(
  goal: string,
  step: PlanStep
): string {
  return [
    `Goal: ${goal}`,
    `Step: ${step.title}`,
    `Description: ${step.description}`,
    step.hints?.length
      ? `Hints:\n- ${step.hints.join("\n- ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function runPlanMode(): Promise<void> {
  console.log(
    chalk.bold("\n📋 Plan Mode\n")
  );

  const goal = await text({
    message: "What is your plan?",
    placeholder:
      "Build auth system, create README, refactor API...",
  });

  if (isCancel(goal)) return;

  const prompt = goal.trim();

  if (!prompt) return;

  const plan = await generatePlan(prompt);

  printPlan(plan);

  const selectedSteps =
    await selectSteps(plan);

  if (selectedSteps.length === 0) {
    console.log(
      chalk.yellow(
        "\n⚠ No steps selected.\n"
      )
    );
    return;
  }

  const proceed = await confirm({
    message: `Execute ${selectedSteps.length} step(s)?`,
    initialValue: true,
  });

  if (
    isCancel(proceed) ||
    !proceed
  ) {
    console.log(
      chalk.yellow(
        "\n⚠ Execution cancelled.\n"
      )
    );
    return;
  }

  const config =
    DefaultAgentConfig();

  const tracker =
    new ActionTracker();

  const executor =
    new ToolExecutor(
      tracker,
      config
    );

  const tools = {
    ...createAgentTools(executor),
    ...createWebTools(tracker)
  };

  const agent =
    new ToolLoopAgent({
      model: getAgentModel(),
      stopWhen: stepCountIs(15),
      tools,
    });

  try {
    for (const step of selectedSteps) {
      console.log(
        chalk.bold(
          `\n🚀 ${step.title}\n`
        )
      );

      const result =
        await agent.generate({
          prompt: stepPrompt(
            plan.goal,
            step
          ),
        });

      if (result.text?.trim()) {
        console.log(
          renderTerminalMarkdown(
            result.text
          )
        );
      }
    }

    console.log(
      chalk.cyan(
        "\n🔍 Reviewing staged changes...\n"
      )
    );

    const approved =
      await runApprovalFlow(
        tracker
      );

    if (!approved) {
      console.log(
        chalk.yellow(
          "\n⚠ Changes not approved.\n"
        )
      );
      return;
    }

    const { errors } =
      executor.applyApprovedFromTracker();

    if (errors.length > 0) {
      console.log(
        chalk.red(
          "\n❌ Some operations reported errors:\n"
        )
      );

      for (const error of errors) {
        console.log(
          chalk.red(`• ${error}`)
        );
      }
    } else {
      console.log(
        chalk.green(
          "\n✅ Changes applied successfully.\n"
        )
      );
    }
  } finally {
    executor.clearStaging();
  }
}