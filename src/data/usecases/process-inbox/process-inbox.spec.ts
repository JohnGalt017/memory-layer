import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProcessInbox } from "./process-inbox.js";
import { WatcherConfigRepository } from "../../protocols/watcher-config-repository.js";
import { PendingChangesRepository } from "../../protocols/pending-changes-repository.js";
import { WatcherState, PendingChangesIndex } from "../../../domain/entities/watcher-state.js";

const makeConfig = (overrides: Partial<WatcherState> = {}): WatcherState => ({
  projectName: "myproject",
  path: "/some/project",
  processingModel: "sonnet",
  pollInterval: 30,
  gitAvailable: true,
  status: "watching",
  ...overrides,
});

const makePendingIndex = (): PendingChangesIndex => ({
  type: "incremental",
  since: "2024-01-01T00:00:00.000Z",
  gitAvailable: true,
  totalChanges: 5,
  commits: [
    { hash: "abc1234", message: "feat: something", filesCount: 2, tokens: "~10" },
  ],
  hotFiles: [{ path: "src/index.ts", changeCount: 3, tokens: "~100" }],
  filesCreated: ["new-file.ts"],
  filesDeleted: [],
  branches: { created: [], deleted: [] },
});

const makeConfigRepo = (configs: Record<string, WatcherState> = {}): WatcherConfigRepository => ({
  loadAll: vi.fn().mockResolvedValue(configs),
  save: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
});

const makePendingRepo = (result: PendingChangesIndex | null = null): PendingChangesRepository => ({
  load: vi.fn().mockResolvedValue(result),
  save: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
  countChanges: vi.fn().mockResolvedValue(0),
});

describe("ProcessInbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw when watcher not found", async () => {
    const sut = new ProcessInbox(makeConfigRepo({}), makePendingRepo());

    await expect(
      sut.processInbox({ projectName: "unknown" })
    ).rejects.toThrow("watcher not found: unknown");
  });

  it("should return pending changes with processingModel", async () => {
    const config = makeConfig();
    const pending = makePendingIndex();
    const sut = new ProcessInbox(
      makeConfigRepo({ myproject: config }),
      makePendingRepo(pending)
    );

    const result = await sut.processInbox({ projectName: "myproject" });

    expect(result.processingModel).toBe("sonnet");
    expect(result.gitAvailable).toBe(true);
    expect(result.index).toEqual(pending);
  });

  it("should return empty index when no pending changes", async () => {
    const config = makeConfig();
    const sut = new ProcessInbox(
      makeConfigRepo({ myproject: config }),
      makePendingRepo(null)
    );

    const result = await sut.processInbox({ projectName: "myproject" });

    expect(result.processingModel).toBe("sonnet");
    expect(result.index.totalChanges).toBe(0);
    expect(result.index.commits).toEqual([]);
    expect(result.index.hotFiles).toEqual([]);
  });

  it("should propagate gitAvailable from config when no pending changes", async () => {
    const config = makeConfig({ gitAvailable: false });
    const sut = new ProcessInbox(
      makeConfigRepo({ myproject: config }),
      makePendingRepo(null)
    );

    const result = await sut.processInbox({ projectName: "myproject" });

    expect(result.gitAvailable).toBe(false);
    expect(result.index.gitAvailable).toBe(false);
  });

  it("should return the correct processingModel from config", async () => {
    const config = makeConfig({ processingModel: "opus" });
    const sut = new ProcessInbox(
      makeConfigRepo({ myproject: config }),
      makePendingRepo(makePendingIndex())
    );

    const result = await sut.processInbox({ projectName: "myproject" });

    expect(result.processingModel).toBe("opus");
  });
});
