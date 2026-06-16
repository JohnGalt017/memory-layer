import { describe, expect, it, vi } from "vitest";
import { PatchRequest } from "../../../../src/presentation/controllers/patch/protocols.js";
import { PatchController } from "../../../../src/presentation/controllers/patch/patch-controller.js";
import {
  InvalidParamError,
  MissingParamError,
  NotFoundError,
  UnexpectedError,
} from "../../../../src/presentation/errors/index.js";
import { makePatchFileUseCase, makeValidator } from "../../mocks/index.js";

const makeSut = () => {
  const validatorStub = makeValidator<PatchRequest>();
  const patchFileUseCaseStub = makePatchFileUseCase();
  const sut = new PatchController(patchFileUseCaseStub, validatorStub);
  return {
    sut,
    validatorStub,
    patchFileUseCaseStub,
  };
};

describe("PatchController", () => {
  it("should call validator with correct values", async () => {
    const { sut, validatorStub } = makeSut();
    const validateSpy = vi.spyOn(validatorStub, "validate");
    const request = {
      body: {
        projectName: "any_project",
        fileName: "any_file",
        oldText: "old",
        newText: "new",
      },
    };

    await sut.handle(request);

    expect(validateSpy).toHaveBeenCalledWith(request.body);
  });

  it("should return 400 if validator returns an error", async () => {
    const { sut, validatorStub } = makeSut();
    vi.spyOn(validatorStub, "validate").mockReturnValueOnce(
      new Error("any_error")
    );
    const request = {
      body: {
        projectName: "any_project",
        fileName: "any_file",
        oldText: "old",
        newText: "new",
      },
    };

    const response = await sut.handle(request);

    expect(response).toEqual({
      statusCode: 400,
      body: new Error("any_error"),
    });
  });

  it("should return 400 if newText is omitted", async () => {
    const { sut } = makeSut();
    const request = {
      body: {
        projectName: "any_project",
        fileName: "any_file",
        oldText: "old",
      } as PatchRequest,
    };

    const response = await sut.handle(request);

    expect(response).toEqual({
      statusCode: 400,
      body: new MissingParamError("newText"),
    });
  });

  it("should return 400 if expectedReplacements is invalid", async () => {
    const { sut } = makeSut();
    const request = {
      body: {
        projectName: "any_project",
        fileName: "any_file",
        oldText: "old",
        newText: "new",
        expectedReplacements: 0,
      },
    };

    const response = await sut.handle(request);

    expect(response).toEqual({
      statusCode: 400,
      body: new InvalidParamError("expectedReplacements"),
    });
  });

  it("should return 400 if oldText is not a string", async () => {
    const { sut } = makeSut();
    const request = {
      body: {
        projectName: "any_project",
        fileName: "any_file",
        oldText: 123,
        newText: "new",
      } as unknown as PatchRequest,
    };

    const response = await sut.handle(request);

    expect(response).toEqual({
      statusCode: 400,
      body: new InvalidParamError("oldText"),
    });
  });

  it("should return 400 if newText is not a string", async () => {
    const { sut } = makeSut();
    const request = {
      body: {
        projectName: "any_project",
        fileName: "any_file",
        oldText: "old",
        newText: null,
      } as unknown as PatchRequest,
    };

    const response = await sut.handle(request);

    expect(response).toEqual({
      statusCode: 400,
      body: new InvalidParamError("newText"),
    });
  });

  it("should call PatchFileUseCase with correct values", async () => {
    const { sut, patchFileUseCaseStub } = makeSut();
    const patchFileSpy = vi.spyOn(patchFileUseCaseStub, "patchFile");
    const request = {
      body: {
        projectName: "any_project",
        fileName: "any_file",
        oldText: "old",
        newText: "",
        expectedReplacements: 2,
      },
    };

    await sut.handle(request);

    expect(patchFileSpy).toHaveBeenCalledWith({
      projectName: "any_project",
      fileName: "any_file",
      oldText: "old",
      newText: "",
      expectedReplacements: 2,
    });
  });

  it("should return 404 if project is not found", async () => {
    const { sut, patchFileUseCaseStub } = makeSut();
    vi.spyOn(patchFileUseCaseStub, "patchFile").mockResolvedValueOnce({
      success: false,
      reason: "project_not_found",
      replacements: 0,
      expectedReplacements: 1,
    });
    const request = {
      body: {
        projectName: "any_project",
        fileName: "any_file",
        oldText: "old",
        newText: "new",
      },
    };

    const response = await sut.handle(request);

    expect(response).toEqual({
      statusCode: 404,
      body: new NotFoundError("any_project"),
    });
  });

  it("should return 404 if file is not found", async () => {
    const { sut, patchFileUseCaseStub } = makeSut();
    vi.spyOn(patchFileUseCaseStub, "patchFile").mockResolvedValueOnce({
      success: false,
      reason: "file_not_found",
      replacements: 0,
      expectedReplacements: 1,
    });
    const request = {
      body: {
        projectName: "any_project",
        fileName: "any_file",
        oldText: "old",
        newText: "new",
      },
    };

    const response = await sut.handle(request);

    expect(response).toEqual({
      statusCode: 404,
      body: new NotFoundError("any_file"),
    });
  });

  it("should return 400 if oldText is not found", async () => {
    const { sut, patchFileUseCaseStub } = makeSut();
    vi.spyOn(patchFileUseCaseStub, "patchFile").mockResolvedValueOnce({
      success: false,
      reason: "old_text_not_found",
      replacements: 0,
      expectedReplacements: 1,
    });
    const request = {
      body: {
        projectName: "any_project",
        fileName: "any_file",
        oldText: "old",
        newText: "new",
      },
    };

    const response = await sut.handle(request);

    expect(response).toEqual({
      statusCode: 400,
      body: new Error("oldText was not found in any_file"),
    });
  });

  it("should return 400 if replacement count is unexpected", async () => {
    const { sut, patchFileUseCaseStub } = makeSut();
    vi.spyOn(patchFileUseCaseStub, "patchFile").mockResolvedValueOnce({
      success: false,
      reason: "replacement_count_mismatch",
      replacements: 3,
      expectedReplacements: 1,
    });
    const request = {
      body: {
        projectName: "any_project",
        fileName: "any_file",
        oldText: "old",
        newText: "new",
      },
    };

    const response = await sut.handle(request);

    expect(response).toEqual({
      statusCode: 400,
      body: new Error("Expected 1 replacement(s) but found 3 in any_file"),
    });
  });

  it("should return 500 if PatchFileUseCase throws", async () => {
    const { sut, patchFileUseCaseStub } = makeSut();
    vi.spyOn(patchFileUseCaseStub, "patchFile").mockRejectedValueOnce(
      new Error("any_error")
    );
    const request = {
      body: {
        projectName: "any_project",
        fileName: "any_file",
        oldText: "old",
        newText: "new",
      },
    };

    const response = await sut.handle(request);

    expect(response).toEqual({
      statusCode: 500,
      body: new UnexpectedError(new Error("any_error")),
    });
  });

  it("should return 200 if valid data is provided", async () => {
    const { sut } = makeSut();
    const request = {
      body: {
        projectName: "any_project",
        fileName: "any_file",
        oldText: "old",
        newText: "new",
      },
    };

    const response = await sut.handle(request);

    expect(response).toEqual({
      statusCode: 200,
      body: "File any_file patched successfully in project any_project; replacements: 1",
    });
  });
});
