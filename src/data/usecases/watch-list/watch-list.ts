import {
  WatchListUseCase,
  WatchListEntry,
} from "../../../domain/usecases/watch-list.js";
import { WatcherConfigRepository } from "../../protocols/watcher-config-repository.js";
import { PendingChangesRepository } from "../../protocols/pending-changes-repository.js";
import { WatcherRegistry } from "../../../main/services/watcher-registry.js";

export class WatchList implements WatchListUseCase {
  constructor(
    private readonly configRepo: WatcherConfigRepository,
    private readonly pendingRepo: PendingChangesRepository,
    private readonly registry: WatcherRegistry
  ) {}

  async watchList(): Promise<WatchListEntry[]> {
    const configs = await this.configRepo.loadAll();
    const entries: WatchListEntry[] = [];

    for (const [projectName, state] of Object.entries(configs)) {
      const pendingChangesCount = await this.pendingRepo.countChanges(projectName);
      const uptime = this.registry.getUptime(projectName);
      entries.push({
        ...state,
        pendingChangesCount,
        uptime,
      });
    }

    return entries;
  }
}
