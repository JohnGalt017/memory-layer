import { describe, it, expect, vi } from "vitest";
import { SearchFiles } from "./search-files.js";
import { FileRepository } from "../../protocols/index.js";

const makeFileRepository = (): FileRepository => ({
  listFiles: vi.fn(),
  loadFile: vi.fn(),
  writeFile: vi.fn(),
  updateFile: vi.fn(),
  upsertFile: vi.fn(),
  appendFile: vi.fn(),
  searchFiles: vi.fn().mockResolvedValue([{ fileName: "a.md", matches: ["hello world"] }]),
} as unknown as FileRepository);

describe("SearchFiles", () => {
  it("should call fileRepository.searchFiles with correct params", async () => {
    const repo = makeFileRepository();
    const sut = new SearchFiles(repo);
    await sut.searchFiles({ projectName: "proj", query: "hello" });
    expect(vi.mocked(repo.searchFiles)).toHaveBeenCalledWith("proj", "hello");
  });

  it("should return search results", async () => {
    const repo = makeFileRepository();
    const sut = new SearchFiles(repo);
    const result = await sut.searchFiles({ projectName: "proj", query: "hello" });
    expect(result).toEqual([{ fileName: "a.md", matches: ["hello world"] }]);
  });

  it("should return empty array when no matches", async () => {
    const repo = makeFileRepository();
    vi.mocked(repo.searchFiles).mockResolvedValue([]);
    const sut = new SearchFiles(repo);
    const result = await sut.searchFiles({ projectName: "proj", query: "notfound" });
    expect(result).toEqual([]);
  });
});
