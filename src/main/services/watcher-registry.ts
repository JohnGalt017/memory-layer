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
    if (watcher) {
      watcher.state = { ...watcher.state, ...partial };
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
      watcher.state.status = "error";
      watcher.state.reason = "directory not found";
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
    const pending =
      (await this.pendingRepo.load(projectName)) ??
      this.emptyIncremental(true);

    if (gitState && currentRev !== gitState.lastRev) {
      const newCommits = await poller.getCommitsBetween(
        gitState.lastRev,
        currentRev
      );
      pending.commits.push(...newCommits);
      if (pending.commits.length > 500) {
        const dropped = pending.commits.length - 500;
        pending.commits = pending.commits.slice(-500);
        pending.droppedCommits = (pending.droppedCommits ?? 0) + dropped;
      }
    }

    const currentStatus = await poller.getStatus();
    if (gitState) {
      for (const file of currentStatus.modified) {
        const existing = pending.hotFiles.find((f) => f.path === file);
        if (existing) {
          existing.changeCount++;
        } else {
          pending.hotFiles.push({ path: file, changeCount: 1, tokens: "~100" });
        }
      }
      const newFiles = currentStatus.untracked.filter(
        (f) => !gitState.lastStatus.untracked.includes(f)
      );
      for (const f of newFiles) {
        if (!pending.filesCreated.includes(f)) pending.filesCreated.push(f);
      }
    }

    const currentBranches = await poller.getBranches();
    if (gitState) {
      const created = currentBranches.filter(
        (b) => !gitState.lastBranches.includes(b)
      );
      const deleted = gitState.lastBranches.filter(
        (b) => !currentBranches.includes(b)
      );
      pending.branches.created.push(
        ...created.filter((b) => !pending.branches.created.includes(b))
      );
      pending.branches.deleted.push(
        ...deleted.filter((b) => !pending.branches.deleted.includes(b))
      );
    }

    const toCancel = pending.filesCreated.filter((f) =>
      pending.filesDeleted.includes(f)
    );
    pending.filesCreated = pending.filesCreated.filter(
      (f) => !toCancel.includes(f)
    );
    pending.filesDeleted = pending.filesDeleted.filter(
      (f) => !toCancel.includes(f)
    );

    pending.totalChanges =
      pending.commits.length +
      pending.hotFiles.length +
      pending.filesCreated.length +
      pending.filesDeleted.length;

    const size = JSON.stringify(pending).length;
    if (size > 1_000_000) pending.warning = "inbox is large, consider processing";

    await this.pendingRepo.save(projectName, pending);
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
    const pending =
      (await this.pendingRepo.load(projectName)) ??
      this.emptyIncremental(false);

    if (lastSnapshot) {
      const diff = fsPoller.diffSnapshots(lastSnapshot, currentSnapshot);
      for (const f of diff.created) {
        if (!pending.filesCreated.includes(f)) pending.filesCreated.push(f);
      }
      for (const f of diff.deleted) {
        if (!pending.filesDeleted.includes(f)) pending.filesDeleted.push(f);
      }
      for (const f of diff.modified) {
        const existing = pending.hotFiles.find((h) => h.path === f);
        if (existing) existing.changeCount++;
        else pending.hotFiles.push({ path: f, changeCount: 1, tokens: "~100" });
      }
      const toCancel = pending.filesCreated.filter((f) =>
        pending.filesDeleted.includes(f)
      );
      pending.filesCreated = pending.filesCreated.filter(
        (f) => !toCancel.includes(f)
      );
      pending.filesDeleted = pending.filesDeleted.filter(
        (f) => !toCancel.includes(f)
      );
    }

    pending.totalChanges =
      pending.hotFiles.length +
      pending.filesCreated.length +
      pending.filesDeleted.length;

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
