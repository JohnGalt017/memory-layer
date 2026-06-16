import { beforeEach, describe, expect, test, vi } from "vitest";
import { FileRepository } from "../../../../src/data/protocols/file-repository.js";
import { ProjectRepository } from "../../../../src/data/protocols/project-repository.js";
import { PatchFile } from "../../../../src/data/usecases/patch-file/patch-file.js";
import { PatchFileParams } from "../../../../src/domain/usecases/patch-file.js";
import {
  MockFileRepository,
  MockProjectRepository,
} from "../../mocks/index.js";

describe("PatchFile UseCase", () => {
  let sut: PatchFile;
  let fileRepositoryStub: FileRepository;
  let projectRepositoryStub: ProjectRepository;

  beforeEach(() => {
    fileRepositoryStub = new MockFileRepository();
    projectRepositoryStub = new MockProjectRepository();
    sut = new PatchFile(fileRepositoryStub, projectRepositoryStub);
  });

  test("should call ProjectRepository.projectExists with correct projectName", async () => {
    const projectExistsSpy = vi.spyOn(projectRepositoryStub, "projectExists");
    const params: PatchFileParams = {
      projectName: "project-1",
      fileName: "file1.md",
      oldText: "file1",
      newText: "patched-file",
    };

    await sut.patchFile(params);

    expect(projectExistsSpy).toHaveBeenCalledWith("project-1");
  });

  test("should return project_not_found if project does not exist", async () => {
    vi.spyOn(projectRepositoryStub, "projectExists").mockResolvedValueOnce(
      false
    );
    const params: PatchFileParams = {
      projectName: "missing-project",
      fileName: "file1.md",
      oldText: "file1",
      newText: "patched-file",
    };

    const result = await sut.patchFile(params);

    expect(result).toEqual({
      success: false,
      reason: "project_not_found",
      replacements: 0,
      expectedReplacements: 1,
    });
  });

  test("should return file_not_found if file does not exist", async () => {
    vi.spyOn(fileRepositoryStub, "loadFile").mockResolvedValueOnce(null);
    const params: PatchFileParams = {
      projectName: "project-1",
      fileName: "missing-file.md",
      oldText: "file1",
      newText: "patched-file",
    };

    const result = await sut.patchFile(params);

    expect(result).toEqual({
      success: false,
      reason: "file_not_found",
      replacements: 0,
      expectedReplacements: 1,
    });
  });

  test("should replace exact text once and update the file", async () => {
    const updateFileSpy = vi.spyOn(fileRepositoryStub, "updateFile");
    const params: PatchFileParams = {
      projectName: "project-1",
      fileName: "file1.md",
      oldText: "file1",
      newText: "patched-file",
    };

    const result = await sut.patchFile(params);

    expect(updateFileSpy).toHaveBeenCalledWith(
      "project-1",
      "file1.md",
      "Content of patched-file.md"
    );
    expect(result).toEqual({
      success: true,
      file: "Content of patched-file.md",
      replacements: 1,
    });
  });

  test("should not update when oldText is not found", async () => {
    const updateFileSpy = vi.spyOn(fileRepositoryStub, "updateFile");
    const params: PatchFileParams = {
      projectName: "project-1",
      fileName: "file1.md",
      oldText: "missing",
      newText: "patched-file",
    };

    const result = await sut.patchFile(params);

    expect(updateFileSpy).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      reason: "old_text_not_found",
      replacements: 0,
      expectedReplacements: 1,
    });
  });

  test("should not update when replacement count does not match expectation", async () => {
    vi.spyOn(fileRepositoryStub, "loadFile").mockResolvedValueOnce(
      "same same"
    );
    const updateFileSpy = vi.spyOn(fileRepositoryStub, "updateFile");
    const params: PatchFileParams = {
      projectName: "project-1",
      fileName: "file1.md",
      oldText: "same",
      newText: "other",
    };

    const result = await sut.patchFile(params);

    expect(updateFileSpy).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      reason: "replacement_count_mismatch",
      replacements: 2,
      expectedReplacements: 1,
    });
  });

  test("should replace multiple matches when expectedReplacements matches", async () => {
    vi.spyOn(fileRepositoryStub, "loadFile").mockResolvedValueOnce(
      "same same"
    );
    const updateFileSpy = vi.spyOn(fileRepositoryStub, "updateFile");
    const params: PatchFileParams = {
      projectName: "project-1",
      fileName: "file1.md",
      oldText: "same",
      newText: "other",
      expectedReplacements: 2,
    };

    const result = await sut.patchFile(params);

    expect(updateFileSpy).toHaveBeenCalledWith(
      "project-1",
      "file1.md",
      "other other"
    );
    expect(result).toEqual({
      success: true,
      file: "other other",
      replacements: 2,
    });
  });

  test("should propagate errors if repository throws", async () => {
    const error = new Error("Repository error");
    vi.spyOn(projectRepositoryStub, "projectExists").mockRejectedValueOnce(
      error
    );
    const params: PatchFileParams = {
      projectName: "project-1",
      fileName: "file1.md",
      oldText: "file1",
      newText: "patched-file",
    };

    await expect(sut.patchFile(params)).rejects.toThrow(error);
  });
});
