# Autonomous Project Watcher — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add background git/fs polling watcher to the MCP server that collects project changes into a compact inbox for LLM processing with progressive disclosure.

**Architecture:** Extends existing Clean Architecture with 7 new MCP tools. Watcher polls git/fs every N seconds, writes `pending-changes.json`. LLM processes via 2-step progressive disclosure (index → detail → ack). `watchers.json` persists config across restarts. New `main/services/` layer for stateful singletons.

**Tech Stack:** TypeScript (ES2022), Node.js `child_process.exec`, `fs-extra`, `ignore` npm package, Vitest.

**Spec:** `docs/superpowers/specs/2026-03-17-autonomous-watcher-design.md`

---

## File Map

### New Files

```
src/domain/entities/watcher-state.ts
src/domain/usecases/watch-start.ts
src/domain/usecases/watch-stop.ts
src/domain/usecases/watch-update.ts
src/domain/usecases/watch-list.ts
src/domain/usecases/process-inbox.ts
src/domain/usecases/process-inbox-detail.ts
src/domain/usecases/inbox-ack.ts

src/data/protocols/watcher-config-repository.ts
src/data/protocols/pending-changes-repository.ts
src/data/protocols/git-state-repository.ts
src/data/protocols/fs-snapshot-repository.ts
src/data/usecases/watch-start/watch-start.ts
src/data/usecases/watch-start/watch-start.spec.ts
src/data/usecases/watch-stop/watch-stop.ts
src/data/usecases/watch-stop/watch-stop.spec.ts
src/data/usecases/watch-update/watch-update.ts
src/data/usecases/watch-list/watch-list.ts
src/data/usecases/process-inbox/process-inbox.ts
src/data/usecases/process-inbox/process-inbox.spec.ts
src/data/usecases/process-inbox-detail/process-inbox-detail.ts
src/data/usecases/inbox-ack/inbox-ack.ts
src/data/usecases/inbox-ack/inbox-ack.spec.ts

src/infra/filesystem/repositories/fs-watcher-config-repository.ts
src/infra/filesystem/repositories/fs-watcher-config-repository.spec.ts
src/infra/filesystem/repositories/fs-pending-changes-repository.ts
src/infra/filesystem/repositories/fs-pending-changes-repository.spec.ts
src/infra/filesystem/repositories/fs-git-state-repository.ts
src/infra/filesystem/repositories/fs-snapshot-repository.ts
src/infra/watchers/git-poller.ts
src/infra/watchers/git-poller.spec.ts
src/infra/watchers/fs-poller.ts
src/infra/watchers/fs-poller.spec.ts
src/infra/watchers/initial-scan-extractor.ts
src/infra/watchers/initial-scan-extractor.spec.ts
src/infra/security/watch-ignore.ts
src/infra/security/watch-ignore.spec.ts

src/presentation/controllers/watch-start/watch-start-controller.ts
src/presentation/controllers/watch-stop/watch-stop-controller.ts
src/presentation/controllers/watch-update/watch-update-controller.ts
src/presentation/controllers/watch-list/watch-list-controller.ts
src/presentation/controllers/process-inbox/process-inbox-controller.ts
src/presentation/controllers/process-inbox-detail/process-inbox-detail-controller.ts
src/presentation/controllers/inbox-ack/inbox-ack-controller.ts

src/main/factories/controllers/watch-start/index.ts
src/main/factories/controllers/watch-stop/index.ts
src/main/factories/controllers/watch-update/index.ts
src/main/factories/controllers/watch-list/index.ts
src/main/factories/controllers/process-inbox/index.ts
src/main/factories/controllers/process-inbox-detail/index.ts
src/main/factories/controllers/inbox-ack/index.ts
src/main/services/watcher-singletons.ts
src/main/services/watcher-registry.ts
src/main/services/watcher-registry.spec.ts
src/main/services/watcher-bootstrap.ts

src/validators/absolute-path-validator.ts
```

### Modified Files

```
src/main/protocols/mcp/routes.ts          — add 7 new tool routes
src/main/protocols/mcp/app.ts             — call watcher bootstrap on start
src/main/index.ts                         — bootstrap watchers after MCP server ready
src/main/factories/controllers/index.ts   — export new controller factories
src/data/usecases/overview/overview.ts     — add token count + pending changes
src/data/usecases/list-projects/list-projects.ts — add pending changes info
package.json                               — add "ignore" dependency
```

---

## Task 1: Install dependency + domain entities

**Files:**
- Modify: `package.json`
- Create: `src/domain/entities/watcher-state.ts`

- [ ] **Step 1: Install `ignore` package**

```bash
npm install ignore
```

- [ ] **Step 2: Create WatcherState entity**

```typescript
// src/domain/entities/watcher-state.ts
export type WatcherStatus = "watching" | "stopped" | "error";
export type ProcessingModel = "haiku" | "sonnet" | "opus";

export interface WatcherState {
  projectName: string;
  path: string;
  processingModel: ProcessingModel;
  pollInterval: number;
  gitAvailable: boolean;
  status: WatcherStatus;
  reason?: string;
  lastProcessed?: string;
}

export interface PendingChangesIndex {
  type: "initial" | "incremental";
  since: string;
  gitAvailable: boolean;
  totalChanges: number;
  commits: CommitEntry[];
  hotFiles: HotFileEntry[];
  filesCreated: string[];
  filesDeleted: string[];
  branches: { created: string[]; deleted: string[] };
  snapshot?: InitialSnapshot;
  pending?: IncrementalChanges;
  droppedCommits?: number;
  droppedFiles?: number;
  warning?: string;
}

export interface CommitEntry {
  hash: string;
  message: string;
  filesCount: number;
  tokens: string;
}

export interface HotFileEntry {
  path: string;
  changeCount: number;
  tokens: string;
}

export interface InitialSnapshot {
  readme: string;
  manifest: Record<string, unknown>;
  fileTree: string[];
  gitLog: CommitEntry[];
  branches: string[];
  gitStatus: { modified: string[]; untracked: string[] };
}

export interface IncrementalChanges {
  commits: CommitEntry[];
  filesChanged: Record<string, { changeCount: number }>;
  filesCreated: string[];
  filesDeleted: string[];
  branches: { created: string[]; deleted: string[] };
}

export interface GitState {
  lastRev: string;
  lastBranches: string[];
  lastStatus: { modified: string[]; untracked: string[] };
}

export interface FsSnapshot {
  files: Record<string, { mtime: number; size: number }>;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/domain/entities/watcher-state.ts package.json package-lock.json
git commit -m "feat(watcher): add WatcherState entity and install ignore package"
```

