import fs from "fs-extra";
import path from "path";
import { PendingChangesRepository } from "../../../data/protocols/pending-changes-repository.js";
import { PendingChangesIndex } from "../../../domain/entities/watcher-state.js";

export class FsPendingChangesRepository implements PendingChangesRepository {
  constructor(private readonly rootDir: string) {}

  private filePath(projectName: string): string {
    return path.join(this.rootDir, ".watchers", projectName, "pending-changes.json");
  }

  async load(projectName: string): Promise<PendingChangesIndex | null> {
    try {
      const filePath = this.filePath(projectName);
      if (!(await fs.pathExists(filePath))) return null;
      return await fs.readJson(filePath);
    } catch {
      return null;
    }
  }

  async save(projectName: string, changes: PendingChangesIndex): Promise<void> {
    const filePath = this.filePath(projectName);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeJson(filePath, changes, { spaces: 2 });
  }

  async clear(projectName: string): Promise<void> {
    const filePath = this.filePath(projectName);
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
    }
  }

  async countChanges(projectName: string): Promise<number> {
    const changes = await this.load(projectName);
    return changes?.totalChanges ?? 0;
  }
}
