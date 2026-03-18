import { WatcherState, PendingChangesIndex } from "../../domain/entities/watcher-state.js";
import { GitPoller } from "../../infra/watchers/git-poller.js";
import { FsPoller } from "../../infra/watchers/fs-poller.js";
import { WatchIgnore } from "../../infra/security/watch-ignore.js";
import { WatcherConfigRepository } from "../../data/protocols/watcher-config-repository.js";
import { PendingChangesRepository } from "../../data/protocols/pending-changes-repository.js";
import { GitStateRepository } from "../../data/protocols/git-state-repository.js";
import { FsSnapshotRepository } from "../../data/protocols/fs-snapshot-repository.js";
import fs from "fs-extra";

interface ActiveWatcher {
  state: WatcherState;
  intervalHandle: ReturnType<typeof setInterval>;
  startedAt: number;
  polling: boolean;
}

export class WatcherRegistry {
  private readonly watchers = new Map<string, ActiveWatcher>();

  constructor(
    private readonly configRepo: WatcherConfigRepository,
    private readonly pendingRepo: PendingChangesRepository,
    private readonly gitStateRepo: GitStateRepository,
    private readonly snapshotRepo: FsSnapshotRepository
  ) {}

  async start(state: WatcherState): Promise<void> {
    if (this.watchers.has(state.projectName)) {
      await this.stop(state.projectName);
    }
    const handle = setInterval(
      () => this.poll(state.projectName),
      state.pollInterval * 1000
    );
    this.watchers.set(state.projectName, {
      state,
      intervalHandle: handle,
      startedAt: Date.now(),
      polling: false,
    });
  }

  async stop(projectName: string): Promise<void> {
    const watcher = this.watchers.get(projectName);
    if (watcher) {
      clearInterval(watcher.intervalHandle);
      this.watchers.delete(projectName);
    }
  }

  updateConfig(projectName: string, partial: Partial<WatcherState>): void {
    const watcher = this.watchers.get(projectName);
    if (!watcher) return;
    const oldInterval = watcher.state.pollInterval;
    watcher.state = { ...watcher.state, ...partial };
    if (partial.pollInterval !== undefined && partial.pollInterval !== oldInterval) {
      clearInterval(watcher.intervalHandle);
      watcher.intervalHandle = setInterval(
        () => this.poll(projectName),
        watcher.state.pollInterval * 1000
      );
    }
  }

  getActive(): Map<string, ActiveWatcher> {
    return this.watchers;
  }

  getUptime(projectName: string): number {
    const watcher = this.watchers.get(projectName);
    return watcher ? Math.floor((Date.now() - watcher.startedAt) / 1000) : 0;
  }

  private async poll(projectName: string): Promise<void> {
    const watcher = this.watchers.get(projectName);
    if (!watcher || watcher.polling) return;

    if (!(await fs.pathExists(watcher.state.path))) {
      // H3: immutable state update
      watcher.state = { ...watcher.state, status: "error", reason: "directory not found" };
      await this.configRepo.update(projectName, {
        status: "error",
        reason: "directory not found",
      });
      clearInterval(watcher.intervalHandle);
      return;
    }

    watcher.polling = true;
    try {
      if (watcher.state.gitAvailable) {
        await this.pollGit(watcher);
      } else {
        await this.pollFs(watcher);
      }
    } catch (error) {
      console.error(`[watcher] poll error for ${projectName}:`, error);
    } finally {
      watcher.polling = false;
    }
  }

