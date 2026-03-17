import { ProcessingModel } from "../entities/watcher-state.js";

export interface WatchStartParams {
  path: string;
  projectName: string;
  processingModel?: ProcessingModel;
  pollInterval?: number;
}

export interface WatchStartResult {
  status: "watching";
  gitAvailable: boolean;
  hasPendingChanges: boolean;
  warning?: string;
}

export interface WatchStartUseCase {
  watchStart(params: WatchStartParams): Promise<WatchStartResult>;
}
