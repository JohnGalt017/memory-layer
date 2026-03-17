import { FsSnapshot } from "../../domain/entities/watcher-state.js";

export interface FsSnapshotRepository {
  load(projectName: string): Promise<FsSnapshot | null>;
  save(projectName: string, snapshot: FsSnapshot): Promise<void>;
}
