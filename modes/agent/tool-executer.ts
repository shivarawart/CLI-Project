import fs from "node:fs";
import path from "node:path";
import type { AgentConfig, ActionLog, ActionStatus } from "./types";
import { ActionTracker } from "./action-tracker";

/**
 * =========================================================
 * TEXT FILE DETECTION
 * =========================================================
 */
export const TEXT_EXTENSIONS = new Set<string>([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".html", ".css", ".scss", ".sass", ".less",
  ".json", ".jsonc", ".yaml", ".yml", ".xml", ".toml",
  ".md", ".mdx", ".txt", ".rst",
  ".java", ".kt", ".kts", ".go", ".rs", ".py", ".rb", ".php", ".cs",
  ".c", ".h", ".cpp", ".hpp", ".cc", ".cxx",
  ".sh", ".bash", ".zsh", ".fish",
  ".sql",
  ".env", ".gitignore", ".dockerignore", ".editorconfig",
  ".graphql", ".gql",
]);

function isTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext) || ext === "";
}

/**
 * =========================================================
 * TOOL EXECUTOR
 * =========================================================
 */
export class ToolExecutor {
  private memory = new Map<string, string>();
  private deleted = new Set<string>();
  private readonly overlay = new Map<string, string>();


  constructor(
    private readonly tracker: ActionTracker,
    private readonly config: AgentConfig
  ) {}