---

## Task 2: Domain use case interfaces

**Files:**
- Create: `src/domain/usecases/watch-start.ts`
- Create: `src/domain/usecases/watch-stop.ts`
- Create: `src/domain/usecases/watch-update.ts`
- Create: `src/domain/usecases/watch-list.ts`
- Create: `src/domain/usecases/process-inbox.ts`
- Create: `src/domain/usecases/process-inbox-detail.ts`
- Create: `src/domain/usecases/inbox-ack.ts`

- [ ] **Step 1: Create all 7 use case interfaces**

```typescript
// src/domain/usecases/watch-start.ts
import { ProcessingModel, WatcherState, PendingChangesIndex } from "../entities/watcher-state.js";

export interface WatchStartParams {
  path: string;
  projectName: string;
  processingModel?: ProcessingModel;
  pollInterval?: number;
}

export interface WatchStartResult {
  status: "watching";
  gitAvailable: boolean;
  hasPendingChanges: boolean;
  warning?: string;
}

export interface WatchStartUseCase {
  watchStart(params: WatchStartParams): Promise<WatchStartResult>;
}
```

```typescript
// src/domain/usecases/watch-stop.ts
export interface WatchStopParams {
  projectName: string;
}

export interface WatchStopResult {
  status: "stopped";
}

export interface WatchStopUseCase {
  watchStop(params: WatchStopParams): Promise<WatchStopResult>;
}
```

```typescript
// src/domain/usecases/watch-update.ts
import { ProcessingModel } from "../entities/watcher-state.js";

export interface WatchUpdateParams {
  projectName: string;
  processingModel?: ProcessingModel;
  pollInterval?: number;
}

export interface WatchUpdateResult {
  status: "updated";
}

export interface WatchUpdateUseCase {
  watchUpdate(params: WatchUpdateParams): Promise<WatchUpdateResult>;
}
```

```typescript
// src/domain/usecases/watch-list.ts
import { WatcherState } from "../entities/watcher-state.js";

export interface WatchListEntry extends WatcherState {
  pendingChangesCount: number;
  uptime: number;
}

export interface WatchListUseCase {
  watchList(): Promise<WatchListEntry[]>;
}
```

```typescript
// src/domain/usecases/process-inbox.ts
import { PendingChangesIndex } from "../entities/watcher-state.js";

export interface ProcessInboxParams {
  projectName: string;
}

export interface ProcessInboxResult {
  processingModel: string;
  gitAvailable: boolean;
  index: PendingChangesIndex;
}

export interface ProcessInboxUseCase {
  processInbox(params: ProcessInboxParams): Promise<ProcessInboxResult>;
}
```

```typescript
// src/domain/usecases/process-inbox-detail.ts
export interface ProcessInboxDetailParams {
  projectName: string;
  commits?: string[];
  files?: string[];
}

export interface CommitDetail {
  hash: string;
  message: string;
  author: string;
  date: string;
  diff: string;
}

export interface FileDetail {
  path: string;
  content: string;
}

export interface ProcessInboxDetailResult {
  commits: CommitDetail[];
  files: FileDetail[];
}

export interface ProcessInboxDetailUseCase {
  processInboxDetail(params: ProcessInboxDetailParams): Promise<ProcessInboxDetailResult>;
}
```

```typescript
// src/domain/usecases/inbox-ack.ts
export interface InboxAckParams {
  projectName: string;
}

export interface InboxAckResult {
  status: "acknowledged";
  lastProcessed: string;
}

export interface InboxAckUseCase {
  inboxAck(params: InboxAckParams): Promise<InboxAckResult>;
}
```

- [ ] **Step 2: Update domain/usecases/index.ts exports**

Add exports for all 7 new use cases to `src/domain/usecases/index.ts`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/domain/usecases/
git commit -m "feat(watcher): add 7 use case interfaces"
```

---

## Task 3: Data layer repository protocols

**Files:**
- Create: `src/data/protocols/watcher-config-repository.ts`
- Create: `src/data/protocols/pending-changes-repository.ts`
- Create: `src/data/protocols/git-state-repository.ts`
- Create: `src/data/protocols/fs-snapshot-repository.ts`

- [ ] **Step 1: Create all 4 repository interfaces**

```typescript
// src/data/protocols/watcher-config-repository.ts
import { WatcherState } from "../../domain/entities/watcher-state.js";

export interface WatcherConfigRepository {
  loadAll(): Promise<Record<string, WatcherState>>;
  save(projectName: string, state: WatcherState): Promise<void>;
  update(projectName: string, partial: Partial<WatcherState>): Promise<void>;
  remove(projectName: string): Promise<void>;
}
```

```typescript
// src/data/protocols/pending-changes-repository.ts
import { PendingChangesIndex, CommitEntry, IncrementalChanges } from "../../domain/entities/watcher-state.js";

export interface PendingChangesRepository {
  load(projectName: string): Promise<PendingChangesIndex | null>;
  save(projectName: string, changes: PendingChangesIndex): Promise<void>;
  clear(projectName: string): Promise<void>;
  countChanges(projectName: string): Promise<number>;
}
```

```typescript
// src/data/protocols/git-state-repository.ts
import { GitState } from "../../domain/entities/watcher-state.js";

export interface GitStateRepository {
  load(projectName: string): Promise<GitState | null>;
  save(projectName: string, state: GitState): Promise<void>;
  clear(projectName: string): Promise<void>;
}
```

```typescript
// src/data/protocols/fs-snapshot-repository.ts
import { FsSnapshot } from "../../domain/entities/watcher-state.js";

export interface FsSnapshotRepository {
  load(projectName: string): Promise<FsSnapshot | null>;
  save(projectName: string, snapshot: FsSnapshot): Promise<void>;
}
```

- [ ] **Step 2: Update data/protocols/index.ts exports**

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/data/protocols/
git commit -m "feat(watcher): add 4 repository protocol interfaces"
```

