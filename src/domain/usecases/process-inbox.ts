import { PendingChangesIndex } from "../entities/watcher-state.js";

export interface ProcessInboxParams {
  projectName: string;
}

export interface ProcessInboxResult {
  processingModel: string;
  gitAvailable: boolean;
  index: PendingChangesIndex;
}

export interface ProcessInboxUseCase {
  processInbox(params: ProcessInboxParams): Promise<ProcessInboxResult>;
}