  private async pollGit(watcher: ActiveWatcher): Promise<void> {
    const poller = new GitPoller(watcher.state.path);
    const { projectName } = watcher.state;

    const currentRev = await poller.getHeadRev();
    if (!currentRev) return;

    const gitState = await this.gitStateRepo.load(projectName);
    const loaded =
      (await this.pendingRepo.load(projectName)) ??
      this.emptyIncremental(true);

    // H2: build new commits array immutably
    let commits = loaded.commits;
    let droppedCommits = loaded.droppedCommits ?? 0;

    if (gitState && currentRev !== gitState.lastRev) {
      const newCommits = await poller.getCommitsBetween(
        gitState.lastRev,
        currentRev
      );
      const combined = [...commits, ...newCommits];
      if (combined.length > 500) {
        const dropped = combined.length - 500;
        droppedCommits += dropped;
        commits = combined.slice(-500);
      } else {
        commits = combined;
      }
    }

    const currentStatus = await poller.getStatus();

    // H2: build hotFiles immutably
    let hotFiles = loaded.hotFiles;
    let filesCreated = loaded.filesCreated;

    if (gitState) {
      hotFiles = currentStatus.modified.reduce((acc, file) => {
        const idx = acc.findIndex((f) => f.path === file);
        if (idx >= 0) {
          return acc.map((f, i) =>
            i === idx ? { ...f, changeCount: f.changeCount + 1 } : f
          );
        }
        return [...acc, { path: file, changeCount: 1, tokens: "~100" }];
      }, hotFiles);

      const newFiles = currentStatus.untracked.filter(
        (f) => !gitState.lastStatus.untracked.includes(f)
      );
      for (const f of newFiles) {
        if (!filesCreated.includes(f)) {
          filesCreated = [...filesCreated, f];
        }
      }
    }

    const currentBranches = await poller.getBranches();

    // H2: build branches immutably
    let branchesCreated = loaded.branches.created;
    let branchesDeleted = loaded.branches.deleted;

    if (gitState) {
      const created = currentBranches.filter(
        (b) => !gitState.lastBranches.includes(b)
      );
      const deletedBranches = gitState.lastBranches.filter(
        (b) => !currentBranches.includes(b)
      );
      branchesCreated = [
        ...branchesCreated,
        ...created.filter((b) => !branchesCreated.includes(b)),
      ];
      branchesDeleted = [
        ...branchesDeleted,
        ...deletedBranches.filter((b) => !branchesDeleted.includes(b)),
      ];
    }

    let filesDeleted = loaded.filesDeleted;

    const toCancel = filesCreated.filter((f) => filesDeleted.includes(f));
    filesCreated = filesCreated.filter((f) => !toCancel.includes(f));
    filesDeleted = filesDeleted.filter((f) => !toCancel.includes(f));

    const totalChanges =
      commits.length +
      hotFiles.length +
      filesCreated.length +
      filesDeleted.length;

    const pending: PendingChangesIndex = {
      ...loaded,
      commits,
      hotFiles,
      filesCreated,
      filesDeleted,
      branches: { created: branchesCreated, deleted: branchesDeleted },
      totalChanges,
      droppedCommits,
    };

    const size = JSON.stringify(pending).length;
    const pendingWithWarning: PendingChangesIndex = size > 1_000_000
      ? { ...pending, warning: "inbox is large, consider processing" }
      : pending;

    await this.pendingRepo.save(projectName, pendingWithWarning);
    await this.gitStateRepo.save(projectName, {
      lastRev: currentRev,
      lastBranches: currentBranches,
      lastStatus: currentStatus,
    });
  }

  private async pollFs(watcher: ActiveWatcher): Promise<void> {
    const { projectName, path: projectPath } = watcher.state;
    const watchIgnore = await WatchIgnore.fromProject(projectPath);
    const fsPoller = new FsPoller();

    const currentSnapshot = await fsPoller.scanDirectory(
      projectPath,
      watchIgnore
    );
    const lastSnapshot = await this.snapshotRepo.load(projectName);
    const loaded =
      (await this.pendingRepo.load(projectName)) ??
      this.emptyIncremental(false);

    // H2: build state immutably
    let hotFiles = loaded.hotFiles;
    let filesCreated = loaded.filesCreated;
    let filesDeleted = loaded.filesDeleted;

    if (lastSnapshot) {
      const diff = fsPoller.diffSnapshots(lastSnapshot, currentSnapshot);

      for (const f of diff.created) {
        if (!filesCreated.includes(f)) {
          filesCreated = [...filesCreated, f];
        }
      }
      for (const f of diff.deleted) {
        if (!filesDeleted.includes(f)) {
          filesDeleted = [...filesDeleted, f];
        }
      }
      hotFiles = diff.modified.reduce((acc, f) => {
        const idx = acc.findIndex((h) => h.path === f);
        if (idx >= 0) {
          return acc.map((h, i) =>
            i === idx ? { ...h, changeCount: h.changeCount + 1 } : h
          );
        }
        return [...acc, { path: f, changeCount: 1, tokens: "~100" }];
      }, hotFiles);

      const toCancel = filesCreated.filter((f) => filesDeleted.includes(f));
      filesCreated = filesCreated.filter((f) => !toCancel.includes(f));
      filesDeleted = filesDeleted.filter((f) => !toCancel.includes(f));
    }

    const totalChanges =
      hotFiles.length + filesCreated.length + filesDeleted.length;

    const pending: PendingChangesIndex = {
      ...loaded,
      hotFiles,
      filesCreated,
      filesDeleted,
      totalChanges,
    };

    await this.pendingRepo.save(projectName, pending);
    await this.snapshotRepo.save(projectName, currentSnapshot);
  }

  private emptyIncremental(gitAvailable: boolean): PendingChangesIndex {
    return {
      type: "incremental",
      since: new Date().toISOString(),
      gitAvailable,
      totalChanges: 0,
      commits: [],
      hotFiles: [],
      filesCreated: [],
      filesDeleted: [],
      branches: { created: [], deleted: [] },
    };
  }
}
