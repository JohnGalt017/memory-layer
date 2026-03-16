import { describe, it, expect, vi } from "vitest";
import { DbQueryFiles } from "./query-files.js";
import { FileRepository } from "../../protocols/file-repository.js";

const makeEntry = (overrides: Record<string, unknown> = {}) => ({
  project: "proj",
  fileName: "file.md",
  metadata: { type: "architecture", status: "active", tags: ["rust"], updated: "2026-02-01", ...overrides },
  abstract: "Some abstract",
});

const makeFileRepository = (entries = [makeEntry()]): FileRepository => ({
  listFiles: vi.fn(),
  loadFile: vi.fn(),
  writeFile: vi.fn(),
  updateFile: vi.fn(),
  upsertFile: vi.fn(),
  appendFile: vi.fn(),
  searchFiles: vi.fn(),
  loadFileAtLevel: vi.fn(),
  listFilesWithMetadata: vi.fn().mockResolvedValue(entries),
} as unknown as FileRepository);

describe("DbQueryFiles", () => {
  it("should return all files when no filters", async () => {
    const repo = makeFileRepository();
    const sut = new DbQueryFiles(repo);
    const result = await sut.queryFiles({});
    expect(result).toHaveLength(1);
    expect(repo.listFilesWithMetadata).toHaveBeenCalledWith(undefined);
  });

  it("should filter by type", async () => {
    const repo = makeFileRepository([
      makeEntry({ type: "architecture" }),
      makeEntry({ type: "progress" }),
    ]);
    const sut = new DbQueryFiles(repo);
    const result = await sut.queryFiles({ type: "architecture" });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("architecture");
  });

  it("should filter by status", async () => {
    const repo = makeFileRepository([
      makeEntry({ status: "active" }),
      makeEntry({ status: "archived" }),
    ]);
    const sut = new DbQueryFiles(repo);
    const result = await sut.queryFiles({ status: "active" });
    expect(result).toHaveLength(1);
  });

  it("should filter by tags (all must match)", async () => {
    const repo = makeFileRepository([
      makeEntry({ tags: ["rust", "polyalgo"] }),
      makeEntry({ tags: ["rust"] }),
    ]);
    const sut = new DbQueryFiles(repo);
    const result = await sut.queryFiles({ tags: ["rust", "polyalgo"] });
    expect(result).toHaveLength(1);
  });

  it("should filter by updatedAfter", async () => {
    const repo = makeFileRepository([
      makeEntry({ updated: "2026-03-01" }),
      makeEntry({ updated: "2025-12-01" }),
    ]);
    const sut = new DbQueryFiles(repo);
    const result = await sut.queryFiles({ updatedAfter: "2026-01-01" });
    expect(result).toHaveLength(1);
  });

  it("should respect maxResults", async () => {
    const repo = makeFileRepository([makeEntry(), makeEntry(), makeEntry()]);
    const sut = new DbQueryFiles(repo);
    const result = await sut.queryFiles({ maxResults: 2 });
    expect(result).toHaveLength(2);
  });
});