---

## Task 4: WatchIgnore security module

**Files:**
- Create: `src/infra/security/watch-ignore.ts`
- Create: `src/infra/security/watch-ignore.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/infra/security/watch-ignore.spec.ts
import { describe, it, expect } from "vitest";
import { WatchIgnore } from "./watch-ignore.js";

describe("WatchIgnore", () => {
  it("should block default blacklist files", () => {
    const wi = new WatchIgnore();
    expect(wi.isIgnored(".env")).toBe(true);
    expect(wi.isIgnored(".env.local")).toBe(true);
    expect(wi.isIgnored("secret.pem")).toBe(true);
    expect(wi.isIgnored("credentials.json")).toBe(true);
    expect(wi.isIgnored(".aws/config")).toBe(true);
    expect(wi.isIgnored(".ssh/id_rsa")).toBe(true);
  });

  it("should allow normal files", () => {
    const wi = new WatchIgnore();
    expect(wi.isIgnored("src/index.ts")).toBe(false);
    expect(wi.isIgnored("README.md")).toBe(false);
    expect(wi.isIgnored("package.json")).toBe(false);
  });

  it("should respect custom patterns", () => {
    const wi = new WatchIgnore(["*.log", "tmp/"]);
    expect(wi.isIgnored("server.log")).toBe(true);
    expect(wi.isIgnored("tmp/cache.json")).toBe(true);
    expect(wi.isIgnored("src/index.ts")).toBe(false);
  });

  it("should respect gitignore patterns", () => {
    const wi = new WatchIgnore([], ["node_modules/", "dist/"]);
    expect(wi.isIgnored("node_modules/express/index.js")).toBe(true);
    expect(wi.isIgnored("dist/main.js")).toBe(true);
    expect(wi.isIgnored("src/index.ts")).toBe(false);
  });

  it("should validate path is within project root", () => {
    const wi = new WatchIgnore();
    expect(wi.isPathSafe("src/index.ts", "/project")).toBe(true);
    expect(wi.isPathSafe("../etc/passwd", "/project")).toBe(false);
    expect(wi.isPathSafe("/etc/passwd", "/project")).toBe(false);
    expect(wi.isPathSafe("src/../../etc/passwd", "/project")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/infra/security/watch-ignore.spec.ts
```

- [ ] **Step 3: Implement WatchIgnore**

```typescript
// src/infra/security/watch-ignore.ts
import ignore, { Ignore } from "ignore";
import path from "path";

const DEFAULT_BLACKLIST = [
  ".env*",
  "*.pem",
  "*.key",
  "*.p12",
  "*.pfx",
  "credentials*",
  "secrets*",
  ".aws/",
  ".ssh/",
];

export class WatchIgnore {
  private readonly ig: Ignore;

  constructor(
    watchignorePatterns: string[] = [],
    gitignorePatterns: string[] = []
  ) {
    this.ig = ignore();
    this.ig.add(DEFAULT_BLACKLIST);
    this.ig.add(gitignorePatterns);
    this.ig.add(watchignorePatterns);
  }

  static async fromProject(projectPath: string): Promise<WatchIgnore> {
    const fs = await import("fs-extra");
    let gitignorePatterns: string[] = [];
    let watchignorePatterns: string[] = [];

    const gitignorePath = path.join(projectPath, ".gitignore");
    if (await fs.pathExists(gitignorePath)) {
      const content = await fs.readFile(gitignorePath, "utf-8");
      gitignorePatterns = content.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
    }

    const watchignorePath = path.join(projectPath, ".watchignore");
    if (await fs.pathExists(watchignorePath)) {
      const content = await fs.readFile(watchignorePath, "utf-8");
      watchignorePatterns = content.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
    }

    return new WatchIgnore(watchignorePatterns, gitignorePatterns);
  }

  isIgnored(filePath: string): boolean {
    return this.ig.ignores(filePath);
  }

  isPathSafe(filePath: string, projectRoot: string): boolean {
    if (path.isAbsolute(filePath)) return false;
    const resolved = path.resolve(projectRoot, filePath);
    return resolved.startsWith(path.resolve(projectRoot));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/infra/security/watch-ignore.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/infra/security/
git commit -m "feat(watcher): add WatchIgnore security module with blacklist and path validation"
```

---

## Task 5: Filesystem repositories (config, pending-changes, git-state, snapshot)

**Files:**
- Create: `src/infra/filesystem/repositories/fs-watcher-config-repository.ts`
- Create: `src/infra/filesystem/repositories/fs-watcher-config-repository.spec.ts`
- Create: `src/infra/filesystem/repositories/fs-pending-changes-repository.ts`
- Create: `src/infra/filesystem/repositories/fs-pending-changes-repository.spec.ts`
- Create: `src/infra/filesystem/repositories/fs-git-state-repository.ts`
- Create: `src/infra/filesystem/repositories/fs-snapshot-repository.ts`

- [ ] **Step 1: Write failing test for FsWatcherConfigRepository**

```typescript
// src/infra/filesystem/repositories/fs-watcher-config-repository.spec.ts
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

  it("should remove watcher config", async () => {
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/infra/filesystem/repositories/fs-watcher-config-repository.spec.ts
```

- [ ] **Step 3: Implement FsWatcherConfigRepository**

```typescript
// src/infra/filesystem/repositories/fs-watcher-config-repository.ts
import { WatcherConfigRepository } from "../../../data/protocols/watcher-config-repository.js";
import { WatcherState } from "../../../domain/entities/watcher-state.js";
import fs from "fs-extra";
import path from "path";

export class FsWatcherConfigRepository implements WatcherConfigRepository {
  private readonly configPath: string;

  constructor(rootDir: string) {
    this.configPath = path.join(rootDir, ".watchers", "config.json");
  }

  async loadAll(): Promise<Record<string, WatcherState>> {
    try {
      if (!(await fs.pathExists(this.configPath))) return {};
      const data = await fs.readJson(this.configPath);
      return data;
    } catch {
      return {};
    }
  }

  async save(projectName: string, state: WatcherState): Promise<void> {
    const all = await this.loadAll();
    all[projectName] = state;
    await fs.ensureDir(path.dirname(this.configPath));
    await fs.writeJson(this.configPath, all, { spaces: 2 });
  }

  async update(projectName: string, partial: Partial<WatcherState>): Promise<void> {
    const all = await this.loadAll();
    if (!all[projectName]) return;
    all[projectName] = { ...all[projectName], ...partial };
    await fs.writeJson(this.configPath, all, { spaces: 2 });
  }

  async remove(projectName: string): Promise<void> {
    const all = await this.loadAll();
    const { [projectName]: _, ...rest } = all;
    await fs.writeJson(this.configPath, rest, { spaces: 2 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/infra/filesystem/repositories/fs-watcher-config-repository.spec.ts
```