  /**
   * Normalize path for internal tracking
   */
  private normalize(rel: string): string {
    return path.posix.normalize(rel.split(path.sep).join("/")).replace(/^\//, "");
  }

  /**
   * Resolve safely inside workspace (prevents path escape attacks)
   */
  private resolveSafe(rel: string): string {
    const root = path.resolve(this.config.codebasePath);
    const target = path.resolve(root, rel);

    const relative = path.relative(root, target);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Path escape detected: ${rel}`);
    }

    return target;
  }

  /**
   * Check exclusion rules
   */
  private isExcluded(rel: string): boolean {
    const norm = this.normalize(rel);
    const base = path.basename(norm);

    for (const pattern of this.config.excludePatterns) {
      if (pattern === "*.log" && base.endsWith(".log")) return true;
      if (pattern === ".env*" && base.startsWith(".env")) return true;

      if (!pattern.includes("*")) {
        if (norm === pattern || norm.startsWith(`${pattern}/`)) {
          return true;
        }
      }
    }

    return false;
  }

  private assertAllowed(rel: string, op: string): void {
    if (this.isExcluded(rel)) {
      throw new Error(`[${op}] blocked by policy: ${rel}`);
    }
  }

  /**
   * Get latest effective file content (memory > disk)
   */
  private getContent(rel: string): string | undefined {
    const key = this.normalize(rel);

    if (this.deleted.has(key)) return undefined;
    if (this.memory.has(key)) return this.memory.get(key);

    const abs = this.resolveSafe(rel);

    if (!fs.existsSync(abs)) return undefined;
    if (!fs.statSync(abs).isFile()) return undefined;

    return fs.readFileSync(abs, "utf8");
  }

  // =========================================================
  // FILE OPERATIONS
  // =========================================================

  readFile(rel: string): string {
    this.assertAllowed(rel, "READ_FILE");

    const content = this.getContent(rel);
    if (content === undefined) {
      throw new Error(`File not found: ${rel}`);
    }

    return content;
  }

  createFile(rel: string, content: string): string {
    this.assertAllowed(rel, "CREATE_FILE");

    const abs = this.resolveSafe(rel);

    if (fs.existsSync(abs)) {
      throw new Error(`File already exists: ${rel}`);
    }

    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");

    const key = this.normalize(rel);
    this.memory.set(key, content);
    this.deleted.delete(key);

    return `created:${rel}`;
  }

  modifyFile(rel: string, content: string): string {
    this.assertAllowed(rel, "MODIFY_FILE");

    const abs = this.resolveSafe(rel);

    if (!fs.existsSync(abs)) {
      throw new Error(`File does not exist: ${rel}`);
    }

    fs.writeFileSync(abs, content, "utf8");

    this.memory.set(this.normalize(rel), content);

    return `modified:${rel}`;
  }

  deleteFile(rel: string): string {
    this.assertAllowed(rel, "DELETE_FILE");

    const abs = this.resolveSafe(rel);

    if (fs.existsSync(abs)) {
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) {
        throw new Error(`Expected file but got directory: ${rel}`);
      }

      fs.unlinkSync(abs);
    }

    const key = this.normalize(rel);
    this.deleted.add(key);
    this.memory.delete(key);

    return `deleted:${rel}`;
  }

  // =========================================================
  // FOLDER OPERATIONS
  // =========================================================

  createFolder(rel: string): string {
    this.assertAllowed(rel, "CREATE_FOLDER");

    const abs = this.resolveSafe(rel);

    fs.mkdirSync(abs, { recursive: true });

    return `folder_created:${rel}`;
  }

  deleteFolder(rel: string): string {
    this.assertAllowed(rel, "DELETE_FOLDER");

    const abs = this.resolveSafe(rel);

    if (fs.existsSync(abs)) {
      fs.rmSync(abs, { recursive: true, force: true });
    }

    return `folder_deleted:${rel}`;
  }

  // =========================================================
  // LIST FILES
  // =========================================================

  listFiles(rel: string = ".", recursive = false): string[] {
    this.assertAllowed(rel, "LIST_FILES");

    const abs = this.resolveSafe(rel);

    if (!fs.existsSync(abs)) {
      throw new Error(`Path not found: ${rel}`);
    }

    const result: string[] = [];

    const walk = (dir: string) => {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const full = path.join(dir, item);
        const stat = fs.statSync(full);

        const relative = path.relative(this.config.codebasePath, full);

        if (stat.isDirectory()) {
          if (recursive) walk(full);
        } else {
          result.push(relative);
        }
      }
    };

    walk(abs);

    return result;
  }

 searchFiles(options: {
  query: string;
  root?: string;
  recursive?: boolean;
  matchContent?: boolean;
  matchFileName?: boolean;
  limit?: number;
}): any[] {
  const {
    query,
    root = ".",
    recursive = true,
    matchContent = true,
    matchFileName = true,
    limit = 50,
  } = options;

  const results: any[] = [];
  const absRoot = this.resolveSafe(root);

  const q = query.toLowerCase();

  const walk = (dir: string) => {
    if (results.length >= limit) return;

    const items = fs.readdirSync(dir);

    for (const item of items) {
      if (results.length >= limit) return;

      const full = path.join(dir, item);
      const rel = path.relative(this.config.codebasePath, full);

      if (this.isExcluded(rel)) continue;

      const stat = fs.statSync(full);

      if (stat.isDirectory()) {
        if (recursive) walk(full);
        continue;
      }

      // filename match
      if (matchFileName && item.toLowerCase().includes(q)) {
        results.push({ file: rel, type: "filename" });
      }

      // content match
      if (matchContent && isTextFile(full)) {
        try {
          const content = fs.readFileSync(full, "utf8");
          if (content.toLowerCase().includes(q)) {
            results.push({ file: rel, type: "content" });
          }
        } catch {}
      }
    }
  };

  walk(absRoot);

  return results;
}
analyzeCodebase(root: string = "."): any {
  const absRoot = this.resolveSafe(root);

  const stats = {
    files: 0,
    folders: 0,
    extensions: new Map<string, number>(),
    largeFiles: [] as string[],
  };

  const walk = (dir: string) => {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const full = path.join(dir, item);
      const rel = path.relative(this.config.codebasePath, full);

      if (this.isExcluded(rel)) continue;

      const stat = fs.statSync(full);

      if (stat.isDirectory()) {
        stats.folders++;
        walk(full);
      } else {
        stats.files++;

        const ext = path.extname(item) || "no-ext";
        stats.extensions.set(
          ext,
          (stats.extensions.get(ext) || 0) + 1
        );

        if (stat.size > 1024 * 1024) {
          stats.largeFiles.push(rel);
        }
      }
    }
  };

  walk(absRoot);

  return {
    summary: {
      totalFiles: stats.files,
      totalFolders: stats.folders,
    },
    extensions: Object.fromEntries(stats.extensions),
    largeFiles: stats.largeFiles,
  };
}
private shellQueue: Promise<any> = Promise.resolve();

queueShell(command: string): Promise<string> {
  this.shellQueue = this.shellQueue.then(async () => {
    return new Promise((resolve, reject) => {
      const child = require("node:child_process").spawn(command, {
        shell: true,
        cwd: this.config.codebasePath,
        stdio: "pipe",
      });

      let output = "";
      let error = "";

      child.stdout.on("data", (d: Buffer) => {
        output += d.toString();
      });

      child.stderr.on("data", (d: Buffer) => {
        error += d.toString();
      });

      child.on("close", () => {
        if (error) return reject(error);
        resolve(output);
      });
    });
  });

  return this.shellQueue;
}
private skills = new Map<string, Function>();

registerSkill(name: string, fn: Function) {
  this.skills.set(name, fn);
}

listSkills(): string[] {
  return [...this.skills.keys()];
}

runSkill(name: string, ...args: any[]) {
  const skill = this.skills.get(name);

  if (!skill) {
    throw new Error(`Skill not found: ${name}`);
  }

  return skill(...args);
}
readSkills(dir: string = "skills"): string[] {
  const abs = this.resolveSafe(dir);

  if (!fs.existsSync(abs)) return [];

  return fs
    .readdirSync(abs)
    .filter((f) => f.endsWith(".js") || f.endsWith(".ts"))
    .map((f) => path.join(dir, f));
}
applyApprovedFromTracker(): { errors: string[] } {
  const errors: string[] = [];
  const actions = this.tracker.getActions();

  for (const action of actions) {
    if (action.status !== "approved") continue;

    try {
      switch (action.type) {
        case "file_create":
          this.createFile(action.path, action.details.after ?? "");
          break;

        case "file_modify":
          this.modifyFile(action.path, action.details.after ?? "");
          break;

        default:
          errors.push(
            `Unsupported action type "${action.type}" for action ${action.id}`
          );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      errors.push(`Action ${action.id}: ${message}`);
    }
  }

  return { errors };
}

 clearStaging(): void {
  this.overlay.clear();
  this.deleted.clear();
}

}