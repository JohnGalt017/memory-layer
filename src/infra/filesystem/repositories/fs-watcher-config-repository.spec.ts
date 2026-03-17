import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FsWatcherConfigRepository } from "./fs-watcher-config-repository.js";
import fs from "fs-extra";
import path from "path";
import os from "os";

describe("FsWatcherConfigRepository", () => {
  let tmpDir: string;
  let repo: FsWatcherConfigRepository;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "watcher-test-"));
    repo = new FsWatcherConfigRepository(tmpDir);
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it("should return empty object when no config exists", async () => {
    const result = await repo.loadAll();
    expect(result).toEqual({});
  });

  it("should save and load watcher config", async () => {
    const state = {
      projectName: "test",
      path: "/tmp/test",
      processingModel: "sonnet" as const,
      pollInterval: 30,
      gitAvailable: true,
      status: "watching" as const,
    };
    await repo.save("test", state);
    const loaded = await repo.loadAll();
    expect(loaded["test"]).toEqual(state);
  });

  it("should update watcher config", async () => {
    const state = {
      projectName: "test",
      path: "/tmp/test",
      processingModel: "sonnet" as const,
      pollInterval: 30,
      gitAvailable: true,
      status: "watching" as const,
    };
    await repo.save("test", state);
    await repo.update("test", { pollInterval: 60 });
    const loaded = await repo.loadAll();
    expect(loaded["test"].pollInterval).toBe(60);
  });

  it("should remove watcher config immutably", async () => {
    const state = {
      projectName: "test",
      path: "/tmp/test",
      processingModel: "sonnet" as const,
      pollInterval: 30,
      gitAvailable: true,
      status: "stopped" as const,
    };
    await repo.save("test", state);
    await repo.remove("test");
    const loaded = await repo.loadAll();
    expect(loaded["test"]).toBeUndefined();
  });
});
