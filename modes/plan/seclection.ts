import {multiselect,isCancel} from '@clack/prompts'
import chalk from 'chalk';
import type{Plan,PlanStep} from './types';
import {renderTerminalMarkdown} from '../../tds/terminal-md'


const COMPLEXITY_STYLE: Record<
  NonNullable<PlanStep["complexity"]>,
  {
    label: string;
    color: (text: string) => string;
  }
> = {
  low: {
    label: "LOW",
    color: chalk.green,
  },
  medium: {
    label: "MEDIUM",
    color: chalk.yellow,
  },
  high: {
    label: "HIGH",
    color: chalk.red,
  },
};

export function printPlan(plan: Plan): void {
  if (plan.researchSummary?.trim()) {
    console.log(
      chalk.bold("\n🔎 Research Summary\n")
    );

    console.log(
      renderTerminalMarkdown(
        plan.researchSummary
      )
    );
  }

  console.log(
    chalk.bold(
      `\n📋 Generated Plan (${plan.steps.length} steps)\n`
    )
  );

  for (const [i, step] of plan.steps.entries()) {
    const tag = step.complexity
      ? COMPLEXITY_STYLE[
          step.complexity
        ].color(
          `[${COMPLEXITY_STYLE[
            step.complexity
          ].label}]`
        )
      : "";

    const stepNumber = chalk.cyan(
      `${String(i + 1).padStart(2, "0")}.`
    );

    console.log(
      `${stepNumber} ${chalk.bold(
        step.title
      )} ${tag}`
    );

    console.log(
      chalk.dim(step.description)
    );

    if (step.hints?.length) {
      console.log(
        chalk.yellow("💡 Hints")
      );

      for (const hint of step.hints) {
        console.log(
          chalk.gray(`   • ${hint}`)
        );
      }
    }

    console.log();
  }
}

export async function selectSteps(
  plan: Plan
): Promise<PlanStep[]> {
  const options = plan.steps.map(
    (step) => ({
      value: step.id,
      label: step.title,
      hint: step.complexity
        ? COMPLEXITY_STYLE[
            step.complexity
          ].label
        : undefined,
    })
  );

  const picked =
    await multiselect<string>({
      message:
        "Select steps to execute",
      options,
      initialValues:
        plan.steps.map(
          (step) => step.id
        ),
      required: true,
    });

  if (isCancel(picked)) {
    return [];
  }

  const selectedIds =
    new Set(picked);

  return plan.steps.filter(
    (step) =>
      selectedIds.has(step.id)
  );
}

