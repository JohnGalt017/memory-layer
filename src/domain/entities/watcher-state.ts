export type WatcherStatus = "watching" | "stopped" | "error";
export type ProcessingModel = "haiku" | "sonnet" | "opus";

export interface WatcherState {
  projectName: string;
  path: string;
  processingModel: ProcessingModel;
  pollInterval: number;
  gitAvailable: boolean;
  status: WatcherStatus;
  reason?: string;
  lastProcessed?: string;
}

export interface PendingChangesIndex {
  type: "initial" | "incremental";
  since: string;
  gitAvailable: boolean;
  totalChanges: number;
  commits: CommitEntry[];
  hotFiles: HotFileEntry[];
  filesCreated: string[];
  filesDeleted: string[];
  branches: { created: string[]; deleted: string[] };
  snapshot?: InitialSnapshot;
  pending?: IncrementalChanges;
  droppedCommits?: number;
  droppedFiles?: number;
  warning?: string;
}

export interface CommitEntry {
  hash: string;
  message: string;
  filesCount: number;
  tokens: string;
}

export interface HotFileEntry {
  path: string;
  changeCount: number;
  tokens: string;
}

export interface InitialSnapshot {
  readme: string;
  manifest: Record<string, unknown>;
  fileTree: string[];
  gitLog: CommitEntry[];
  branches: string[];
  gitStatus: { modified: string[]; untracked: string[]; deleted: string[] };
}

export interface IncrementalChanges {
  commits: CommitEntry[];
  filesChanged: Record<string, { changeCount: number }>;
  filesCreated: string[];
  filesDeleted: string[];
  branches: { created: string[]; deleted: string[] };
}

export interface GitState {
  lastRev: string;
  lastBranches: string[];
  lastStatus: { modified: string[]; untracked: string[]; deleted: string[] };
}

export interface FsSnapshot {
  files: Record<string, { mtime: number; size: number }>;
}