- [ ] **Step 5: Implement FsPendingChangesRepository (with test)**

Follow same TDD pattern. Key methods:
- `load(projectName)` — reads `<rootDir>/.watchers/<projectName>/pending-changes.json`
- `save(projectName, changes)` — writes JSON
- `clear(projectName)` — deletes file
- `countChanges(projectName)` — reads and counts `totalChanges` field

Test file: `src/infra/filesystem/repositories/fs-pending-changes-repository.spec.ts`

Test cases:
- Returns null when no file exists
- Saves and loads pending changes
- Clear removes file
- Count returns totalChanges
- Handles corrupted JSON (returns null)

- [ ] **Step 6: Implement FsGitStateRepository**

Same pattern. Reads/writes `<rootDir>/.watchers/<projectName>/git-state.json`.

- [ ] **Step 7: Implement FsSnapshotRepository**

Same pattern. Reads/writes `<rootDir>/.watchers/<projectName>/last-snapshot.json`.

- [ ] **Step 8: Run all repository tests**

```bash
npx vitest run src/infra/filesystem/repositories/fs-watcher-config-repository.spec.ts src/infra/filesystem/repositories/fs-pending-changes-repository.spec.ts
```

- [ ] **Step 9: Commit**

```bash
git add src/infra/filesystem/repositories/fs-watcher-config-repository.ts src/infra/filesystem/repositories/fs-watcher-config-repository.spec.ts src/infra/filesystem/repositories/fs-pending-changes-repository.ts src/infra/filesystem/repositories/fs-pending-changes-repository.spec.ts src/infra/filesystem/repositories/fs-git-state-repository.ts src/infra/filesystem/repositories/fs-snapshot-repository.ts
git commit -m "feat(watcher): add filesystem repositories for config, pending-changes, git-state, snapshot"
```

---

## Task 6: GitPoller

**Files:**
- Create: `src/infra/watchers/git-poller.ts`
- Create: `src/infra/watchers/git-poller.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/infra/watchers/git-poller.spec.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitPoller } from "./git-poller.js";
import { exec } from "child_process";

vi.mock("child_process", () => ({
  exec: vi.fn(),
}));

const mockExec = (stdout: string, stderr = "") => {
  vi.mocked(exec).mockImplementation((_cmd, _opts, cb: any) => {
    cb(null, stdout, stderr);
    return {} as any;
  });
};

describe("GitPoller", () => {
  let poller: GitPoller;

  beforeEach(() => {
    poller = new GitPoller("/tmp/test-project");
    vi.clearAllMocks();
  });

  it("should get current HEAD rev", async () => {
    mockExec("abc123def456\n");
    const rev = await poller.getHeadRev();
    expect(rev).toBe("abc123def456");
  });

  it("should get new commits between revs", async () => {
    mockExec("abc123 feat: add auth\ndef456 fix: login bug\n");
    const commits = await poller.getCommitsBetween("old123", "abc123");
    expect(commits).toHaveLength(2);
    expect(commits[0].hash).toBe("abc123");
    expect(commits[0].message).toBe("feat: add auth");
  });

  it("should get current status", async () => {
    mockExec(" M src/index.ts\n?? newfile.ts\n");
    const status = await poller.getStatus();
    expect(status.modified).toContain("src/index.ts");
    expect(status.untracked).toContain("newfile.ts");
  });

  it("should get branches", async () => {
    mockExec("  main\n  feature/auth\n* develop\n");
    const branches = await poller.getBranches();
    expect(branches).toContain("main");
    expect(branches).toContain("feature/auth");
    expect(branches).toContain("develop");
  });

  it("should handle exec timeout", async () => {
    vi.mocked(exec).mockImplementation((_cmd, _opts, cb: any) => {
      cb(new Error("Command timed out"), "", "");
      return {} as any;
    });
    const rev = await poller.getHeadRev();
    expect(rev).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/infra/watchers/git-poller.spec.ts
```

- [ ] **Step 3: Implement GitPoller**

