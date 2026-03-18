import { describe, it, expect, vi, beforeEach } from "vitest";
import { WatchStart } from "./watch-start.js";
import { WatcherConfigRepository } from "../../protocols/watcher-config-repository.js";
import { PendingChangesRepository } from "../../protocols/pending-changes-repository.js";
import { GitStateRepository } from "../../protocols/git-state-repository.js";
import { InitialScanExtractor } from "../../../infra/watchers/initial-scan-extractor.js";
import { WatcherRegistry } from "../../../main/services/watcher-registry.js";
import { InitialSnapshot } from "../../../domain/entities/watcher-state.js";

vi.mock("fs-extra", () => ({
  default: {
    pathExists: vi.fn(),
  },
}));

import fs from "fs-extra";

const makeSnapshot = (): InitialSnapshot => ({
  readme: "# Test",
  manifest: { name: "test-project" },
  fileTree: ["src/index.ts", "README.md"],
  gitLog: [
    { hash: "abc1234", message: "initial commit", filesCount: 1, tokens: "~5" },
  ],
  branches: ["main"],
  gitStatus: { modified: [], untracked: [], deleted: [] },
});

const makeConfigRepo = (): WatcherConfigRepository => ({
  loadAll: vi.fn().mockResolvedValue({}),
  save: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
});

const makePendingRepo = (): PendingChangesRepository => ({
  load: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
  countChanges: vi.fn().mockResolvedValue(0),
});

const makeGitStateRepo = (): GitStateRepository => ({
  load: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
});

const makeExtractor = (snapshot: InitialSnapshot): InitialScanExtractor => ({
  extract: vi.fn().mockResolvedValue(snapshot),
} as unknown as InitialScanExtractor);

const makeRegistry = (): WatcherRegistry => ({
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  updateConfig: vi.fn(),
  getActive: vi.fn().mockReturnValue(new Map()),
  getUptime: vi.fn().mockReturnValue(0),
} as unknown as WatcherRegistry);

describe("WatchStart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw when directory does not exist", async () => {
    vi.mocked(fs.pathExists).mockResolvedValue(false as never);

    const sut = new WatchStart(
      makeConfigRepo(),
      makePendingRepo(),
      makeGitStateRepo(),
      makeExtractor(makeSnapshot()),
      makeRegistry()
    );

    await expect(
      sut.watchStart({ path: "/nonexistent", projectName: "proj" })
    ).rejects.toThrow("directory not found");
  });

  it("should call initialScanExtractor and save results", async () => {
    const snapshot = makeSnapshot();
    vi.mocked(fs.pathExists)
      .mockResolvedValueOnce(true as never)  // directory exists
      .mockResolvedValueOnce(true as never); // .git exists

    const configRepo = makeConfigRepo();
    const pendingRepo = makePendingRepo();
    const gitStateRepo = makeGitStateRepo();
    const extractor = makeExtractor(snapshot);
    const registry = makeRegistry();

    const sut = new WatchStart(configRepo, pendingRepo, gitStateRepo, extractor, registry);
    await sut.watchStart({ path: "/some/project", projectName: "myproject" });

    expect(extractor.extract).toHaveBeenCalledWith("/some/project");
    expect(pendingRepo.save).toHaveBeenCalledWith(
      "myproject",
      expect.objectContaining({
        type: "initial",
        gitAvailable: true,
        commits: snapshot.gitLog,
        snapshot,
      })
    );
  });

  it("should save config and start registry polling", async () => {
    vi.mocked(fs.pathExists)
      .mockResolvedValueOnce(true as never)
      .mockResolvedValueOnce(true as never);

    const configRepo = makeConfigRepo();
    const registry = makeRegistry();

    const sut = new WatchStart(
      configRepo,
      makePendingRepo(),
      makeGitStateRepo(),
      makeExtractor(makeSnapshot()),
      registry
    );

    await sut.watchStart({ path: "/some/project", projectName: "myproject" });

    expect(configRepo.save).toHaveBeenCalledWith(
      "myproject",
      expect.objectContaining({
        projectName: "myproject",
        path: "/some/project",
        status: "watching",
        processingModel: "sonnet",
        pollInterval: 30,
      })
    );
    expect(registry.start).toHaveBeenCalledWith(
      expect.objectContaining({ projectName: "myproject" })
    );
  });

  it("should detect git availability", async () => {
    vi.mocked(fs.pathExists)
      .mockResolvedValueOnce(true as never)   // directory exists
      .mockResolvedValueOnce(false as never); // no .git

    const configRepo = makeConfigRepo();
    const sut = new WatchStart(
      configRepo,
      makePendingRepo(),
      makeGitStateRepo(),
      makeExtractor({ ...makeSnapshot(), gitLog: [] }),
      makeRegistry()
    );

    const result = await sut.watchStart({ path: "/some/project", projectName: "myproject" });

    expect(result.gitAvailable).toBe(false);
    expect(configRepo.save).toHaveBeenCalledWith(
      "myproject",
      expect.objectContaining({ gitAvailable: false })
    );
  });

  it("should save git state when git is available and commits exist", async () => {
    const snapshot = makeSnapshot();
    vi.mocked(fs.pathExists)
      .mockResolvedValueOnce(true as never)
      .mockResolvedValueOnce(true as never);

    const gitStateRepo = makeGitStateRepo();
    const sut = new WatchStart(
      makeConfigRepo(),
      makePendingRepo(),
      gitStateRepo,
      makeExtractor(snapshot),
      makeRegistry()
    );

    await sut.watchStart({ path: "/some/project", projectName: "myproject" });

    expect(gitStateRepo.save).toHaveBeenCalledWith(
      "myproject",
      expect.objectContaining({ lastRev: "abc1234" })
    );
  });

  it("should return status watching with correct gitAvailable", async () => {
    vi.mocked(fs.pathExists)
      .mockResolvedValueOnce(true as never)
      .mockResolvedValueOnce(true as never);

    const sut = new WatchStart(
      makeConfigRepo(),
      makePendingRepo(),
      makeGitStateRepo(),
      makeExtractor(makeSnapshot()),
      makeRegistry()
    );

    const result = await sut.watchStart({ path: "/some/project", projectName: "myproject" });

    expect(result.status).toBe("watching");
    expect(result.gitAvailable).toBe(true);
  });

  it("should use provided processingModel and pollInterval", async () => {
    vi.mocked(fs.pathExists)
      .mockResolvedValueOnce(true as never)
      .mockResolvedValueOnce(false as never);

    const configRepo = makeConfigRepo();
    const sut = new WatchStart(
      configRepo,
      makePendingRepo(),
      makeGitStateRepo(),
      makeExtractor({ ...makeSnapshot(), gitLog: [] }),
      makeRegistry()
    );

    await sut.watchStart({
      path: "/some/project",
      projectName: "myproject",
      processingModel: "opus",
      pollInterval: 60,
    });

    expect(configRepo.save).toHaveBeenCalledWith(
      "myproject",
      expect.objectContaining({ processingModel: "opus", pollInterval: 60 })
    );
  });
});
