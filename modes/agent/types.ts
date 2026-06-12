export type ActionType =
  | "file_create"
  | "file_modify"
  | "file_delete"
  | "folder_create"
  | "shell_execute"
  | "tool_execute"
  | "code_analysis";

export type ActionStatus =
  | "pending"
  | "approved"
  | "executed"
  | "rejected"
  | "failed";

export type AgentState =
  | "idle"
  | "thinking"
  | "planning"
  | "executing"
  | "waiting_for_approval"
  | "error";

export interface ActionDetails {
  before?: string;
  after?: string;
  toolName?: string;
  toolResult?: string;
  error?: string;
  command?:string;
}

export interface ActionLog {
  id: string;
  timestamp: Date;
  type: ActionType;
  path: string;
  details: ActionDetails;
  status: ActionStatus;
  userApproved?: boolean;
}

export interface ToolPermissions {
  allowShellExecution: boolean;
  allowFileModification: boolean;
  allowFileCreation: boolean;
  allowFolderCreation: boolean;
}

export interface AgentConfig {
  codebasePath: string;
  maxFileSizeRead: number;
  excludePatterns: string[];
  tools: ToolPermissions;
}

export interface ToolExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  durationMs: number;
}

export interface AgentContext {
  state: AgentState;
  config: AgentConfig;
  history: ActionLog[];
}

export const DEFAULT_EXCLUDE_PATTERNS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "*.log",
  ".env",
] as const;

export function DefaultAgentConfig(): AgentConfig {
  return {
    codebasePath: process.cwd(),
    maxFileSizeRead: 1024 * 1024,
    excludePatterns: [...DEFAULT_EXCLUDE_PATTERNS],
    tools: {
      allowShellExecution: true,
      allowFileModification: true,
      allowFileCreation: true,
      allowFolderCreation: true,
    },
  };
}

export function isMutationAction(type: ActionType):boolean{
  return [
    "file_create",
    "file_modify",
    "file_delete",
    "folder_create",
    "tool_execute"
  ].includes(type);
}