```typescript
// src/infra/watchers/git-poller.ts
import { exec as execCb } from "child_process";
import { CommitEntry } from "../../domain/entities/watcher-state.js";

const EXEC_TIMEOUT = 5000;
const SAFE_REF = /^[a-f0-9]{4,40}$/;
const SAFE_PATH = /^[a-zA-Z0-9_.\/\-]+$/;

const sanitizeRef = (ref: string): string => {
  if (!SAFE_REF.test(ref)) throw new Error(`Invalid git ref: ${ref}`);
  return ref;
};

const sanitizePath = (p: string): string => {
  if (!SAFE_PATH.test(p) || p.includes("..")) throw new Error(`Invalid path: ${p}`);
  return p;
};

const execAsync = (cmd: string, cwd: string): Promise<string> =>
  new Promise((resolve, reject) => {
    execCb(cmd, { cwd, timeout: EXEC_TIMEOUT }, (error, stdout, stderr) => {
      if (error) return reject(error);
      resolve(stdout.toString());
    });
  });

export class GitPoller {
  constructor(private readonly projectPath: string) {}

  async getHeadRev(): Promise<string | null> {
    try {
      const result = await execAsync("git rev-parse HEAD", this.projectPath);
      return result.trim() || null;
    } catch {
      return null;
    }
  }

  async getCommitsBetween(oldRev: string, newRev: string): Promise<CommitEntry[]> {
    try {
      const safeOld = sanitizeRef(oldRev);
      const safeNew = sanitizeRef(newRev);
      const result = await execAsync(
        `git log --oneline --stat ${safeOld}..${safeNew}`,
        this.projectPath
      );
      // Parse --oneline --stat output: hash message\n files...\n summary line
      const commits: CommitEntry[] = [];
      const blocks = result.trim().split(/\n(?=[a-f0-9])/);
      for (const block of blocks) {
        const lines = block.split("\n");
        const firstLine = lines[0];
        const spaceIdx = firstLine.indexOf(" ");
        const hash = firstLine.substring(0, spaceIdx);
        const message = firstLine.substring(spaceIdx + 1);
        // Count file lines in stat output (lines between first and summary)
        const fileLines = lines.slice(1).filter((l) => l.includes("|"));
        commits.push({
          hash,
          message,
          filesCount: fileLines.length,
          tokens: `~${Math.ceil(message.length / 4)}`,
        });
      }
      return commits;
    } catch {
      return [];
    }
  }

  async getStatus(): Promise<{ modified: string[]; untracked: string[] }> {
    try {
      const result = await execAsync("git status --porcelain", this.projectPath);
      const modified: string[] = [];
      const untracked: string[] = [];
      for (const line of result.split("\n").filter(Boolean)) {
        const status = line.substring(0, 2).trim();
        const file = line.substring(3);
        if (status === "??") untracked.push(file);
        else modified.push(file);
      }
      return { modified, untracked };
    } catch {
      return { modified: [], untracked: [] };
    }
  }

  async getBranches(): Promise<string[]> {
    try {
      const result = await execAsync("git branch -a", this.projectPath);
      return result
        .split("\n")
        .filter(Boolean)
        .map((b) => b.replace(/^\*?\s+/, "").trim());
    } catch {
      return [];
    }
  }

  async getCommitDetail(hash: string): Promise<string> {
    try {
      return await execAsync(`git log -1 -p ${sanitizeRef(hash)}`, this.projectPath);
    } catch {
      return "";
    }
  }

  async getFileDiff(fromRev: string, filePath: string): Promise<string> {
    try {
      return await execAsync(
        `git diff ${sanitizeRef(fromRev)} -- ${sanitizePath(filePath)}`,
        this.projectPath
      );
    } catch {
      return "";
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/infra/watchers/git-poller.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/infra/watchers/git-poller.ts src/infra/watchers/git-poller.spec.ts
git commit -m "feat(watcher): add GitPoller with exec timeout and parsing"
```

---

## Task 7: FsPoller

**Files:**
- Create: `src/infra/watchers/fs-poller.ts`
- Create: `src/infra/watchers/fs-poller.spec.ts`

- [ ] **Step 1: Write failing tests**

Test cases:
- Should detect new files (in snapshot B but not A)
- Should detect deleted files (in A but not B)
- Should detect modified files (mtime changed)
- Should prune ignored directories during traversal
- Should respect WatchIgnore blacklist

- [ ] **Step 2: Implement FsPoller**

Key logic:
- `scanDirectory(projectPath, watchIgnore)` — recursive readdir with pruning, returns `FsSnapshot`
- `diffSnapshots(old, new)` — returns `{ created, deleted, modified }`
- Directory pruning: check `watchIgnore.isIgnored(dirName)` before recursing into subdirectories

- [ ] **Step 3: Run tests, verify pass**

- [ ] **Step 4: Commit**

```bash
git add src/infra/watchers/fs-poller.ts src/infra/watchers/fs-poller.spec.ts
git commit -m "feat(watcher): add FsPoller with directory pruning and snapshot diff"
```

---

## Task 8: InitialScanExtractor

**Files:**
- Create: `src/infra/watchers/initial-scan-extractor.ts`
- Create: `src/infra/watchers/initial-scan-extractor.spec.ts`

- [ ] **Step 1: Write failing tests**

Test cases:
- Should read README.md first 200 lines
- Should parse package.json name/description/deps
- Should generate bounded file tree (2 levels)
- Should collect git log --oneline -20 (if git available)
- Should handle missing README gracefully
- Should handle non-git project

- [ ] **Step 2: Implement InitialScanExtractor**

Uses: GitPoller (for git data), fs-extra (for file reading), WatchIgnore (for tree filtering).

Returns `InitialSnapshot` entity.

Bounds: README 200 lines, 20 deps, file tree 2 levels deep, 20 git log entries.

- [ ] **Step 3: Run tests, verify pass**

- [ ] **Step 4: Commit**

```bash
git add src/infra/watchers/initial-scan-extractor.ts src/infra/watchers/initial-scan-extractor.spec.ts
git commit -m "feat(watcher): add InitialScanExtractor with bounded snapshot collection"
```

---

## Task 9: WatcherRegistry (stateful singleton)

**Files:**
- Create: `src/main/services/watcher-registry.ts`
- Create: `src/main/services/watcher-registry.spec.ts`

- [ ] **Step 1: Write failing tests**

Test cases:
- Should start a watcher (creates polling interval)
- Should stop a watcher (clears interval)
- Should skip poll if previous cycle still running (skip-if-busy)
- Should list active watchers with uptime
- Should update watcher config without restart
- Should detect git HEAD change and update pending-changes
- Should detect fs changes for non-git projects

- [ ] **Step 2: Implement WatcherRegistry**

