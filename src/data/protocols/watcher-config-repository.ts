import { WatcherState } from "../../domain/entities/watcher-state.js";

export interface WatcherConfigRepository {
  loadAll(): Promise<Record<string, WatcherState>>;
  save(projectName: string, state: WatcherState): Promise<void>;
  update(projectName: string, partial: Partial<WatcherState>): Promise<void>;
  remove(projectName: string): Promise<void>;
}
