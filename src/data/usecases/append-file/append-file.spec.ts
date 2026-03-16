import { describe, it, expect, vi } from "vitest";
import { AppendFile } from "./append-file.js";
import { FileRepository } from "../../protocols/index.js";

const makeFileRepository = (): FileRepository => ({
  listFiles: vi.fn(),
  loadFile: vi.fn(),
  writeFile: vi.fn(),
  updateFile: vi.fn(),
  upsertFile: vi.fn(),
  appendFile: vi.fn().mockResolvedValue("existing\nnew"),
}) as unknown as FileRepository;

describe("AppendFile", () => {
  it("should call fileRepository.appendFile with correct params", async () => {
    const repo = makeFileRepository();
    const sut = new AppendFile(repo);
    await sut.appendFile({ projectName: "proj", fileName: "f.md", content: "\nnew" });
    expect(vi.mocked(repo.appendFile)).toHaveBeenCalledWith("proj", "f.md", "\nnew");
  });

  it("should return the result of fileRepository.appendFile", async () => {
    const repo = makeFileRepository();
    const sut = new AppendFile(repo);
    const result = await sut.appendFile({ projectName: "proj", fileName: "f.md", content: "\nnew" });
    expect(result).toBe("existing\nnew");
  });

  it("should return null when fileRepository.appendFile returns null", async () => {
    const repo = makeFileRepository();
    vi.mocked(repo.appendFile).mockResolvedValue(null);
    const sut = new AppendFile(repo);
    const result = await sut.appendFile({ projectName: "proj", fileName: "f.md", content: "\nnew" });
    expect(result).toBeNull();
  });
});
