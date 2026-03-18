import { GitState } from "../../domain/entities/watcher-state.js";

export interface GitStateRepository {
  load(projectName: string): Promise<GitState | null>;
  save(projectName: string, state: GitState): Promise<void>;
  clear(projectName: string): Promise<void>;
}
