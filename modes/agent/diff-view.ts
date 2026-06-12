import { createTwoFilesPatch } from "diff";

import type {
  ActionLog,
} from "./types";

export interface FileSnapshot {
  before: string;
  after: string;
}

export function formatFileDiff(
  filePath: string,
  before: string,
  after: string
): string {
  return createTwoFilesPatch(
    filePath,
    filePath,
    before,
    after,
    "",
    "",
    {
      context: 3,
    }
  );
}

export function composeBeforeAfter(
  actions: readonly ActionLog[]
): {
  before: string;
  after: string;
} {
  if (actions.length === 0) {
    throw new Error(
      "composeBeforeAfter requires at least one action."
    );
  }

  const first = actions[0]!;
  const last = actions[actions.length - 1]!;

  if (last.type === "file_delete") {
    return {
      before: last.details.before ?? "",
      after: "",
    };
  }

  return {
    before:
      first.type === "file_create"
        ? ""
        : first.details.before ?? "",

    after: last.details.after ?? "",
  };
}