import {
  WatchStopUseCase,
  WatchStopParams,
  WatchStopResult,
} from "../../../domain/usecases/watch-stop.js";
import { WatcherConfigRepository } from "../../protocols/watcher-config-repository.js";
import { WatcherRegistry } from "../../../main/services/watcher-registry.js";

export class WatchStop implements WatchStopUseCase {
  constructor(
    private readonly configRepo: WatcherConfigRepository,
    private readonly registry: WatcherRegistry
  ) {}

  async watchStop(params: WatchStopParams): Promise<WatchStopResult> {
    await this.configRepo.update(params.projectName, { status: "stopped" });
    await this.registry.stop(params.projectName);
    return { status: "stopped" };
  }
}
