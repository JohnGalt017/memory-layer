import type { CommitEntry } from "../../domain/entities/watcher-state.js";
import { runGit } from "./git-utils.js";

const REF_REGEX = /^[a-f0-9]{4,40}$/;
const PATH_REGEX = /^[a-zA-Z0-9_.\/\-]+$/;

function sanitizeRef(ref: string): string | null {
  if (!REF_REGEX.test(ref)) return null;
  return ref;
}

function sanitizePath(filePath: string): string | null {
  if (filePath.includes("..")) return null;
  if (!PATH_REGEX.test(filePath)) return null;
  return filePath;
}

function parseFilesChanged(lines: string[]): number {
  for (const line of lines) {
    const match = line.match(/^\s*(\d+)\s+file(?:s)?\s+changed/);
    if (match) return parseInt(match[1], 10);
  }
  return 0;
}

export class GitPoller {
  constructor(private readonly projectPath: string) {}

  async getHeadRev(): Promise<string | null> {
    return runGit(this.projectPath, "rev-parse HEAD");
  }

  async getCommitsBetween(
    oldRev: string,
    newRev: string
  ): Promise<CommitEntry[]> {
    const safeOld = sanitizeRef(oldRev);
    const safeNew = sanitizeRef(newRev);
    if (!safeOld || !safeNew) return [];

    const output = await runGit(
      this.projectPath,
      `log ${safeOld}..${safeNew} --oneline --stat`
    );
    if (!output) return [];

    const commits: CommitEntry[] = [];
    const lines = output.split("\n");
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();
      if (!line) { i++; continue; }

      const headerMatch = line.match(/^([a-f0-9]+)\s+(.+)$/);
      if (!headerMatch) { i++; continue; }

      const hash = headerMatch[1];
      const message = headerMatch[2];
      i++;

      const statLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== "") {
        statLines.push(lines[i]);
        i++;
      }

      const filesCount = parseFilesChanged(statLines);

      commits.push({
        hash,
        message,
        filesCount,
        tokens: `~${Math.ceil(message.length / 4)}`,
      });
    }

    return commits;
  }

  async getStatus(): Promise<{ modified: string[]; untracked: string[]; deleted: string[] }> {
    const output = await runGit(
      this.projectPath,
      "status --porcelain",
      false
    );
    if (output === null) return { modified: [], untracked: [], deleted: [] };

    const modified: string[] = [];
    const untracked: string[] = [];
    const deleted: string[] = [];

    for (const line of output.split("\n")) {
      if (!line) continue;
      const code = line.substring(0, 2);
      const filePath = line.substring(3).trim();
      if (code === "??") {
        untracked.push(filePath);
      } else if (code[0] === "D" || code[1] === "D") {
        deleted.push(filePath);
      } else if (
        code.includes("M") ||
        code[0] === "A" ||
        code[1] === "A" ||
        code[0] === "R" ||
        code[1] === "R"
      ) {
        modified.push(filePath);
      }
    }

    return { modified, untracked, deleted };
  }

  async getBranches(): Promise<string[]> {
    const output = await runGit(this.projectPath, "branch -a");
    if (!output) return [];

    return output
      .split("\n")
      .map((line) => line.replace(/^\*/, "").trim())
      .filter(Boolean);
  }

  async getCommitDetail(hash: string): Promise<string | null> {
    const safeHash = sanitizeRef(hash);
    if (!safeHash) return null;
    return runGit(
      this.projectPath,
      `log -1 -p --format="%H%n%an%n%aI%n%s" ${safeHash}`,
      false
    );
  }

  async getFileDiff(fromRev: string, filePath: string): Promise<string | null> {
    const safeRev = sanitizeRef(fromRev);
    const safePath = sanitizePath(filePath);
    if (!safeRev || !safePath) return null;
    return runGit(
      this.projectPath,
      `diff ${safeRev}~1 ${safeRev} -- ${safePath}`
    );
  }
}