```typescript
// src/main/services/watcher-registry.ts
import { WatcherState } from "../../domain/entities/watcher-state.js";
import { GitPoller } from "../../infra/watchers/git-poller.js";
import { FsPoller } from "../../infra/watchers/fs-poller.js";
import { WatchIgnore } from "../../infra/security/watch-ignore.js";
import { WatcherConfigRepository } from "../../data/protocols/watcher-config-repository.js";
import { PendingChangesRepository } from "../../data/protocols/pending-changes-repository.js";
import { GitStateRepository } from "../../data/protocols/git-state-repository.js";
import { FsSnapshotRepository } from "../../data/protocols/fs-snapshot-repository.js";

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
    if (!watcher || watcher.polling) return; // skip-if-busy

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

    // 1. Check HEAD
    const currentRev = await poller.getHeadRev();
    if (!currentRev) return;

    const gitState = await this.gitStateRepo.load(projectName);
    const pending = await this.pendingRepo.load(projectName) ?? this.emptyIncremental(projectName);

    // 2. New commits?
    if (gitState && currentRev !== gitState.lastRev) {
      const newCommits = await poller.getCommitsBetween(gitState.lastRev, currentRev);
      pending.commits.push(...newCommits);
      // Cap at 500 commits
      if (pending.commits.length > 500) {
        const dropped = pending.commits.length - 500;
        pending.commits = pending.commits.slice(-500);
        pending.droppedCommits = (pending.droppedCommits ?? 0) + dropped;
      }
    }

    // 3. Status changes
    const currentStatus = await poller.getStatus();
    if (gitState) {
      for (const file of currentStatus.modified) {
        if (!pending.hotFiles.find((f) => f.path === file)) {
          pending.hotFiles.push({ path: file, changeCount: 1, tokens: "~100" });
        } else {
          const entry = pending.hotFiles.find((f) => f.path === file)!;
          entry.changeCount++;
        }
      }
      // Detect created/deleted by comparing with last status
      const newFiles = currentStatus.untracked.filter(
        (f) => !gitState.lastStatus.untracked.includes(f)
      );
      for (const f of newFiles) {
        if (!pending.filesCreated.includes(f)) pending.filesCreated.push(f);
      }
    }

    // 4. Branch changes
    const currentBranches = await poller.getBranches();
    if (gitState) {
      const created = currentBranches.filter((b) => !gitState.lastBranches.includes(b));
      const deleted = gitState.lastBranches.filter((b) => !currentBranches.includes(b));
      pending.branches.created.push(...created.filter((b) => !pending.branches.created.includes(b)));
      pending.branches.deleted.push(...deleted.filter((b) => !pending.branches.deleted.includes(b)));
    }

    // 5. Cancel out: if file in both filesCreated and filesDeleted, remove both
    pending.filesCreated = pending.filesCreated.filter((f) => !pending.filesDeleted.includes(f));
    pending.filesDeleted = pending.filesDeleted.filter((f) => !pending.filesCreated.includes(f));

    // 6. Update totalChanges
    pending.totalChanges = pending.commits.length + pending.hotFiles.length +
      pending.filesCreated.length + pending.filesDeleted.length;

    // 7. Check 1MB soft limit
    const size = JSON.stringify(pending).length;
    if (size > 1_000_000) pending.warning = "inbox is large, consider processing";

    // 8. Persist
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

    const currentSnapshot = await fsPoller.scanDirectory(projectPath, watchIgnore);
    const lastSnapshot = await this.snapshotRepo.load(projectName);
    const pending = await this.pendingRepo.load(projectName) ?? this.emptyIncremental(projectName);

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
      // Cancel out
      pending.filesCreated = pending.filesCreated.filter((f) => !pending.filesDeleted.includes(f));
      pending.filesDeleted = pending.filesDeleted.filter((f) => !pending.filesCreated.includes(f));
    }

    pending.totalChanges = pending.hotFiles.length + pending.filesCreated.length + pending.filesDeleted.length;

    await this.pendingRepo.save(projectName, pending);
    await this.snapshotRepo.save(projectName, currentSnapshot);
  }

  private emptyIncremental(projectName: string): PendingChangesIndex {
    return {
      type: "incremental",
      since: new Date().toISOString(),
      gitAvailable: false,
      totalChanges: 0,
      commits: [],
      hotFiles: [],
      filesCreated: [],
      filesDeleted: [],
      branches: { created: [], deleted: [] },
    };
  }
}
```

Note to implementer: The `pollGit` and `pollFs` methods need full implementation following the spec's "Polling Mechanism" section. The key logic:
- `pollGit`: call `gitPoller.getHeadRev()`, compare with `gitStateRepo.load()`, if changed → `gitPoller.getCommitsBetween()` → merge into `pendingRepo`
- `pollFs`: call `fsPoller.scanDirectory()`, compare with `snapshotRepo.load()` → diff → merge into `pendingRepo`

- [ ] **Step 3: Run tests, verify pass**

- [ ] **Step 4: Commit**

```bash
git add src/main/services/watcher-registry.ts src/main/services/watcher-registry.spec.ts
git commit -m "feat(watcher): add WatcherRegistry with skip-if-busy polling"
```

---

## Task 10: WatcherBootstrap (auto-restore)

**Files:**
- Create: `src/main/services/watcher-bootstrap.ts`

- [ ] **Step 1: Implement WatcherBootstrap**

```typescript
// src/main/services/watcher-bootstrap.ts
import { WatcherConfigRepository } from "../../data/protocols/watcher-config-repository.js";
import { WatcherRegistry } from "./watcher-registry.js";

export class WatcherBootstrap {
  constructor(
    private readonly configRepo: WatcherConfigRepository,
    private readonly registry: WatcherRegistry
  ) {}

  async restore(): Promise<void> {
    const configs = await this.configRepo.loadAll();
    for (const [projectName, state] of Object.entries(configs)) {
      if (state.status === "watching") {
        try {
          await this.registry.start(state);
        } catch (error) {
          console.error(`[watcher] failed to restore ${projectName}:`, error);
        }
      }
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/main/services/watcher-bootstrap.ts
git commit -m "feat(watcher): add WatcherBootstrap for auto-restore on server start"
```

---

## Task 11: Data layer use case implementations

**Files:**
- Create: `src/data/usecases/watch-start/watch-start.ts`
- Create: `src/data/usecases/watch-stop/watch-stop.ts`
- Create: `src/data/usecases/watch-update/watch-update.ts`
- Create: `src/data/usecases/watch-list/watch-list.ts`
- Create: `src/data/usecases/process-inbox/process-inbox.ts`
- Create: `src/data/usecases/process-inbox-detail/process-inbox-detail.ts`
- Create: `src/data/usecases/inbox-ack/inbox-ack.ts`

- [ ] **Step 1: Implement WatchStart use case (with test)**

Key logic:
1. Validate path exists via `fs.pathExists`
2. Detect `.git` via `fs.pathExists(path.join(params.path, ".git"))`
3. Create WatcherState
4. Run InitialScanExtractor → write to pendingRepo
5. Save git baseline to gitStateRepo (if git)
6. Save config to configRepo
7. Start polling via WatcherRegistry
8. Return result

