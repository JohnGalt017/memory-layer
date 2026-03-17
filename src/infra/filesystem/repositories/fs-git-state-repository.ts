import fs from "fs-extra";
import path from "path";
import { GitStateRepository } from "../../../data/protocols/git-state-repository.js";
import { GitState } from "../../../domain/entities/watcher-state.js";

export class FsGitStateRepository implements GitStateRepository {
  constructor(private readonly rootDir: string) {}

  private filePath(projectName: string): string {
    return path.join(this.rootDir, ".watchers", projectName, "git-state.json");
  }

  async load(projectName: string): Promise<GitState | null> {
    try {
      const filePath = this.filePath(projectName);
      if (!(await fs.pathExists(filePath))) return null;
      return await fs.readJson(filePath);
    } catch {
      return null;
    }
  }

  async save(projectName: string, state: GitState): Promise<void> {
    const filePath = this.filePath(projectName);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeJson(filePath, state, { spaces: 2 });
  }

  async clear(projectName: string): Promise<void> {
    const filePath = this.filePath(projectName);
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
    }
  }
}
