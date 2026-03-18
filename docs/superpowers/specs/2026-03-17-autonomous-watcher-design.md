# Autonomous Project Watcher

## Summary

Background watcher that monitors project directories and collects change signals into an inbox. LLM processes accumulated signals on demand, turning raw data into structured memory. Disabled by default — opt-in per project.

## Problem

Memory bank requires manual maintenance. Developers forget to update project context. When returning to a project after days/weeks, there's no record of what changed.

## Solution

A polling-based watcher inside the MCP server that tracks filesystem and git changes, stores them as a compact manifest (`pending-changes.json`), and surfaces unprocessed changes when the LLM interacts with the memory bank.

**Key principle:** Watcher collects raw signals. Git is the source of truth. LLM is the only one who decides what's important.

---

## Architecture

### New MCP Tools (7)

#### `memory_bank_watch_start`

Registers a project for watching, performs initial scan, starts polling.

```
Input:
  path: string              — absolute path to project directory
  projectName: string       — name in memory bank
  processingModel?: string  — "haiku" | "sonnet" | "opus" (default: "sonnet")
  pollInterval?: number     — seconds between polls (default: 30)

Output:
  status: "watching"
  gitAvailable: boolean
  hasPendingChanges: true
  warning?: string          — e.g. "No git detected — change tracking is limited"
```

On start:
1. Validate that `path` exists and is a directory
2. Detect `.git` presence
3. Collect initial scan snapshot
4. Write `pending-changes.json` with `"type": "initial"`
5. Save git baseline state to `git-state.json` (if git available)
6. Start polling loop
7. Save to `config.json`

Initial scan collects (bounded, ~2-5KB):
- README.md (first 200 lines)
- Package manifest (package.json / Cargo.toml / go.mod) — name, description, top 20 deps
- File tree (2 levels deep, ignoring node_modules/dist/target/.git)
- `git log --oneline -20` (if git available)
- `git branch -a` (if git available)
- `git status --porcelain` (if git available)

#### `memory_bank_watch_stop`

```
Input:
  projectName: string

Output:
  status: "stopped"
```

Stops polling, sets status to `"stopped"` in `config.json` (does not remove entry). Does NOT delete `pending-changes.json` (preserves unprocessed data). `process_inbox`, `process_inbox_detail`, and `inbox_ack` remain callable on stopped watchers. Stopped watchers with pending changes appear in `watch_list` with `status: "stopped"`.

#### `memory_bank_watch_update`

```
Input:
  projectName: string
  processingModel?: string
  pollInterval?: number

Output:
  status: "updated"
```

Updates config without restart. New pollInterval takes effect on next cycle.

#### `memory_bank_watch_list`

```
Input: (none)

Output: Array of:
  projectName: string
  path: string
  processingModel: string
  gitAvailable: boolean
  status: "watching" | "stopped" | "error"
  reason?: string              — present only when status is "error" (e.g. "directory not found")
  pendingChangesCount: number
  lastProcessed: string (ISO date)
  uptime: number (seconds)
```

#### `memory_bank_process_inbox`

Returns a **compact index** of pending changes — not full content. Designed for progressive disclosure: LLM scans the index, decides what's important, then fetches details via `process_inbox_detail`. Does NOT clear the inbox. Idempotent read.

