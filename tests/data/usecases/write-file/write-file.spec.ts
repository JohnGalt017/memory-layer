import { beforeEach, describe, expect, test, vi } from "vitest";
import { FileRepository } from "../../../../src/data/protocols/file-repository.js";
import { ProjectRepository } from "../../../../src/data/protocols/project-repository.js";
import { WriteFile } from "../../../../src/data/usecases/write-file/write-file.js";
import { FrontmatterService } from "../../../../src/domain/services/index.js";
import { WriteFileParams } from "../../../../src/domain/usecases/write-file.js";
import {
  MockFileRepository,
  MockProjectRepository,
} from "../../mocks/index.js";

const makeFrontmatterService = (): FrontmatterService => ({
  parse: vi.fn(),
  stringify: vi.fn(),
  extractAbstract: vi.fn(),
  injectAbstract: vi.fn().mockImplementation((content: string) => content),
});

describe("WriteFile UseCase", () => {
  let sut: WriteFile;
  let fileRepositoryStub: FileRepository;
  let projectRepositoryStub: ProjectRepository;
  let frontmatterServiceStub: FrontmatterService;

  beforeEach(() => {
    fileRepositoryStub = new MockFileRepository();
    projectRepositoryStub = new MockProjectRepository();
    frontmatterServiceStub = makeFrontmatterService();
    sut = new WriteFile(fileRepositoryStub, projectRepositoryStub, frontmatterServiceStub);
  });

  test("should call ProjectRepository.ensureProject with correct projectName", async () => {
    const ensureProjectSpy = vi.spyOn(projectRepositoryStub, "ensureProject");
    const params: WriteFileParams = {
      projectName: "new-project",
      fileName: "new-file.md",
      content: "New content",
    };

    vi.spyOn(fileRepositoryStub, "loadFile")
      .mockResolvedValueOnce(null) // First call checking if file exists
      .mockResolvedValueOnce("New content"); // Second call returning the saved content

    await sut.writeFile(params);

    expect(ensureProjectSpy).toHaveBeenCalledWith("new-project");
  });

  test("should check if file exists before writing", async () => {
    const loadFileSpy = vi.spyOn(fileRepositoryStub, "loadFile");
    const params: WriteFileParams = {
      projectName: "project-1",
      fileName: "new-file.md",
      content: "New content",
    };

    await sut.writeFile(params);

    expect(loadFileSpy).toHaveBeenCalledWith("project-1", "new-file.md");
  });

  test("should return null if file already exists", async () => {
    const params: WriteFileParams = {
      projectName: "project-1",
      fileName: "file1.md",
      content: "New content",
    };

    const result = await sut.writeFile(params);

    expect(result).toBeNull();
  });

  test("should call FileRepository.writeFile with correct params if file does not exist", async () => {
    const writeFileSpy = vi.spyOn(fileRepositoryStub, "writeFile");
    const params: WriteFileParams = {
      projectName: "project-1",
      fileName: "new-file.md",
      content: "New content",
    };

    vi.spyOn(fileRepositoryStub, "loadFile")
      .mockResolvedValueOnce(null) // First call checking if file exists
      .mockResolvedValueOnce("New content"); // Second call returning the saved content

    await sut.writeFile(params);

    expect(writeFileSpy).toHaveBeenCalledWith(
      "project-1",
      "new-file.md",
      expect.any(String)
    );
  });

  test("should inject abstract into frontmatter when missing", async () => {
    const enrichedContent = "---\nabstract: This is the important content.\n---\n\n# My File\n\nThis is the important content.";
    vi.mocked(frontmatterServiceStub.injectAbstract).mockReturnValueOnce(enrichedContent);

    const writeFileSpy = vi.spyOn(fileRepositoryStub, "writeFile");
    const params: WriteFileParams = {
      projectName: "project-1",
      fileName: "new-file.md",
      content: "# My File\n\nThis is the important content.",
    };

    vi.spyOn(fileRepositoryStub, "loadFile")
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(params.content);

    await sut.writeFile(params);

    expect(frontmatterServiceStub.injectAbstract).toHaveBeenCalledWith(params.content);
    const writtenContent = writeFileSpy.mock.calls[0][2];
    expect(writtenContent).toContain("abstract:");
    expect(writtenContent).toContain("This is the important content");
  });

  test("should not overwrite existing abstract", async () => {
    const originalContent = "---\nabstract: My custom abstract\n---\n\n# File\n\nBody.";
    vi.mocked(frontmatterServiceStub.injectAbstract).mockReturnValueOnce(originalContent);

    const writeFileSpy = vi.spyOn(fileRepositoryStub, "writeFile");
    const params: WriteFileParams = {
      projectName: "project-1",
      fileName: "new-file.md",
      content: originalContent,
    };

    vi.spyOn(fileRepositoryStub, "loadFile")
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(params.content);

    await sut.writeFile(params);

    expect(frontmatterServiceStub.injectAbstract).toHaveBeenCalledWith(originalContent);
    const writtenContent = writeFileSpy.mock.calls[0][2];
    expect(writtenContent).toContain("My custom abstract");
  });

  test("should return file content on successful file creation", async () => {
    const params: WriteFileParams = {
      projectName: "project-1",
      fileName: "new-file.md",
      content: "New content",
    };

    vi.spyOn(fileRepositoryStub, "loadFile")
      .mockResolvedValueOnce(null) // First call checking if file exists
      .mockResolvedValueOnce("New content"); // Second call returning the saved content

    const result = await sut.writeFile(params);

    expect(result).toBe("New content");
  });

  test("should propagate errors if repository throws", async () => {
    const error = new Error("Repository error");
    vi.spyOn(projectRepositoryStub, "ensureProject").mockRejectedValueOnce(
      error
    );
    const params: WriteFileParams = {
      projectName: "project-1",
      fileName: "new-file.md",
      content: "New content",
    };

    await expect(sut.writeFile(params)).rejects.toThrow(error);
  });
});
