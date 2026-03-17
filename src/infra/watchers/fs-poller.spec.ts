import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FsPoller } from "./fs-poller.js";
import { WatchIgnore } from "../security/watch-ignore.js";
import fs from "fs-extra";
import path from "path";
import os from "os";
import type { FsSnapshot } from "../../domain/entities/watcher-state.js";

describe("FsPoller", () => {
  let tmpDir: string;
  let poller: FsPoller;
  let watchIgnore: WatchIgnore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "fs-poller-test-"));
    poller = new FsPoller();
    watchIgnore = new WatchIgnore();
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it("should scan directory and return file stats", async () => {
    await fs.writeFile(path.join(tmpDir, "index.ts"), "hello");
    await fs.ensureDir(path.join(tmpDir, "src"));
    await fs.writeFile(path.join(tmpDir, "src", "util.ts"), "world");

    const snapshot = await poller.scanDirectory(tmpDir, watchIgnore);

    expect(Object.keys(snapshot.files)).toContain("index.ts");
    expect(Object.keys(snapshot.files)).toContain(path.join("src", "util.ts"));
    expect(snapshot.files["index.ts"].size).toBe(5);
    expect(snapshot.files["index.ts"].mtime).toBeGreaterThan(0);
  });

  it("should prune ignored directories", async () => {
    const nmDir = path.join(tmpDir, "node_modules");
    await fs.ensureDir(nmDir);
    await fs.writeFile(path.join(nmDir, "express.js"), "module");
    await fs.writeFile(path.join(tmpDir, "index.ts"), "hello");

    const ignoreWithNodeModules = new WatchIgnore([], ["node_modules/"]);
    const snapshot = await poller.scanDirectory(tmpDir, ignoreWithNodeModules);

    const keys = Object.keys(snapshot.files);
    expect(keys).toContain("index.ts");
    expect(keys.some((k) => k.includes("node_modules"))).toBe(false);
  });

  it("should detect created files (empty old snapshot, files in new)", () => {
    const oldSnapshot: FsSnapshot = { files: {} };
    const newSnapshot: FsSnapshot = {
      files: {
        "src/new-file.ts": { mtime: Date.now(), size: 100 },
        "README.md": { mtime: Date.now(), size: 200 },
      },
    };

    const diff = poller.diffSnapshots(oldSnapshot, newSnapshot);

    expect(diff.created).toEqual(
      expect.arrayContaining(["src/new-file.ts", "README.md"])
    );
    expect(diff.deleted).toEqual([]);
    expect(diff.modified).toEqual([]);
  });

  it("should detect deleted files (files in old, empty new)", () => {
    const oldSnapshot: FsSnapshot = {
      files: {
        "src/old-file.ts": { mtime: Date.now(), size: 100 },
      },
    };
    const newSnapshot: FsSnapshot = { files: {} };

    const diff = poller.diffSnapshots(oldSnapshot, newSnapshot);

    expect(diff.deleted).toEqual(["src/old-file.ts"]);
    expect(diff.created).toEqual([]);
    expect(diff.modified).toEqual([]);
  });

  it("should detect modified files (same path, different mtime)", () => {
    const oldMtime = 1000000;
    const newMtime = 2000000;

    const oldSnapshot: FsSnapshot = {
      files: {
        "src/file.ts": { mtime: oldMtime, size: 100 },
      },
    };
    const newSnapshot: FsSnapshot = {
      files: {
        "src/file.ts": { mtime: newMtime, size: 100 },
      },
    };

    const diff = poller.diffSnapshots(oldSnapshot, newSnapshot);

    expect(diff.modified).toEqual(["src/file.ts"]);
    expect(diff.created).toEqual([]);
    expect(diff.deleted).toEqual([]);
  });

  it("should not report modified when mtime is the same", () => {
    const mtime = 1000000;
    const snapshot: FsSnapshot = {
      files: {
        "src/file.ts": { mtime, size: 100 },
      },
    };

    const diff = poller.diffSnapshots(snapshot, snapshot);

    expect(diff.modified).toEqual([]);
    expect(diff.created).toEqual([]);
    expect(diff.deleted).toEqual([]);
  });
});
