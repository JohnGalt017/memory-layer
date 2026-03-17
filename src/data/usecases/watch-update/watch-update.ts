import {
  WatchUpdateUseCase,
  WatchUpdateParams,
  WatchUpdateResult,
} from "../../../domain/usecases/watch-update.js";
import { WatcherConfigRepository } from "../../protocols/watcher-config-repository.js";
import { WatcherRegistry } from "../../../main/services/watcher-registry.js";

export class WatchUpdate implements WatchUpdateUseCase {
  constructor(
    private readonly configRepo: WatcherConfigRepository,
    private readonly registry: WatcherRegistry
  ) {}

  async watchUpdate(params: WatchUpdateParams): Promise<WatchUpdateResult> {
    const all = await this.configRepo.loadAll();
    const existing = all[params.projectName];
    if (!existing) {
      throw new Error(`watcher not found: ${params.projectName}`);
    }

    const partial: Partial<typeof existing> = {};
    if (params.processingModel !== undefined) {
      partial.processingModel = params.processingModel;
    }
    if (params.pollInterval !== undefined) {
      partial.pollInterval = params.pollInterval;
    }

    await this.configRepo.update(params.projectName, partial);
    this.registry.updateConfig(params.projectName, partial);

    return { status: "updated" };
  }
}
