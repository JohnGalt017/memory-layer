import { WatcherConfigRepository } from "../../data/protocols/watcher-config-repository.js";
import { WatcherRegistry } from "./watcher-registry.js";

export class WatcherBootstrap {
  constructor(
    private readonly configRepo: WatcherConfigRepository,
    private readonly registry: WatcherRegistry
  ) {}

  async restore(): Promise<void> {
    const configs = await this.configRepo.loadAll();
    for (const [projectName, state] of Object.entries(configs)) {
      if (state.status === "watching") {
        try {
          await this.registry.start(state);
        } catch (error) {
          console.error(
            `[watcher] failed to restore ${projectName}:`,
            error
          );
        }
      }
    }
  }
}
