import { select, isCancel, group } from "@clack/prompts";
import chalk from 'chalk';
import type{ActionTracker} from './action-tracker'
import type {ActionLog,ActionType,ActionDetails} from './types'
import { a } from "framer-motion/client";
import { composeBeforeAfter } from "./diff-view";
import { formatFileDiff} from "./diff-view";
import { renderTerminalMarkdown } from "../../tds/terminal-md";

interface ReviewGroup{
    label:string;
    actionIds:string[],
    patch:string | null,
}
function groupPending(
  pending: readonly ActionLog[]
): ReviewGroup[] {
  const byPath = new Map<string, ActionLog[]>();
  const shells: ActionLog[] = [];

  for (const action of pending) {
    if (action.type === "tool_execute") {
      shells.push(action);
      continue;
    }

    const path = action.path;

    if (!byPath.has(path)) {
      byPath.set(path, []);
    }

    byPath.get(path)!.push(action);
  }

  const groups: ReviewGroup[] = [];

  const pathEntries = [...byPath.entries()].sort(
    ([a], [b]) => a.localeCompare(b)
  );

  for (const [path, actions] of pathEntries) {
    const sorted = [...actions].sort(
      (a, b) =>
        a.timestamp.getTime() - b.timestamp.getTime()
    );

    const actionIds = sorted.map(
      (action) => action.id
    );

    if (
      sorted.every(
        (action) =>
          action.type === "folder_create"
      )
    ) {
      groups.push({
        label: `Create folder: ${path}`,
        actionIds,
        patch: null,
      });

      continue;
    }

    const { before, after } =
      composeBeforeAfter(sorted);

    const patch = formatFileDiff(
  path,
  before,
  after
);

    const kind = [
      ...new Set(
        sorted.map(
          (action) => action.type
        )
      ),
    ].join(", ");

    groups.push({
      label: `${path} (${kind})`,
      actionIds,
      patch,
    });
  }

  for (const shell of shells) {
    groups.push({
      label: `Shell: ${
        shell.details.command ?? 
        "(no command)"
      }`,
      actionIds: [shell.id],
      patch: null,
    });
  }

  return groups;
}

  
export async function runApprovalFlow(
  tracker: ActionTracker
): Promise<boolean> {
  const pending = tracker.getPendingMutations();

  if (pending.length) {
    console.log(
      chalk.dim(
        "\nNo staged file, folder, or shell changes to review.\n"
      )
    );

    return false;
  }

  const choice = await select({
    message: "Apply staged changes?",
    options: [
      {
        value: "all",
        label: "Approve and apply all",
      },
      {
        value: "select",
        label: "Review changes individually",
      },
      {
        value: "cancel",
        label: "Cancel",
      },
    ],
  });

  if (
    isCancel(choice) ||
    choice === "cancel"
  ) {
    for (const action of pending) {
      tracker.updateStatus(
        action.id,
        "rejected",
        false
      );
    }

    return false;
  }

  if (choice === "all") {
    for (const action of pending) {
      tracker.updateStatus(
        action.id,
        "approved",
        true
      );
    }

    return true;
  }

  const groups = groupPending(pending);

  for (const group of groups) {
    while (true) {
      const option = await select({
        message: chalk.bold(group.label),
        options: [
          {
            value: "accept",
            label: "Accept",
          },
          {
            value: "diff",
            label: "Show diff",
            hint: group.patch
              ? undefined
              : "N/A",
          },
          {
            value: "reject",
            label: "Reject",
          },
        ],
      });

      if (isCancel(option)) {
        for (const action of pending) {
          tracker.updateStatus(
            action.id,
            "rejected",
            false
          );
        }

        return false;
      }

      if (option === "diff") {
        if (group.patch) {
          console.log(
            "\n" +
              renderTerminalMarkdown(
                `\`\`\`diff
${group.patch}
\`\`\``
              ) +
              "\n"
          );
        }

        continue;
      }

      const approved =
        option === "accept";

      for (const id of group.actionIds) {
        tracker.updateStatus(
          id,
          approved
            ? "approved"
            : "rejected",
          approved
        );
      }

      break;
    }
  }

  return tracker
    .getActions()
    .some(
      action =>
        action.status === "approved"
    );
}