Test: mock all repositories, verify interactions.

- [ ] **Step 2: Implement WatchStop use case**

Key logic: update configRepo status to "stopped", stop registry.

- [ ] **Step 3: Implement WatchUpdate use case**

Key logic: update configRepo, update registry config.

- [ ] **Step 4: Implement WatchList use case**

Key logic: load configRepo, add pending counts from pendingRepo, add uptime from registry.

- [ ] **Step 5: Implement ProcessInbox use case**

Key logic: load pending changes from pendingRepo, load config for processingModel, return index. Token estimation: `ceil(characterCount / 4)`.

- [ ] **Step 6: Implement ProcessInboxDetail use case**

Key logic:
1. Validate file paths with `WatchIgnore.isPathSafe()`
2. For requested commits: use GitPoller.getCommitDetail(hash)
3. For requested files: use GitPoller.getFileDiff() or fs.readFile()
4. Return details

- [ ] **Step 7: Implement InboxAck use case**

Key logic: clear pendingRepo, update configRepo lastProcessed, clear gitStateRepo baseline to current.

- [ ] **Step 8: Run all use case tests**

```bash
npx vitest run src/data/usecases/watch-start/ src/data/usecases/inbox-ack/ src/data/usecases/process-inbox/
```

- [ ] **Step 9: Commit**

```bash
git add src/data/usecases/watch-start/ src/data/usecases/watch-stop/ src/data/usecases/watch-update/ src/data/usecases/watch-list/ src/data/usecases/process-inbox/ src/data/usecases/process-inbox-detail/ src/data/usecases/inbox-ack/
git commit -m "feat(watcher): add 7 use case implementations"
```

---

## Task 12: AbsolutePathValidator + Controllers

**Files:**
- Create: `src/validators/absolute-path-validator.ts`
- Create: 7 controller files in `src/presentation/controllers/`

- [ ] **Step 1: Create AbsolutePathValidator**

```typescript
// src/validators/absolute-path-validator.ts
import path from "path";
import { Validator } from "../presentation/protocols/validator.js";
import { InvalidParamError } from "../presentation/errors/index.js";

export class AbsolutePathValidator implements Validator {
  constructor(private readonly fieldName: string) {}

  validate(input?: any): Error | null {
    if (!input?.[this.fieldName]) return null;
    const p = input[this.fieldName];
    if (!path.isAbsolute(p)) {
      return new InvalidParamError(`${this.fieldName} must be an absolute path`);
    }
    return null;
  }
}
```

- [ ] **Step 2: Create all 7 controllers**

Follow exact pattern from existing `ReadController`. Each controller:
1. Validates input via ValidatorComposite
2. Calls use case
3. Returns ok() or error response

Example for WatchStartController:

```typescript
// src/presentation/controllers/watch-start/watch-start-controller.ts
import { Controller } from "../../protocols/controller.js";
import { Request, Response } from "../../protocols/index.js";
import { Validator } from "../../protocols/validator.js";
import { WatchStartUseCase, WatchStartParams, WatchStartResult } from "../../../domain/usecases/watch-start.js";
import { badRequest, ok, serverError } from "../../helpers/index.js";

export class WatchStartController implements Controller<WatchStartParams, WatchStartResult> {
  constructor(
    private readonly useCase: WatchStartUseCase,
    private readonly validator: Validator
  ) {}

  async handle(request: Request<WatchStartParams>): Promise<Response<WatchStartResult>> {
    try {
      const error = this.validator.validate(request.body);
      if (error) return badRequest(error);

      const result = await this.useCase.watchStart(request.body!);
      return ok(result);
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
```

Repeat pattern for: WatchStop, WatchUpdate, WatchList, ProcessInbox, ProcessInboxDetail, InboxAck.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/validators/absolute-path-validator.ts src/presentation/controllers/watch-start/ src/presentation/controllers/watch-stop/ src/presentation/controllers/watch-update/ src/presentation/controllers/watch-list/ src/presentation/controllers/process-inbox/ src/presentation/controllers/process-inbox-detail/ src/presentation/controllers/inbox-ack/
git commit -m "feat(watcher): add 7 controllers and AbsolutePathValidator"
```

---

## Task 13: Factories + Route registration

**Files:**
- Create: `src/main/factories/use-cases/watcher-factories.ts`
- Create: 7 controller factory directories in `src/main/factories/controllers/`
- Modify: `src/main/protocols/mcp/routes.ts`
- Modify: `src/main/protocols/mcp/app.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Create use case factories**

```typescript
// src/main/services/watcher-singletons.ts
// Stateful singletons — lives in main/services/ (not factories) because
// these hold runtime state across the server lifetime.
import { env } from "../config/env.js";
import { FsWatcherConfigRepository } from "../../infra/filesystem/repositories/fs-watcher-config-repository.js";
import { FsPendingChangesRepository } from "../../infra/filesystem/repositories/fs-pending-changes-repository.js";
import { FsGitStateRepository } from "../../infra/filesystem/repositories/fs-git-state-repository.js";
import { FsSnapshotRepository } from "../../infra/filesystem/repositories/fs-snapshot-repository.js";
import { WatcherRegistry } from "./watcher-registry.js";
import { WatcherBootstrap } from "./watcher-bootstrap.js";

export const configRepo = new FsWatcherConfigRepository(env.rootPath);
export const pendingRepo = new FsPendingChangesRepository(env.rootPath);
export const gitStateRepo = new FsGitStateRepository(env.rootPath);
export const snapshotRepo = new FsSnapshotRepository(env.rootPath);

export const watcherRegistry = new WatcherRegistry(
  configRepo, pendingRepo, gitStateRepo, snapshotRepo
);

export const watcherBootstrap = new WatcherBootstrap(configRepo, watcherRegistry);
```

- [ ] **Step 2: Create 7 controller factories**

