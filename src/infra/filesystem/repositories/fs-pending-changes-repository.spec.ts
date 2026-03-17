import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FsPendingChangesRepository } from "./fs-pending-changes-repository.js";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { PendingChangesIndex } from "../../../domain/entities/watcher-state.js";

const makePendingChanges = (overrides: Partial<PendingChangesIndex> = {}): PendingChangesIndex => ({
  type: "incremental",
  since: "2024-01-01T00:00:00Z",
  gitAvailable: true,
  totalChanges: 3,
  commits: [],
  hotFiles: [],
  filesCreated: [],
  filesDeleted: [],
  branches: { created: [], deleted: [] },
  ...overrides,
});

describe("FsPendingChangesRepository", () => {
  let tmpDir: string;
  let repo: FsPendingChangesRepository;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pending-test-"));
    repo = new FsPendingChangesRepository(tmpDir);
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it("should return null when no file exists", async () => {
    const result = await repo.load("myproject");
    expect(result).toBeNull();
  });

  it("should save and load pending changes", async () => {
    const changes = makePendingChanges({ totalChanges: 5 });
    await repo.save("myproject", changes);
    const loaded = await repo.load("myproject");
    expect(loaded).toEqual(changes);
  });

  it("should clear by removing the file", async () => {
    const changes = makePendingChanges();
    await repo.save("myproject", changes);
    await repo.clear("myproject");
    const loaded = await repo.load("myproject");
    expect(loaded).toBeNull();
  });

  it("should return totalChanges from countChanges", async () => {
    const changes = makePendingChanges({ totalChanges: 7 });
    await repo.save("myproject", changes);
    const count = await repo.countChanges("myproject");
    expect(count).toBe(7);
  });

  it("should return 0 from countChanges when no file", async () => {
    const count = await repo.countChanges("myproject");
    expect(count).toBe(0);
  });

  it("should handle corrupted JSON gracefully", async () => {
    const filePath = path.join(tmpDir, ".watchers", "myproject", "pending-changes.json");
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, "{ not valid json", "utf-8");
    const result = await repo.load("myproject");
    expect(result).toBeNull();
  });
});
