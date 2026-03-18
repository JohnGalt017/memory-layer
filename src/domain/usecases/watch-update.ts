import { ProcessingModel } from "../entities/watcher-state.js";

export interface WatchUpdateParams {
  projectName: string;
  processingModel?: ProcessingModel;
  pollInterval?: number;
}

export interface WatchUpdateResult {
  status: "updated";
}

export interface WatchUpdateUseCase {
  watchUpdate(params: WatchUpdateParams): Promise<WatchUpdateResult>;
}
