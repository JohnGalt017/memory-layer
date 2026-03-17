import { WatcherState } from "../entities/watcher-state.js";

export interface WatchListEntry extends WatcherState {
  pendingChangesCount: number;
  uptime: number;
}

export interface WatchListUseCase {
  watchList(): Promise<WatchListEntry[]>;
}
