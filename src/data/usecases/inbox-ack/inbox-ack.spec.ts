import { describe, it, expect, vi, beforeEach } from "vitest";
import { InboxAck } from "./inbox-ack.js";
import { PendingChangesRepository } from "../../protocols/pending-changes-repository.js";
import { WatcherConfigRepository } from "../../protocols/watcher-config-repository.js";
import { GitStateRepository } from "../../protocols/git-state-repository.js";

const makePendingRepo = (): PendingChangesRepository => ({
  load: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
  countChanges: vi.fn().mockResolvedValue(0),
});

const makeConfigRepo = (): WatcherConfigRepository => ({
  loadAll: vi.fn().mockResolvedValue({}),
  save: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
});

const makeGitStateRepo = (): GitStateRepository => ({
  load: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
});

describe("InboxAck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should clear pending changes", async () => {
    const pendingRepo = makePendingRepo();
    const sut = new InboxAck(pendingRepo, makeConfigRepo(), makeGitStateRepo());

    await sut.inboxAck({ projectName: "myproject" });

    expect(pendingRepo.clear).toHaveBeenCalledWith("myproject");
  });

  it("should update lastProcessed in config", async () => {
    const configRepo = makeConfigRepo();
    const sut = new InboxAck(makePendingRepo(), configRepo, makeGitStateRepo());

    await sut.inboxAck({ projectName: "myproject" });

    expect(configRepo.update).toHaveBeenCalledWith(
      "myproject",
      expect.objectContaining({ lastProcessed: expect.any(String) })
    );
  });

  it("should return status acknowledged with lastProcessed", async () => {
    const sut = new InboxAck(makePendingRepo(), makeConfigRepo(), makeGitStateRepo());

    const result = await sut.inboxAck({ projectName: "myproject" });

    expect(result.status).toBe("acknowledged");
    expect(result.lastProcessed).toBeDefined();
    expect(new Date(result.lastProcessed).getTime()).toBeGreaterThan(0);
  });

  it("should set lastProcessed to a recent ISO string", async () => {
    const before = Date.now();
    const sut = new InboxAck(makePendingRepo(), makeConfigRepo(), makeGitStateRepo());

    const result = await sut.inboxAck({ projectName: "myproject" });

    const after = Date.now();
    const ts = new Date(result.lastProcessed).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("should clear and update in sequence for the correct project", async () => {
    const pendingRepo = makePendingRepo();
    const configRepo = makeConfigRepo();
    const sut = new InboxAck(pendingRepo, configRepo, makeGitStateRepo());

    await sut.inboxAck({ projectName: "specific-project" });

    expect(pendingRepo.clear).toHaveBeenCalledWith("specific-project");
    expect(configRepo.update).toHaveBeenCalledWith(
      "specific-project",
      expect.any(Object)
    );
  });
});
