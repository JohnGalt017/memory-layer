import { PendingChangesIndex } from "../../domain/entities/watcher-state.js";

export interface PendingChangesRepository {
  load(projectName: string): Promise<PendingChangesIndex | null>;
  save(projectName: string, changes: PendingChangesIndex): Promise<void>;
  clear(projectName: string): Promise<void>;
  countChanges(projectName: string): Promise<number>;
}