Inspired by [claude-mem's 3-layer workflow](https://github.com/thedotmack/claude-mem): index (~50-100 tokens/result) → detail → full content. ~10x token savings vs loading everything.

```
Input:
  projectName: string

Output:
  processingModel: string
  gitAvailable: boolean
  totalChanges: number
  index:
    commits: [
      { hash, message, filesCount, tokens: "~200" }    — token cost visible
    ]
    hotFiles: [
      { path, changeCount, tokens: "~150" }             — token cost visible
    ]
    filesCreated: [ "src/auth/guard.ts", ... ]
    filesDeleted: [ "src/old-auth.ts", ... ]
    branches: { created: [...], deleted: [...] }
    snapshot?: { ... }                                   — only for type: "initial"
```

**Token cost visibility:** each item shows estimated `~tokens` for fetching its detail. LLM makes ROI decisions: "is this 200-token commit worth loading?" Token estimates use `ceil(characterCount / 4)` as a rough approximation. Precision is not critical — the goal is order-of-magnitude visibility.

**Note:** `processingModel` is **client-side metadata** stored by the MCP server for convenience. The server never acts on this value. It exists because the user explicitly configures which model processes their inbox (cost control). The server stores it alongside other watcher config to keep all per-project settings in one place. If a client does not use model delegation, it can ignore this field.

#### `memory_bank_process_inbox_detail`

Fetches full details for specific commits and/or files from the inbox. Called after reviewing the index from `process_inbox`. Only loads what the LLM requested — not the entire inbox.

```
Input:
  projectName: string
  commits?: string[]          — list of commit hashes to get full details for
  files?: string[]            — list of file paths to get current content/diff for

Output:
  commits: [
    { hash, message, author, date, diff: "full diff text" }
  ]
  files: [
    { path, content: "current file content or git diff" }
  ]
```

For git projects: commits return `git log -p <hash>`, files return `git diff <lastProcessedRev> -- <path>`.
For non-git projects: files return current file content (first 500 lines).

**Security:** All requested file paths in `files[]` must be relative paths resolved against the project's `path`. Absolute paths and paths containing `..` that escape the project root are rejected with an error. This applies to both git and non-git modes. Paths are also checked against the security blacklist (`.env*`, `*.key`, etc.).

---

**Client-Side Processing (not part of MCP server):**

The orchestrating LLM reads `processingModel` and delegates to the configured model:

```
Step 1: process_inbox(project) → scan index (~500 tokens)
Step 2: LLM decides: "commits abc123, def456 look important, file login.ts changed 12 times"
Step 3: process_inbox_detail(project, commits: ["abc123"], files: ["src/auth/login.ts"]) → ~400 tokens
Step 4: LLM writes memory bank files via memory_bank_upsert
Step 5: inbox_ack(project) → clear
```

Total: ~900 tokens instead of loading all 47 changes (~5000+ tokens).

#### `memory_bank_inbox_ack`

Clears `pending-changes.json`, resets `git-state.json` baseline, and updates `lastProcessed` timestamp. Called by LLM after successful processing.

```
Input:
  projectName: string

Output:
  status: "acknowledged"
  lastProcessed: string (ISO date)
```

Crash safety: if LLM crashes before ack, next session sees the same pending changes and reprocesses. Idempotent — reprocessing the same changes produces equivalent memory updates.

### Modified Tools (2)

#### `memory_bank_overview`

Two enhancements:

**1. Token cost per file** (always, not just for watched projects):
```json
{
  "project": "my-app",
  "fileName": "architecture.md",
  "abstract": "REST API on Express with PostgreSQL",
  "tokens": "~850",
  "type": "architecture",
  "status": "active"
}
```

LLM sees `~850 tokens` and decides: load L1 (~200 tokens) or L2 (full ~850). Enables informed ROI decisions, inspired by claude-mem's token cost visibility pattern.

**2. Pending changes indicator** (for watched projects only):
```json
{ "project": "my-app", "pendingChanges": 23, "pendingSince": "2026-03-14" }
```

#### `list_projects`

When a watched project has pending changes, append to the project entry:

```
my-app (12 files, last updated 2026-03-16, pending: 23 changes since 2026-03-14)
```

Only shown for projects with active or stopped watchers that have unprocessed changes.

---

## Pending Changes Format

Single file per project: `pending-changes.json`

### Initial scan

```json
{
  "type": "initial",
  "timestamp": "2026-03-16T20:00:00Z",
  "gitAvailable": true,
  "snapshot": {
    "readme": "first 200 lines...",
    "manifest": { "name": "my-app", "deps": ["express", "..."] },
    "fileTree": ["src/", "src/auth/", "src/auth/login.ts", "..."],
    "gitLog": [
      { "hash": "abc123", "message": "feat: add auth", "filesCount": 5 }
    ],
    "branches": ["main", "feature/auth"],
    "gitStatus": { "modified": [], "untracked": [] }
  }
}
```

### Incremental (git project)

```json
{
  "type": "incremental",
  "since": "2026-03-14T10:00:00Z",
  "gitAvailable": true,
  "commits": [
    { "hash": "abc123", "message": "feat: add auth", "filesCount": 5 },
    { "hash": "def456", "message": "fix: login redirect", "filesCount": 2 }
  ],
  "filesChanged": {
    "src/auth/login.ts": { "changeCount": 12 },
    "README.md": { "changeCount": 2 }
  },
  "filesCreated": ["src/auth/guard.ts"],
  "filesDeleted": ["src/old-auth.ts"],
  "branches": {
    "created": ["feature/auth"],
    "deleted": ["fix/typo"]
  }
}
```

### Incremental (non-git project)

```json
{
  "type": "incremental",
  "since": "2026-03-14T10:00:00Z",
  "gitAvailable": false,
  "commits": [],
  "filesChanged": {
    "readme.md": { "changeCount": 3 },
    "config.yaml": { "changeCount": 1 }
  },
  "filesCreated": ["doc/new-spec.md"],
  "filesDeleted": ["old-notes.txt"],
  "branches": {}
}
```

LLM sees `gitAvailable: false` and reads modified files directly via `Read` tool instead of `git diff`.

### Accumulation Semantics

**`changeCount` definition:** number of polling cycles in which the file appeared as modified. Not line count, not commit count — just "how many times the poller saw this file as changed."

**Multiple poll cycles before ack:** each poll merges into the existing `pending-changes.json`:
- New commits are appended to `commits[]`
- `filesChanged[path].changeCount` is incremented
- New files are added to `filesCreated[]` (unless already present)
- Deleted files are added to `filesDeleted[]`
- If a file appears in both `filesCreated` and `filesDeleted`, both entries are removed (cancel out)

**Initial scan not yet acked + new changes arrive:** the initial scan payload is preserved. New changes are accumulated into a separate `"pending"` field inside the same file:

```json
{
  "type": "initial",
  "timestamp": "...",
  "snapshot": { ... },
  "pending": {
    "commits": [...],
    "filesChanged": { ... },
    "filesCreated": [],
    "filesDeleted": []
  }
}
```

LLM processes both `snapshot` (for initial understanding) and `pending` (for recent changes) in one pass.

### Size Limits

- `commits[]` capped at 500 entries. When exceeded, oldest commits are dropped and a `"droppedCommits": N` counter is added. LLM can use `git log` for full history.
- `filesChanged` map: capped at 5000 entries. When exceeded, least-changed files are dropped and `"droppedFiles": N` counter is added.
- `filesCreated` / `filesDeleted`: no explicit cap. Bounded in practice by the 1MB soft limit on the total file.
- Total `pending-changes.json` soft limit: 1MB. At 1MB, a `"warning": "inbox is large, consider processing"` flag is set. No data is dropped.

---

## Persistence

```
<MEMORY_BANK_ROOT>/
  .watchers/
    config.json                    — watcher configs (survives restarts)
    <projectName>/
      pending-changes.json         — current unprocessed changes
      git-state.json               — git polling baseline (lastRev, lastBranches, lastStatus)
      last-snapshot.json           — for non-git: { path: mtime } pairs
```

### config.json

```json
{
  "my-app": {
    "path": "/Users/dev/projects/my-app",
    "processingModel": "sonnet",
    "pollInterval": 30,
    "gitAvailable": true,
    "lastProcessed": "2026-03-16T20:00:00Z"
  }
}
```

### git-state.json

Persists git polling baseline across server restarts.

```json
{
  "lastRev": "abc123def456...",
  "lastBranches": ["main", "feature/auth", "remotes/origin/main"],
  "lastStatus": {
    "modified": ["src/auth/login.ts"],
    "untracked": ["tmp.log"]
  }
}
```

On MCP server start: read `config.json`, read `git-state.json` per project, restart all pollers with correct baselines.

If `git-state.json` is missing (first start after migration): treat current git state as baseline, no pending changes generated for the first poll.

---

## Polling Mechanism

### Git projects (every `pollInterval` seconds)

```
1. git rev-parse HEAD
   → if changed since lastRev (from git-state.json):
     git log --oneline <lastRev>..<newRev> → append to commits[]
     update lastRev in git-state.json

2. git status --porcelain
   → compare with lastStatus (from git-state.json)
   → update filesChanged, filesCreated, filesDeleted
   → update lastStatus in git-state.json

3. git branch -a
   → compare with lastBranches (from git-state.json)
   → update branches.created, branches.deleted
   → update lastBranches in git-state.json
```

Cost: ~10ms per poll. Zero load at 30s intervals.

**Execution model:**
- All git commands run via async `child_process.exec` (not execSync)
- Per-command timeout: 5 seconds. On timeout, skip this cycle, log warning.
- Skip-if-busy: if a poll cycle is still running when the next interval fires, skip. No queuing, no concurrent polls.

### Non-git projects (every `pollInterval` seconds)

```
1. Recursive readdir with PRUNING of ignored directories
   (.watchignore and default blacklist checked DURING traversal,
    not post-filtered — skips entire subtrees like node_modules/)
2. For each file: { path, mtime, size }
3. Compare with last-snapshot.json
4. Differences → filesCreated / filesDeleted / filesModified
5. Save new snapshot to last-snapshot.json
```

Cost: ~50-100ms for 1000 files (after pruning). Negligible at 30s intervals.

---

## Error Handling

### Git command failures

| Error | Behavior |
|---|---|
| `git rev-parse HEAD` fails (detached HEAD) | Use `git rev-parse --short HEAD` fallback. If still fails, skip commit tracking for this cycle, log warning. |
| `git status` fails | Skip file change tracking for this cycle, log warning. |
| `git log` fails (shallow clone, missing refs) | Record `{ "error": "git log failed", "reason": "..." }` in pending-changes. LLM sees this and can investigate. |
| `git` not found in PATH | Set `gitAvailable: false`, switch to non-git polling mode. |

### Filesystem errors

| Error | Behavior |
|---|---|
| Project directory deleted/moved | Stop polling, set status to `"error"`. `watch_list` shows `{ status: "error", reason: "directory not found" }`. Watcher does NOT auto-remove — user must `watch_stop` explicitly. |
| Permission denied on readdir | Skip inaccessible paths, log warning. Continue polling accessible files. |
| `pending-changes.json` corrupted | Recreate from scratch with current state as baseline. Log warning. |
| `config.json` corrupted | Log error, start with empty config. Existing pending-changes files are preserved. |

### General

- All errors are logged to stderr (visible in MCP server logs).
- Polling continues after non-fatal errors — one bad cycle does not stop the watcher.
- Fatal errors (directory gone) pause polling but preserve state for recovery.

---

## Security

### Default blacklist (always ignored)

```
.env*
*.pem
*.key
*.p12
*.pfx
credentials*
secrets*
.aws/
.ssh/
```

### .watchignore

Per-project file at `<projectPath>/.watchignore`. Gitignore-compatible syntax (via `ignore` npm package — proven, battle-tested parser). Applied on top of `.gitignore` (if present) and the default blacklist.

### Rules

- Never include file contents of blacklisted files in pending-changes
- Never include blacklisted files in file tree during initial scan
- Respect `.gitignore` for file tree generation
- Non-git readdir pruning applies blacklist DURING traversal (not post-filter)

---

## Opt-in by Default

- No watchers active on fresh install
- No polling, no pending-changes, no token usage
- Activated only via explicit `memory_bank_watch_start`
- Passive surfacing ("pending changes") only appears for projects with unprocessed changes

---

## Observation Typing Convention

When LLM processes the inbox and writes memory bank files, it should use enriched frontmatter types. Inspired by claude-mem's observation typing system which uses semantic categories with visual icons.

### Extended types for frontmatter

```yaml
---
type: decision          # architectural or design decision
severity: critical      # optional: critical | high | normal
tags: [auth, migration]
---
```

**Recommended types** (extends existing `architecture`, `progress`, `decisions`, `reference`, `notes`):

| Type | Icon | When to use |
|---|---|---|
| `decision` | `🟤` | Architectural or design choices |
| `gotcha` | `🔴` | Critical edge cases, pitfalls, things that broke |
| `discovery` | `🟣` | New learning about codebase or domain |
| `trade-off` | `⚖️` | Deliberate compromise with known downsides |
| `change` | `🟢` | Significant code/architecture change |
| `problem-solution` | `🟡` | Bug fix or workaround |

These types are **conventions, not enforced by the MCP server**. The server stores whatever the LLM writes. The `memory_bank_query` tool can filter by any type string.

The watcher's `process_inbox` index uses similar categorization to help LLM quickly scan what's important — `🔴 gotcha` items should typically be fetched first.

---

## Limitations (v1)

- No automatic LLM trigger — passive surfacing only
- No locking for concurrent sessions — last write wins
- Non-git projects: file events only, no diffs
- Polling-based, not real-time — delay up to `pollInterval`
- One watcher per project (not per branch)

---

## v2 Roadmap (not in scope for v1)

### SessionStart hook for auto-trigger

The biggest gap in v1 is passive surfacing — LLM only sees pending changes when it happens to call `memory_bank_overview`. In v2, a Claude Code `SessionStart` hook can proactively notify:

```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "node <plugin-path>/check-pending-watchers.js",
        "timeout": 5
      }]
    }]
  }
}
```

The script calls the MCP server's HTTP endpoint (or reads `pending-changes.json` directly), and if pending changes exist, returns context:

```
⚠️ project my-app has 47 pending changes since 2026-03-14. Run process_inbox to update memory.
```

This is injected into Claude's context at session start — zero manual intervention. Inspired by claude-mem's `SessionStart` context injection pattern.

### Non-git watch mode via chokidar

File-level watching with content diffs for non-git projects.

### Web viewer UI

Browser-based visualization of memory bank + pending changes at `localhost:<port>`.

---

## Clean Architecture Mapping

Follows the existing codebase pattern exactly:

```
domain/
  entities/
    watcher-state.ts               — entity: project, path, model, interval, status
  usecases/
    watch-start.ts                 — WatchStartParams + WatchStartUseCase interface
    watch-stop.ts                  — WatchStopParams + WatchStopUseCase interface
    watch-update.ts                — WatchUpdateParams + WatchUpdateUseCase interface
    watch-list.ts                  — WatchListUseCase interface
    process-inbox.ts               — ProcessInboxParams + ProcessInboxUseCase interface
    process-inbox-detail.ts        — ProcessInboxDetailParams + ProcessInboxDetailUseCase interface
    inbox-ack.ts                   — InboxAckParams + InboxAckUseCase interface

data/
  protocols/
    watcher-config-repository.ts   — interface for watcher config persistence
    pending-changes-repository.ts  — interface for pending-changes read/write/ack
    git-state-repository.ts        — interface for git baseline persistence
    fs-snapshot-repository.ts      — interface for non-git snapshot persistence
  usecases/
    watch-start/                   — implements WatchStartUseCase
    watch-stop/                    — implements WatchStopUseCase
    watch-update/                  — implements WatchUpdateUseCase
    watch-list/                    — implements WatchListUseCase
    process-inbox/                 — implements ProcessInboxUseCase
    process-inbox-detail/          — implements ProcessInboxDetailUseCase
    inbox-ack/                     — implements InboxAckUseCase

infra/
  filesystem/
    repositories/
      fs-watcher-config-repository.ts   — reads/writes config.json
      fs-pending-changes-repository.ts  — reads/writes/acks pending-changes.json
      fs-git-state-repository.ts        — reads/writes git-state.json
      fs-snapshot-repository.ts         — reads/writes last-snapshot.json
  watchers/                       — new infra subdirectory, same pattern as infra/filesystem/
    git-poller.ts                  — git rev-parse, status, log, branch
    fs-poller.ts                   — readdir + stat + snapshot diff
    initial-scan-extractor.ts      — collects bounded project snapshot
  security/                        — new infra subdirectory, groups security concerns
    watch-ignore.ts                — blacklist + .watchignore parsing

presentation/
  controllers/
    watch-start/
    watch-stop/
    watch-update/
    watch-list/
    process-inbox/
    process-inbox-detail/
    inbox-ack/

main/
  factories/
    controllers/
      watch-start/
      watch-stop/
      watch-update/
      watch-list/
      process-inbox/
      process-inbox-detail/
      inbox-ack/
    usecases/
      watch-start/
      watch-stop/
      watch-update/
      watch-list/
      process-inbox/
      process-inbox-detail/
      inbox-ack/
  services/                        — NEW PATTERN: long-lived stateful singletons.
                                     WatcherRegistry holds runtime state (Map of active
                                     pollers, setInterval handles) across the server
                                     lifetime. This has no precedent in the current
                                     codebase — factories are stateless constructors.
                                     We introduce main/services/ for this purpose.
    watcher-registry.ts            — Map of active pollers + setInterval management
    watcher-bootstrap.ts           — auto-restore on MCP server start
```

---

## Implementation Phases

### Phase 1: Domain + Infrastructure Core

- WatcherState entity
- Use case interfaces (7)
- Repository interfaces in `data/protocols/` (4)
- WatchIgnore (security blacklist + .watchignore)
- Filesystem repository implementations (config, pending-changes, git-state, snapshot)

### Phase 2: Pollers + Extractor

- GitPoller (rev-parse + status + log + branch)
- FsPoller (readdir + stat + snapshot diff with directory pruning)
- InitialScanExtractor (bounded project snapshot)

### Phase 3: Orchestration

- WatcherRegistry (Map + setInterval management)
- WatcherBootstrap (auto-restore on MCP server start)
- Use case implementations in `data/usecases/`

### Phase 4: MCP Tools

- 7 new controllers + factories
- Route registration in routes.ts
- Patch `memory_bank_overview` response for pending changes
- Patch `list_projects` response for pending changes

### Phase 5: Tests

- Unit tests per layer (domain, infra, presentation)
- Integration test: full cycle watch_start → poll → pending-changes → process → ack
- Git mock via child_process.exec stub
- Filesystem tests via temp directory
- Error handling tests (missing dir, corrupted files, git failures)

---

## Testing Strategy

| Layer | What | How |
|---|---|---|
| WatcherState | creation, serialization, validation | unit, plain assertions |
| GitPoller | parse git output, detect changes, handle errors | unit, mock exec |
| FsPoller | snapshot diff, detect create/delete/modify, pruning | unit, temp dir |
| FsWatcherConfigRepository | read/write config.json, corruption recovery | unit, temp dir |
| FsPendingChangesRepository | increment, ack, merge, size limits, index generation | unit, temp dir |
| FsGitStateRepository | read/write git-state.json, missing file handling | unit, temp dir |
| InitialScanExtractor | bounded snapshot, git and non-git modes | unit, mock exec + temp dir |
| WatchIgnore | blacklist, .watchignore parsing, gitignore compat | unit, patterns |
| WatcherRegistry | start/stop pollers, interval management | unit, mock pollers |
| WatcherBootstrap | restore from config, handle missing state | unit, mock registry |
| Controllers | input validation, delegation | unit, mock use cases |
| ProcessInboxDetail | git diff/log for requested items, file content | unit, mock exec + temp dir |
| Token estimation | approximate token counts for index items | unit, string length heuristics |
| Integration | full watch → poll → process_inbox → process_inbox_detail → ack cycle | integration, temp git repo |
