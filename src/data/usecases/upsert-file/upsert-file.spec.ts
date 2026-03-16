import { describe, it, expect, vi } from "vitest";
import { UpsertFile } from "./upsert-file.js";
import { FileRepository } from "../../protocols/index.js";
import { FrontmatterService } from "../../../domain/services/index.js";

const makeFileRepository = (): FileRepository => ({
  listFiles: vi.fn(),
  loadFile: vi.fn(),
  writeFile: vi.fn(),
  updateFile: vi.fn(),
  upsertFile: vi.fn().mockResolvedValue("content"),
  appendFile: vi.fn(),
  searchFiles: vi.fn(),
} as unknown as FileRepository);

const makeFrontmatterService = (): FrontmatterService => ({
  parse: vi.fn(),
  stringify: vi.fn(),
  extractAbstract: vi.fn(),
  injectAbstract: vi.fn().mockImplementation((content: string) => content),
});

describe("UpsertFile", () => {
  it("should call fileRepository.upsertFile with correct project and file name", async () => {
    const repo = makeFileRepository();
    const frontmatter = makeFrontmatterService();
    const sut = new UpsertFile(repo, frontmatter);
    await sut.upsertFile({ projectName: "proj", fileName: "f.md", content: "c" });
    expect(vi.mocked(repo.upsertFile)).toHaveBeenCalledWith("proj", "f.md", expect.any(String));
  });

  it("should return the result of fileRepository.upsertFile", async () => {
    const repo = makeFileRepository();
    const frontmatter = makeFrontmatterService();
    vi.mocked(repo.upsertFile).mockResolvedValue("content");
    const sut = new UpsertFile(repo, frontmatter);
    const result = await sut.upsertFile({ projectName: "proj", fileName: "f.md", content: "c" });
    expect(result).toBe("content");
  });

  it("should inject abstract into frontmatter when missing", async () => {
    const repo = makeFileRepository();
    const frontmatter = makeFrontmatterService();
    const enrichedContent = "---\nabstract: This is the important content.\n---\n\n# My File\n\nThis is the important content.";
    vi.mocked(frontmatter.injectAbstract).mockReturnValueOnce(enrichedContent);
    vi.mocked(repo.upsertFile).mockResolvedValue("enriched");

    const sut = new UpsertFile(repo, frontmatter);
    const content = "# My File\n\nThis is the important content.";
    await sut.upsertFile({ projectName: "proj", fileName: "f.md", content });

    expect(frontmatter.injectAbstract).toHaveBeenCalledWith(content);
    const writtenContent = vi.mocked(repo.upsertFile).mock.calls[0][2];
    expect(writtenContent).toContain("abstract:");
    expect(writtenContent).toContain("This is the important content");
  });

  it("should not overwrite existing abstract", async () => {
    const repo = makeFileRepository();
    const frontmatter = makeFrontmatterService();
    const originalContent = "---\nabstract: My custom abstract\n---\n\n# File\n\nBody.";
    vi.mocked(frontmatter.injectAbstract).mockReturnValueOnce(originalContent);
    vi.mocked(repo.upsertFile).mockResolvedValue("enriched");

    const sut = new UpsertFile(repo, frontmatter);
    await sut.upsertFile({ projectName: "proj", fileName: "f.md", content: originalContent });

    expect(frontmatter.injectAbstract).toHaveBeenCalledWith(originalContent);
    const writtenContent = vi.mocked(repo.upsertFile).mock.calls[0][2];
    expect(writtenContent).toContain("My custom abstract");
  });
});
