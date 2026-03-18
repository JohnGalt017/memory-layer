import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { FsWatcherConfigRepository } from "../filesystem/repositories/fs-watcher-config-repository.js";
import { FsPendingChangesRepository } from "../filesystem/repositories/fs-pending-changes-repository.js";
import { FsGitStateRepository } from "../filesystem/repositories/fs-git-state-repository.js";
import { FsSnapshotRepositoryImpl } from "../filesystem/repositories/fs-snapshot-repository.js";
import { WatcherRegistry } from "../../main/services/watcher-registry.js";
import { GitPoller } from "./git-poller.js";
import { InitialScanExtractor } from "./initial-scan-extractor.js";
import { WatchIgnore } from "../security/watch-ignore.js";

const execAsync = promisify(exec);

describe("Watcher Integration", () => {
  let projectDir: string;
  let watcherRoot: string;

  beforeEach(async () => {
    projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "watcher-int-"));
    watcherRoot = await fs.mkdtemp(path.join(os.tmpdir(), "watcher-root-"));
    await execAsync("git init", { cwd: projectDir });
    await execAsync('git config user.email "test@test.com"', { cwd: projectDir });
    await execAsync('git config user.name "Test"', { cwd: projectDir });
    await fs.writeFile(path.join(projectDir, "README.md"), "# Test Project");
    await execAsync("git add . && git commit -m 'init'", { cwd: projectDir });
  });

  afterEach(async () => {
    await fs.remove(projectDir);
    await fs.remove(watcherRoot);
  });

  it("should detect new commits via git polling", async () => {
    const gitPoller = new GitPoller(projectDir);

    const initialRev = await gitPoller.getHeadRev();
    expect(initialRev).not.toBeNull();

    const initialStatus = await gitPoller.getStatus();
    const initialBranches = await gitPoller.getBranches();

    const gitStateRepo = new FsGitStateRepository(watcherRoot);
    await gitStateRepo.save("test-project", {
      lastRev: initialRev!,
      lastBranches: initialBranches,
      lastStatus: initialStatus,
    });

    await fs.writeFile(path.join(projectDir, "new-file.ts"), "export const x = 1;");
    await execAsync("git add . && git commit -m 'feat: add new file'", { cwd: projectDir });

    const newRev = await gitPoller.getHeadRev();
    expect(newRev).not.toBeNull();
    expect(newRev).not.toBe(initialRev);

    const commits = await gitPoller.getCommitsBetween(initialRev!, newRev!);
    expect(commits.length).toBe(1);
    expect(commits[0].message).toContain("feat: add new file");
  });

  it("should produce initial scan snapshot", async () => {
    const watchIgnore = new WatchIgnore();
    const extractor = new InitialScanExtractor(watchIgnore);
    const snapshot = await extractor.extract(projectDir);

    expect(snapshot.readme).toContain("# Test Project");
    expect(snapshot.fileTree.length).toBeGreaterThan(0);
    expect(snapshot.gitLog.length).toBeGreaterThan(0);
  });

  it("should set error status when watched directory disappears", async () => {
    const configRepo = new FsWatcherConfigRepository(watcherRoot);
    const pendingRepo = new FsPendingChangesRepository(watcherRoot);
    const gitStateRepo = new FsGitStateRepository(watcherRoot);
    const snapshotRepo = new FsSnapshotRepositoryImpl(watcherRoot);

    const registry = new WatcherRegistry(configRepo, pendingRepo, gitStateRepo, snapshotRepo);

    const missingDir = path.join(os.tmpdir(), "nonexistent-" + Date.now());
    const state = {
      projectName: "ghost-project",
      path: missingDir,
      processingModel: "sonnet" as const,
      pollInterval: 30,
      gitAvailable: false,
      status: "watching" as const,
    };

    await configRepo.save("ghost-project", state);
    await registry.start(state);

    const watcher = registry.getActive().get("ghost-project");
    expect(watcher).toBeDefined();

    await registry.stop("ghost-project");
  });

  it("should count pending changes after polling", async () => {
    const configRepo = new FsWatcherConfigRepository(watcherRoot);
    const pendingRepo = new FsPendingChangesRepository(watcherRoot);
    const gitStateRepo = new FsGitStateRepository(watcherRoot);
    const snapshotRepo = new FsSnapshotRepositoryImpl(watcherRoot);

    const gitPoller = new GitPoller(projectDir);
    const initialRev = await gitPoller.getHeadRev();
    const initialStatus = await gitPoller.getStatus();
    const initialBranches = await gitPoller.getBranches();

    await gitStateRepo.save("test-project", {
      lastRev: initialRev!,
      lastBranches: initialBranches,
      lastStatus: initialStatus,
    });

    await fs.writeFile(path.join(projectDir, "feature.ts"), "export const y = 2;");
    await execAsync("git add . && git commit -m 'feat: feature'", { cwd: projectDir });

    const newRev = await gitPoller.getHeadRev();
    const newBranches = await gitPoller.getBranches();
    const newStatus = await gitPoller.getStatus();
    const newCommits = await gitPoller.getCommitsBetween(initialRev!, newRev!);

    const pending = {
      type: "incremental" as const,
      since: new Date().toISOString(),
      gitAvailable: true,
      totalChanges: newCommits.length,
      commits: newCommits,
      hotFiles: [],
      filesCreated: [],
      filesDeleted: [],
      branches: { created: [], deleted: [] },
    };

    await pendingRepo.save("test-project", pending);
    await gitStateRepo.save("test-project", {
      lastRev: newRev!,
      lastBranches: newBranches,
      lastStatus: newStatus,
    });

    const count = await pendingRepo.countChanges("test-project");
    expect(count).toBe(1);

    const registry = new WatcherRegistry(configRepo, pendingRepo, gitStateRepo, snapshotRepo);
    await registry.start({
      projectName: "test-project",
      path: projectDir,
      processingModel: "sonnet",
      pollInterval: 60,
      gitAvailable: true,
      status: "watching",
    });
    await registry.stop("test-project");
  });
});
