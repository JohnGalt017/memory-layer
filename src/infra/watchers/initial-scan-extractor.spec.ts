import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { InitialScanExtractor } from "./initial-scan-extractor.js";
import { WatchIgnore } from "../security/watch-ignore.js";
import fs from "fs-extra";
import path from "path";
import os from "os";

vi.mock("child_process", () => ({
  exec: vi.fn(),
}));

import { exec } from "child_process";

const mockExec = exec as unknown as ReturnType<typeof vi.fn>;

function setupExec(
  responses: Map<string, string>,
  defaultOutput = ""
) {
  mockExec.mockImplementation(
    (
      cmd: string,
      _opts: unknown,
      cb: (err: Error | null, stdout: string, stderr: string) => void
    ) => {
      for (const [key, output] of responses) {
        if (cmd.includes(key)) {
          cb(null, output, "");
          return;
        }
      }
      cb(null, defaultOutput, "");
    }
  );
}

describe("InitialScanExtractor", () => {
  let tmpDir: string;
  let extractor: InitialScanExtractor;
  let watchIgnore: WatchIgnore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "initial-scan-test-"));
    watchIgnore = new WatchIgnore();
    extractor = new InitialScanExtractor(watchIgnore);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it("should read README first 200 lines", async () => {
    const lines = Array.from({ length: 250 }, (_, i) => `Line ${i + 1}`);
    await fs.writeFile(
      path.join(tmpDir, "README.md"),
      lines.join("\n"),
      "utf-8"
    );

    setupExec(new Map());
    const snapshot = await extractor.extract(tmpDir);

    const readmeLines = snapshot.readme.split("\n");
    expect(readmeLines).toHaveLength(200);
    expect(readmeLines[0]).toBe("Line 1");
    expect(readmeLines[199]).toBe("Line 200");
  });

  it("should handle missing README gracefully", async () => {
    setupExec(new Map());
    const snapshot = await extractor.extract(tmpDir);
    expect(snapshot.readme).toBe("");
  });

  it("should parse package.json (name, description, deps)", async () => {
    const packageJson = {
      name: "my-project",
      description: "A test project",
      version: "1.0.0",
      dependencies: {
        express: "^4.18.0",
        zod: "^3.0.0",
      },
      devDependencies: {
        typescript: "^5.0.0",
        vitest: "^3.0.0",
      },
    };

    await fs.writeJSON(path.join(tmpDir, "package.json"), packageJson);

    setupExec(new Map());
    const snapshot = await extractor.extract(tmpDir);

    expect(snapshot.manifest["name"]).toBe("my-project");
    expect(snapshot.manifest["description"]).toBe("A test project");
    expect(snapshot.manifest["dependencies"]).toBeDefined();
  });

  it("should generate 2-level file tree", async () => {
    await fs.ensureDir(path.join(tmpDir, "src"));
    await fs.writeFile(path.join(tmpDir, "src", "index.ts"), "");
    await fs.writeFile(path.join(tmpDir, "README.md"), "");
    await fs.ensureDir(path.join(tmpDir, "src", "utils"));
    await fs.writeFile(path.join(tmpDir, "src", "utils", "deep.ts"), "");

    setupExec(new Map());
    const snapshot = await extractor.extract(tmpDir);

    expect(snapshot.fileTree).toContain("src/");
    expect(snapshot.fileTree).toContain("src/index.ts");
    expect(snapshot.fileTree).toContain("README.md");
    // 3rd level (src/utils/deep.ts) should NOT be in tree
    expect(snapshot.fileTree.some((f) => f.includes("deep.ts"))).toBe(false);
  });

  it("should handle non-git project (empty git fields)", async () => {
    mockExec.mockImplementation(
      (
        _cmd: string,
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void
      ) => {
        cb(new Error("not a git repo"), "", "");
      }
    );

    const snapshot = await extractor.extract(tmpDir);

    expect(snapshot.gitLog).toEqual([]);
    expect(snapshot.branches).toEqual([]);
    expect(snapshot.gitStatus).toEqual({ modified: [], untracked: [], deleted: [] });
  });

  it("should include git log with up to 20 commits", async () => {
    const logOutput = Array.from(
      { length: 20 },
      (_, i) => `abc${String(i).padStart(4, "0")} commit number ${i}`
    ).join("\n");

    const responses = new Map([
      ["log --oneline -20", logOutput + "\n"],
      ["branch -a", "* main\n"],
      ["status --porcelain", ""],
    ]);

    setupExec(responses);
    const snapshot = await extractor.extract(tmpDir);

    expect(snapshot.gitLog).toHaveLength(20);
    expect(snapshot.gitLog[0].hash).toBe("abc0000");
    expect(snapshot.branches).toEqual(["main"]);
  });
});
