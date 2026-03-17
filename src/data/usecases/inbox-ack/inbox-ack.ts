import {
  InboxAckUseCase,
  InboxAckParams,
  InboxAckResult,
} from "../../../domain/usecases/inbox-ack.js";
import { PendingChangesRepository } from "../../protocols/pending-changes-repository.js";
import { WatcherConfigRepository } from "../../protocols/watcher-config-repository.js";
import { GitStateRepository } from "../../protocols/git-state-repository.js";

export class InboxAck implements InboxAckUseCase {
  constructor(
    private readonly pendingRepo: PendingChangesRepository,
    private readonly configRepo: WatcherConfigRepository,
    private readonly gitStateRepo: GitStateRepository
  ) {}

  async inboxAck(params: InboxAckParams): Promise<InboxAckResult> {
    const lastProcessed = new Date().toISOString();

    await this.pendingRepo.clear(params.projectName);
    await this.configRepo.update(params.projectName, { lastProcessed });

    return { status: "acknowledged", lastProcessed };
  }
}
