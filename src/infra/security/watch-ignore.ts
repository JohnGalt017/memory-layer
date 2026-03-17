import ignore, { Ignore } from "ignore";
import path from "path";

const DEFAULT_BLACKLIST = [
  ".env*",
  "*.pem",
  "*.key",
  "*.p12",
  "*.pfx",
  "credentials*",
  "secrets*",
  ".aws/",
  ".ssh/",
];

export class WatchIgnore {
  private readonly ig: Ignore;

  constructor(
    watchignorePatterns: string[] = [],
    gitignorePatterns: string[] = []
  ) {
    this.ig = ignore();
    this.ig.add(DEFAULT_BLACKLIST);
    this.ig.add(gitignorePatterns);
    this.ig.add(watchignorePatterns);
  }

  static async fromProject(projectPath: string): Promise<WatchIgnore> {
    const fs = await import("fs-extra");
    let gitignorePatterns: string[] = [];
    let watchignorePatterns: string[] = [];

    const gitignorePath = path.join(projectPath, ".gitignore");
    if (await fs.pathExists(gitignorePath)) {
      const content = await fs.readFile(gitignorePath, "utf-8");
      gitignorePatterns = content
        .split("\n")
        .filter((l: string) => l.trim() && !l.startsWith("#"));
    }

    const watchignorePath = path.join(projectPath, ".watchignore");
    if (await fs.pathExists(watchignorePath)) {
      const content = await fs.readFile(watchignorePath, "utf-8");
      watchignorePatterns = content
        .split("\n")
        .filter((l: string) => l.trim() && !l.startsWith("#"));
    }

    return new WatchIgnore(watchignorePatterns, gitignorePatterns);
  }

  isIgnored(filePath: string): boolean {
    return this.ig.ignores(filePath);
  }

  isPathSafe(filePath: string, projectRoot: string): boolean {
    if (path.isAbsolute(filePath)) return false;
    const resolved = path.resolve(projectRoot, filePath);
    return resolved.startsWith(path.resolve(projectRoot) + path.sep) ||
      resolved === path.resolve(projectRoot);
  }
}
