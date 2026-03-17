import fs from "fs-extra";
import path from "path";
import { FsSnapshotRepository } from "../../../data/protocols/fs-snapshot-repository.js";
import { FsSnapshot } from "../../../domain/entities/watcher-state.js";

export class FsSnapshotRepositoryImpl implements FsSnapshotRepository {
  constructor(private readonly rootDir: string) {}

  private filePath(projectName: string): string {
    return path.join(this.rootDir, ".watchers", projectName, "last-snapshot.json");
  }

  async load(projectName: string): Promise<FsSnapshot | null> {
    try {
      const filePath = this.filePath(projectName);
      if (!(await fs.pathExists(filePath))) return null;
      return await fs.readJson(filePath);
    } catch {
      return null;
    }
  }

  async save(projectName: string, snapshot: FsSnapshot): Promise<void> {
    const filePath = this.filePath(projectName);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeJson(filePath, snapshot, { spaces: 2 });
  }
}