Each factory follows the pattern:
```typescript
// src/main/factories/controllers/watch-start/index.ts
import { WatchStartController } from "../../../../presentation/controllers/watch-start/watch-start-controller.js";
import { makeWatchStartValidation } from "./watch-start-validation-factory.js";
import { WatchStart } from "../../../../data/usecases/watch-start/watch-start.js";
import { configRepo, pendingRepo, gitStateRepo, snapshotRepo, watcherRegistry } from "../../services/watcher-singletons.js";

export const makeWatchStartController = () => {
  const useCase = new WatchStart(configRepo, pendingRepo, gitStateRepo, snapshotRepo, watcherRegistry);
  return new WatchStartController(useCase, makeWatchStartValidation());
};
```

Each with a validation factory using ValidatorComposite + RequiredFieldValidator + PathSecurityValidator + AbsolutePathValidator as needed.

- [ ] **Step 3: Add routes to routes.ts**

Add 7 new `router.setTool({ schema, handler })` blocks to `src/main/protocols/mcp/routes.ts`. Follow existing pattern exactly. See spec for tool schemas (names, descriptions, inputSchema).

- [ ] **Step 4: Add bootstrap to server startup**

In `src/main/index.ts`, after `app.start()`:
```typescript
import { watcherBootstrap } from "./services/watcher-singletons.js";

app.start().then(() => {
  watcherBootstrap.restore().catch(console.error);
}).catch(error => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 5: Build and test**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/main/
git commit -m "feat(watcher): add factories, routes, and bootstrap integration"
```

---

## Task 14: Patch overview + list_projects for token cost and pending changes

**Files:**
- Modify: `src/data/usecases/overview/overview.ts`
- Modify: `src/data/usecases/list-projects/list-projects.ts`
- Modify: `src/infra/filesystem/repositories/fs-file-repository.ts`
- Modify: `src/infra/filesystem/repositories/fs-project-repository.ts`

- [ ] **Step 1: Add token estimation to overview response**

In `FsFileRepository.listFilesWithMetadata()`, add approximate token count per file. Token estimate: read file, `Math.ceil(content.length / 4)`.

```typescript
// In the returned array items:
{
  project,
  fileName,
  metadata,
  abstract,
  tokens: `~${Math.ceil(content.length / 4)}`
}
```

- [ ] **Step 2: Add pending changes info to overview**

In the overview use case, inject `PendingChangesRepository` dependency. Check if project has pending changes via `pendingRepo.countChanges()`. Add `pendingChanges` and `pendingSince` to response.

- [ ] **Step 3: Add pending changes info to list_projects**

In `list-projects.ts`, inject `PendingChangesRepository` and `WatcherConfigRepository`. For each project, check if it has a watcher with pending changes. Append to response string:

```typescript
// If project has pending changes:
`${projectName} (${fileCount} files, pending: ${count} changes since ${since})`
```

Update the factory (`src/main/factories/use-cases/list-projects-factory.ts`) to inject the new dependencies.

- [ ] **Step 4: Add error status to WatcherRegistry on directory-not-found**

In `WatcherRegistry.poll()`, if `fs.pathExists(watcher.state.path)` returns false:
```typescript
watcher.state.status = "error";
watcher.state.reason = "directory not found";
await this.configRepo.update(projectName, { status: "error", reason: "directory not found" });
clearInterval(watcher.intervalHandle);
```

- [ ] **Step 5: Run existing tests**

```bash
npx vitest run src/data/usecases/overview/ src/data/usecases/list-projects/
```

- [ ] **Step 6: Commit**

```bash
git add src/data/usecases/overview/ src/data/usecases/list-projects/ src/infra/filesystem/repositories/fs-file-repository.ts src/infra/filesystem/repositories/fs-project-repository.ts src/main/factories/use-cases/ src/main/services/watcher-registry.ts
git commit -m "feat(watcher): add token cost, pending changes to overview/list_projects, error status handling"
```

---

## Task 15: Integration test

**Files:**
- Create: `src/infra/watchers/integration.spec.ts`

- [ ] **Step 1: Write integration test**

Full cycle: create temp git repo → watch_start → make commits → poll triggers → process_inbox returns index → process_inbox_detail returns commit diffs → inbox_ack clears inbox.

```typescript
// src/infra/watchers/integration.spec.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs-extra";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

describe("Watcher Integration", () => {
  let projectDir: string;
  let watcherRoot: string;

  beforeEach(async () => {
    projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "watcher-int-"));
    watcherRoot = await fs.mkdtemp(path.join(os.tmpdir(), "watcher-root-"));

    // Initialize git repo with initial commit
    await execAsync("git init", { cwd: projectDir });
    await execAsync("git config user.email test@test.com", { cwd: projectDir });
    await execAsync("git config user.name Test", { cwd: projectDir });
    await fs.writeFile(path.join(projectDir, "README.md"), "# Test");
    await execAsync("git add . && git commit -m 'init'", { cwd: projectDir });
  });

  afterEach(async () => {
    await fs.remove(projectDir);
    await fs.remove(watcherRoot);
  });

  it("should detect new commits via git polling", async () => {
    // 1. Setup repositories pointing to watcherRoot
    // 2. Create GitPoller for projectDir
    // 3. Record initial git state
    // 4. Make a new commit in projectDir
    // 5. Poll and verify pending-changes.json is updated
    // 6. Verify process_inbox returns the new commit in index
    // 7. Verify process_inbox_detail returns the commit diff
    // 8. Call inbox_ack and verify pending-changes.json is cleared
  });
});
```

- [ ] **Step 2: Run integration test**

```bash
npx vitest run src/infra/watchers/integration.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/infra/watchers/integration.spec.ts
git commit -m "test(watcher): add integration test for full watch-poll-process-ack cycle"
```

---

## Task 16: Final build + manual smoke test

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Smoke test with MCP inspector (manual)**

Start the MCP server and call:
1. `memory_bank_watch_list` → empty
2. `memory_bank_watch_start({ path: "/some/project", projectName: "test" })`
3. `memory_bank_watch_list` → shows "test" with status "watching"
4. Make a git commit in the project
5. Wait 30s for polling
6. `memory_bank_process_inbox({ projectName: "test" })` → shows commit in index
7. `memory_bank_inbox_ack({ projectName: "test" })` → acknowledged
8. `memory_bank_watch_stop({ projectName: "test" })`

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(watcher): complete autonomous project watcher implementation"
```
