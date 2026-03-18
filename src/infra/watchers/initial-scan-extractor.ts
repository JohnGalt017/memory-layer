import fs from "fs-extra";
import path from "path";
import type {
  InitialSnapshot,
  CommitEntry,
} from "../../domain/entities/watcher-state.js";
import type { WatchIgnore } from "../security/watch-ignore.js";
import { runGit } from "./git-utils.js";

async function readReadme(projectPath: string): Promise<string> {
  const readmePath = path.join(projectPath, "README.md");
  try {
    const exists = await fs.pathExists(readmePath);
    if (!exists) return "";
    const content = await fs.readFile(readmePath, "utf-8");
    const lines = content.split("\n");
    return lines.slice(0, 200).join("\n");
  } catch {
    return "";
  }
}

async function readManifest(
  projectPath: string
): Promise<Record<string, unknown>> {
  // package.json
  const packageJsonPath = path.join(projectPath, "package.json");
  if (await fs.pathExists(packageJsonPath)) {
    try {
      const raw = await fs.readJSON(packageJsonPath);
      const deps = raw.dependencies ?? {};
      const devDeps = raw.devDependencies ?? {};
      const allDeps = { ...deps, ...devDeps };
      const top20 = Object.fromEntries(Object.entries(allDeps).slice(0, 20));
      return {
        name: raw.name,
        description: raw.description,
        dependencies: top20,
      };
    } catch {
      // fall through
    }
  }

  // Cargo.toml
  const cargoTomlPath = path.join(projectPath, "Cargo.toml");
  if (await fs.pathExists(cargoTomlPath)) {
    try {
      const content = await fs.readFile(cargoTomlPath, "utf-8");
      const nameMatch = content.match(/^name\s*=\s*"([^"]+)"/m);
      const descMatch = content.match(/^description\s*=\s*"([^"]+)"/m);
      return {
        name: nameMatch?.[1] ?? "",
        description: descMatch?.[1] ?? "",
      };
    } catch {
      // fall through
    }
  }

  // go.mod
  const goModPath = path.join(projectPath, "go.mod");
  if (await fs.pathExists(goModPath)) {
    try {
      const content = await fs.readFile(goModPath, "utf-8");
      const moduleMatch = content.match(/^module\s+(.+)$/m);
      return {
        name: moduleMatch?.[1] ?? "",
        description: "",
      };
    } catch {
      // fall through
    }
  }

  return {};
}

async function buildFileTree(
  projectPath: string,
  watchIgnore: WatchIgnore
): Promise<string[]> {
  const tree: string[] = [];

  async function scanLevel(
    currentPath: string,
    relativeTo: string,
    depth: number
  ): Promise<void> {
    if (depth > 2) return;

    let entries: fs.Dirent[];
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const relativePath = path.relative(
        relativeTo,
        path.join(currentPath, entry.name)
      );

      if (entry.isDirectory()) {
        const dirRel = relativePath + "/";
        if (
          watchIgnore.isIgnored(dirRel) ||
          watchIgnore.isIgnored(relativePath)
        ) {
          continue;
        }
        tree.push(dirRel);
        await scanLevel(
          path.join(currentPath, entry.name),
          relativeTo,
          depth + 1
        );
      } else if (entry.isFile()) {
        if (!watchIgnore.isIgnored(relativePath)) {
          tree.push(relativePath);
        }
      }
    }
  }

  await scanLevel(projectPath, projectPath, 1);
  return tree;
}

function parseGitLog(output: string): CommitEntry[] {
  if (!output) return [];
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const spaceIdx = line.indexOf(" ");
      const hash = spaceIdx === -1 ? line : line.substring(0, spaceIdx);
      const message = spaceIdx === -1 ? "" : line.substring(spaceIdx + 1).trim();
      return {
        hash,
        message,
        filesCount: 0,
        tokens: `~${Math.ceil(message.length / 4)}`,
      };
    });
}

function parseBranches(output: string): string[] {
  if (!output) return [];
  return output
    .split("\n")
    .map((line) => line.replace(/^\*/, "").trim())
    .filter(Boolean);
}

function parseStatus(output: string | null): {
  modified: string[];
  untracked: string[];
  deleted: string[];
} {
  if (!output) return { modified: [], untracked: [], deleted: [] };

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

export class InitialScanExtractor {
  constructor(private readonly watchIgnore: WatchIgnore) {}

  async extract(projectPath: string): Promise<InitialSnapshot> {
    const [readme, manifest, fileTree] = await Promise.all([
      readReadme(projectPath),
      readManifest(projectPath),
      buildFileTree(projectPath, this.watchIgnore),
    ]);

    const [logOutput, branchesOutput, statusOutput] = await Promise.all([
      runGit(projectPath, "log --oneline -20"),
      runGit(projectPath, "branch -a"),
      runGit(projectPath, "status --porcelain", false),
    ]);

    const gitLog = parseGitLog(logOutput ?? "");
    const branches = parseBranches(branchesOutput ?? "");
    const gitStatus = parseStatus(statusOutput);

    return {
      readme,
      manifest,
      fileTree,
      gitLog,
      branches,
      gitStatus,
    };
  }
}
