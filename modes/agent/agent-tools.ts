import {tool} from 'ai';
import zod, { z } from 'zod';
import type {ToolExecutor } from './tool-executer'
import { p } from 'framer-motion/client';

export function createAgentTools(executer:ToolExecutor){
return {
    read_file: tool({
      description: "Read a file from the workspace safely",
      inputSchema: z.object({
        path: z.string().describe("File path relative to workspace"),
      }),
      execute: async ({ path }) => executer.readFile(path),
    }),

    create_file: tool({
      description: "Create a new file with content",
      inputSchema: z.object({
        path: z.string(),
        content: z.string(),
      }),
      execute: async ({ path, content }) =>
        executer.createFile(path, content),
    }),

    modify_file: tool({
      description: "Modify an existing file",
      inputSchema: z.object({
        path: z.string(),
        content: z.string(),
      }),
      execute: async ({ path, content }) =>
        executer.modifyFile(path, content),
    }),

    delete_file: tool({
      description: "Delete a file from workspace",
      inputSchema: z.object({
        path: z.string(),
      }),
      execute: async ({ path }) => executer.deleteFile(path),
    }),

    /**
     * =========================================================
     * FOLDER OPERATIONS
     * =========================================================
     */

    create_folder: tool({
      description: "Create a folder recursively",
      inputSchema: z.object({
        path: z.string(),
      }),
      execute: async ({ path }) => executer.createFolder(path),
    }),

    delete_folder: tool({
      description: "Delete a folder recursively",
      inputSchema: z.object({
        path: z.string(),
      }),
      execute: async ({ path }) => executer.deleteFolder(path),
    }),

    list_files: tool({
      description: "List files in a directory",
      inputSchema: z.object({
        path: z.string().default("."),
        recursive: z.boolean().default(true),
      }),
      execute: async ({ path, recursive }) =>
        executer.listFiles(path, recursive),
    }),

    /**
     * =========================================================
     * SEARCH & ANALYSIS
     * =========================================================
     */

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
      execute: async (input) => executer.searchFiles(input),
    }),

    analyze_codebase: tool({
      description: "Analyze full project structure and statistics",
      inputSchema: z.object({
        root: z.string().default("."),
      }),
      execute: async ({ root }) => executer.analyzeCodebase(root),
    }),

    /**
     * =========================================================
     * SHELL EXECUTION
     * =========================================================
     */

    execute_shell: tool({
      description: "Run shell commands safely in queue",
      inputSchema: z.object({
        command: z.string(),
      }),
      execute: async ({ command }) =>
        executer.queueShell(command),
    }),

    /**
     * =========================================================
     * SKILL SYSTEM
     * =========================================================
     */

    list_skills: tool({
      description: "List all registered agent skills",
      inputSchema: z.object({}),
      execute: async () => executer.listSkills(),
    }),

    run_skill: tool({
      description: "Execute a registered skill",
      inputSchema: z.object({
        name: z.string(),
        args: z.any().optional(),
      }),
      execute: async ({ name, args }) =>
        executer.runSkill(name, args),
    }),

    read_skills: tool({
      description: "Read available skill files from skills directory",
      inputSchema: z.object({
        dir: z.string().default("skills"),
      }),
      execute: async ({ dir }) => executer.readSkills(dir),
    }),
  


};
}