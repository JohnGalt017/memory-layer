import {
  ProcessInboxUseCase,
  ProcessInboxParams,
  ProcessInboxResult,
} from "../../../domain/usecases/process-inbox.js";
import { WatcherConfigRepository } from "../../protocols/watcher-config-repository.js";
import { PendingChangesRepository } from "../../protocols/pending-changes-repository.js";
import { PendingChangesIndex } from "../../../domain/entities/watcher-state.js";

const EMPTY_INDEX: PendingChangesIndex = {
  type: "incremental",
  since: new Date(0).toISOString(),
  gitAvailable: false,
  totalChanges: 0,
  commits: [],
  hotFiles: [],
  filesCreated: [],
  filesDeleted: [],
  branches: { created: [], deleted: [] },
};

export class ProcessInbox implements ProcessInboxUseCase {
  constructor(
    private readonly configRepo: WatcherConfigRepository,
    private readonly pendingRepo: PendingChangesRepository
  ) {}

  async processInbox(params: ProcessInboxParams): Promise<ProcessInboxResult> {
    const all = await this.configRepo.loadAll();
    const config = all[params.projectName];
    if (!config) {
      throw new Error(`watcher not found: ${params.projectName}`);
    }

    const pending = await this.pendingRepo.load(params.projectName);

    return {
      processingModel: config.processingModel,
      gitAvailable: config.gitAvailable,
      index: pending ?? { ...EMPTY_INDEX, gitAvailable: config.gitAvailable },
    };
  }
}
