import fs from "fs-extra";
import path from "path";
import { WatcherConfigRepository } from "../../../data/protocols/watcher-config-repository.js";
import { WatcherState } from "../../../domain/entities/watcher-state.js";

export class FsWatcherConfigRepository implements WatcherConfigRepository {
  private readonly configPath: string;

  constructor(rootDir: string) {
    this.configPath = path.join(rootDir, ".watchers", "config.json");
  }

  async loadAll(): Promise<Record<string, WatcherState>> {
    try {
      if (!(await fs.pathExists(this.configPath))) return {};
      return await fs.readJson(this.configPath);
    } catch {
      return {};
    }
  }

  async save(projectName: string, state: WatcherState): Promise<void> {
    const all = await this.loadAll();
    const updated = { ...all, [projectName]: state };
    await fs.ensureDir(path.dirname(this.configPath));
    await fs.writeJson(this.configPath, updated, { spaces: 2 });
  }

  async update(projectName: string, partial: Partial<WatcherState>): Promise<void> {
    const all = await this.loadAll();
    if (!all[projectName]) return;
    const updated = { ...all, [projectName]: { ...all[projectName], ...partial } };
    await fs.writeJson(this.configPath, updated, { spaces: 2 });
  }

  async remove(projectName: string): Promise<void> {
    const all = await this.loadAll();
    const { [projectName]: _, ...rest } = all;
    await fs.writeJson(this.configPath, rest, { spaces: 2 });
  }
}
