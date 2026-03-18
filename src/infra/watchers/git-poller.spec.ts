import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitPoller } from "./git-poller.js";

vi.mock("child_process", () => ({
  exec: vi.fn(),
}));

import { exec } from "child_process";

const mockExec = exec as unknown as ReturnType<typeof vi.fn>;

function setupExec(stdout: string, stderr = "", error: Error | null = null) {
  mockExec.mockImplementation(
    (
      _cmd: string,
      _opts: unknown,
      cb: (err: Error | null, stdout: string, stderr: string) => void
    ) => {
      cb(error, stdout, stderr);
    }
  );
}

describe("GitPoller", () => {
  let poller: GitPoller;

  beforeEach(() => {
    poller = new GitPoller("/some/project");
    vi.clearAllMocks();
  });

  it("should get current HEAD rev", async () => {
    setupExec("abc1234def5678\n");
    const rev = await poller.getHeadRev();
    expect(rev).toBe("abc1234def5678");
  });

  it("should return null when HEAD rev command fails", async () => {
    setupExec("", "", new Error("not a git repo"));
    const rev = await poller.getHeadRev();
    expect(rev).toBeNull();
  });

  it("should get new commits between revs and parse filesCount from --stat", async () => {
    const output = [
      "abc1234 feat: add login",
      " src/auth.ts | 10 +++++-----",
      " src/user.ts | 5 ++---",
      " 2 files changed, 8 insertions(+), 7 deletions(-)",
      "",
      "def5678 fix: typo",
      " README.md | 2 +-",
      " 1 file changed, 1 insertion(+), 1 deletion(-)",
      "",
    ].join("\n");

    setupExec(output);
    const commits = await poller.getCommitsBetween("aaa1111", "bbb2222");
    expect(commits).toHaveLength(2);
    expect(commits[0].hash).toBe("abc1234");
    expect(commits[0].message).toBe("feat: add login");
    expect(commits[0].filesCount).toBe(2);
    expect(commits[0].tokens).toBe(`~${Math.ceil("feat: add login".length / 4)}`);
    expect(commits[1].hash).toBe("def5678");
    expect(commits[1].message).toBe("fix: typo");
    expect(commits[1].filesCount).toBe(1);
  });

  it("should return empty array when getCommitsBetween fails", async () => {
    setupExec("", "", new Error("bad revision"));
    const commits = await poller.getCommitsBetween("aaa1111", "bbb2222");
    expect(commits).toEqual([]);
  });

  it("should get current status and parse --porcelain output", async () => {
    const output = [
      " M src/index.ts",
      "?? src/new-file.ts",
      " M src/other.ts",
      "?? docs/notes.md",
    ].join("\n");

    setupExec(output);
    const status = await poller.getStatus();
    expect(status.modified).toEqual(["src/index.ts", "src/other.ts"]);
    expect(status.untracked).toEqual(["src/new-file.ts", "docs/notes.md"]);
    expect(status.deleted).toEqual([]);
  });

  it("should parse staged adds (A) as modified", async () => {
    const output = ["A  src/new-staged.ts"].join("\n");
    setupExec(output);
    const status = await poller.getStatus();
    expect(status.modified).toContain("src/new-staged.ts");
    expect(status.deleted).toEqual([]);
  });

  it("should parse deleted files (D) into deleted array", async () => {
    const output = [" D src/removed.ts", "D  src/also-removed.ts"].join("\n");
    setupExec(output);
    const status = await poller.getStatus();
    expect(status.deleted).toContain("src/removed.ts");
    expect(status.deleted).toContain("src/also-removed.ts");
    expect(status.modified).toEqual([]);
  });

  it("should parse renames (R) as modified", async () => {
    const output = ["R  src/old.ts -> src/new.ts"].join("\n");
    setupExec(output);
    const status = await poller.getStatus();
    expect(status.modified).toContain("src/old.ts -> src/new.ts");
    expect(status.deleted).toEqual([]);
  });

  it("should return empty status when git status fails", async () => {
    setupExec("", "", new Error("not a git repo"));
    const status = await poller.getStatus();
    expect(status).toEqual({ modified: [], untracked: [], deleted: [] });
  });

  it("should get branches and strip * and whitespace", async () => {
    const output = [
      "* main",
      "  feature/login",
      "  remotes/origin/main",
      "  remotes/origin/feature/login",
    ].join("\n");

    setupExec(output);
    const branches = await poller.getBranches();
    expect(branches).toEqual([
      "main",
      "feature/login",
      "remotes/origin/main",
      "remotes/origin/feature/login",
    ]);
  });

  it("should return empty array when getBranches fails", async () => {
    setupExec("", "", new Error("not a git repo"));
    const branches = await poller.getBranches();
    expect(branches).toEqual([]);
  });

  it("should get commit detail with full diff format", async () => {
    const output = [
      "abc1234def5678abc1234def5678abc1234def5678",
      "Jane Doe",
      "2026-03-18T10:00:00Z",
      "feat: add auth",
      "",
      "diff --git a/src/auth.ts b/src/auth.ts",
      "+new line",
      "",
    ].join("\n");
    setupExec(output);
    const detail = await poller.getCommitDetail("abc1234");
    expect(detail).not.toBeNull();
    expect(detail).toContain("feat: add auth");
    expect(detail).toContain("diff --git");
  });

  it("should return null when getCommitDetail fails", async () => {
    setupExec("", "", new Error("bad object"));
    const detail = await poller.getCommitDetail("abc1234");
    expect(detail).toBeNull();
  });

  it("should get file diff", async () => {
    const diff = "diff --git a/src/index.ts b/src/index.ts\n+new line\n";
    setupExec(diff);
    const result = await poller.getFileDiff("abc1234", "src/index.ts");
    expect(result).toBe(diff.trim());
  });

  it("should return null when getFileDiff fails", async () => {
    setupExec("", "", new Error("bad revision"));
    const result = await poller.getFileDiff("abc1234", "src/index.ts");
    expect(result).toBeNull();
  });

  it("should reject invalid refs in getCommitsBetween", async () => {
    setupExec("abc1234 some commit\n");
    const commits = await poller.getCommitsBetween("$(rm -rf /)", "abc1234");
    expect(commits).toEqual([]);
  });

  it("should reject paths with .. in getFileDiff", async () => {
    setupExec("diff output\n");
    const result = await poller.getFileDiff("abc1234", "../etc/passwd");
    expect(result).toBeNull();
  });

  it("should handle exec timeout gracefully", async () => {
    mockExec.mockImplementation(
      (
        _cmd: string,
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void
      ) => {
        const err = new Error("Command failed: killed");
        (err as NodeJS.ErrnoException).code = "ETIMEDOUT";
        cb(err, "", "");
      }
    );

    const rev = await poller.getHeadRev();
    expect(rev).toBeNull();
  });

  it("should compute token estimate as ~ceil(message.length / 4)", async () => {
    const msg = "feat: add login screen";
    const output = [
      `abc1234 ${msg}`,
      " 1 file changed, 1 insertion(+)",
      "",
    ].join("\n");

    setupExec(output);
    const commits = await poller.getCommitsBetween("aaa1111", "bbb2222");
    expect(commits[0].tokens).toBe(`~${Math.ceil(msg.length / 4)}`);
  });
});
