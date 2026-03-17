import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WatcherRegistry } from "./watcher-registry.js";
import { WatcherConfigRepository } from "../../data/protocols/watcher-config-repository.js";
import { PendingChangesRepository } from "../../data/protocols/pending-changes-repository.js";
import { GitStateRepository } from "../../data/protocols/git-state-repository.js";
import { FsSnapshotRepository } from "../../data/protocols/fs-snapshot-repository.js";
import { WatcherState } from "../../domain/entities/watcher-state.js";

vi.mock("fs-extra", () => ({
  default: {
    pathExists: vi.fn().mockResolvedValue(true),
  },
}));

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

const makeSnapshotRepo = (): FsSnapshotRepository => ({
  load: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(undefined),
});

const makeState = (overrides: Partial<WatcherState> = {}): WatcherState => ({
  projectName: "test-project",
  path: "/some/path",
  processingModel: "haiku",
  pollInterval: 30,
  gitAvailable: false,
  status: "watching",
  ...overrides,
});

describe("WatcherRegistry", () => {
  let configRepo: WatcherConfigRepository;
  let pendingRepo: PendingChangesRepository;
  let gitStateRepo: GitStateRepository;
  let snapshotRepo: FsSnapshotRepository;
  let sut: WatcherRegistry;

  beforeEach(() => {
    vi.useFakeTimers();
    configRepo = makeConfigRepo();
    pendingRepo = makePendingRepo();
    gitStateRepo = makeGitStateRepo();
    snapshotRepo = makeSnapshotRepo();
    sut = new WatcherRegistry(configRepo, pendingRepo, gitStateRepo, snapshotRepo);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("start", () => {
    it("should register watcher in active map", async () => {
      const state = makeState();
      await sut.start(state);
      expect(sut.getActive().has("test-project")).toBe(true);
    });

    it("should create an interval handle", async () => {
      const spySetInterval = vi.spyOn(global, "setInterval");
      const state = makeState({ pollInterval: 60 });
      await sut.start(state);
      expect(spySetInterval).toHaveBeenCalledWith(expect.any(Function), 60_000);
    });

    it("should stop existing watcher before starting new one for same project", async () => {
      const spyClearInterval = vi.spyOn(global, "clearInterval");
      const state = makeState();
      await sut.start(state);
      await sut.start(state);
      expect(spyClearInterval).toHaveBeenCalledTimes(1);
      expect(sut.getActive().size).toBe(1);
    });
  });

  describe("stop", () => {
    it("should remove watcher from active map", async () => {
      const state = makeState();
      await sut.start(state);
      await sut.stop("test-project");
      expect(sut.getActive().has("test-project")).toBe(false);
    });

    it("should clear the interval", async () => {
      const spyClearInterval = vi.spyOn(global, "clearInterval");
      const state = makeState();
      await sut.start(state);
      await sut.stop("test-project");
      expect(spyClearInterval).toHaveBeenCalledTimes(1);
    });

    it("should do nothing if project not found", async () => {
      const spyClearInterval = vi.spyOn(global, "clearInterval");
      await sut.stop("nonexistent");
      expect(spyClearInterval).not.toHaveBeenCalled();
    });
  });

  describe("updateConfig", () => {
    it("should update state fields without restarting interval", async () => {
      const spyClearInterval = vi.spyOn(global, "clearInterval");
      const state = makeState({ pollInterval: 30 });
      await sut.start(state);
      sut.updateConfig("test-project", { pollInterval: 60 });
      const active = sut.getActive().get("test-project")!;
      expect(active.state.pollInterval).toBe(60);
      expect(spyClearInterval).not.toHaveBeenCalled();
    });

    it("should do nothing if project not found", () => {
      expect(() =>
        sut.updateConfig("nonexistent", { pollInterval: 60 })
      ).not.toThrow();
    });
  });

  describe("getUptime", () => {
    it("should return 0 for unknown project", () => {
      expect(sut.getUptime("nonexistent")).toBe(0);
    });

    it("should return elapsed seconds since start", async () => {
      const state = makeState();
      await sut.start(state);
      vi.advanceTimersByTime(5000);
      expect(sut.getUptime("test-project")).toBe(5);
    });
  });

  describe("poll — skip-if-busy", () => {
    it("should not run a second poll if previous is still running", async () => {
      let resolvePoll!: () => void;
      const blockingPromise = new Promise<void>((res) => {
        resolvePoll = res;
      });

      // Make snapshotRepo.load hang so polling stays locked
      vi.mocked(snapshotRepo.load).mockReturnValue(blockingPromise as any);

      const state = makeState({ gitAvailable: false, pollInterval: 1 });
      await sut.start(state);

      // Manually set polling flag to simulate a poll already in progress
      const active = sut.getActive().get("test-project")!;
      active.polling = true;

      // Tick should be skipped because polling === true
      await vi.advanceTimersByTimeAsync(1000);

      // Should not have called any repo method
      expect(vi.mocked(snapshotRepo.load)).not.toHaveBeenCalled();

      // Reset and unblock
      active.polling = false;
      resolvePoll();
    });
  });

  describe("poll — directory not found", () => {
    it("should set error status and stop interval when path does not exist", async () => {
      const { default: fsMock } = await import("fs-extra");
      vi.mocked(fsMock.pathExists).mockResolvedValueOnce(false as any);

      const spyClearInterval = vi.spyOn(global, "clearInterval");
      const state = makeState({ pollInterval: 1 });
      await sut.start(state);

      await vi.advanceTimersByTimeAsync(1000);

      expect(vi.mocked(configRepo.update)).toHaveBeenCalledWith("test-project", {
        status: "error",
        reason: "directory not found",
      });
      expect(spyClearInterval).toHaveBeenCalled();

      const active = sut.getActive().get("test-project")!;
      expect(active.state.status).toBe("error");
      expect(active.state.reason).toBe("directory not found");
    });
  });
});
