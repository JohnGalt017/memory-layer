import { describe, expect, it, vi } from "vitest";
import { QueryRequest } from "../../../../src/presentation/controllers/query/protocols.js";
import { QueryController } from "../../../../src/presentation/controllers/query/query-controller.js";
import { UnexpectedError } from "../../../../src/presentation/errors/index.js";
import { makeQueryFilesUseCase, makeValidator } from "../../mocks/index.js";

const makeSut = () => {
  const validatorStub = makeValidator<QueryRequest>();
  const queryFilesUseCaseStub = makeQueryFilesUseCase();
  const sut = new QueryController(queryFilesUseCaseStub, validatorStub);
  return {
    sut,
    validatorStub,
    queryFilesUseCaseStub,
  };
};

describe("QueryController", () => {
  it("should call QueryFilesUseCase with correct params", async () => {
    const { sut, queryFilesUseCaseStub } = makeSut();
    const queryFilesSpy = vi.spyOn(queryFilesUseCaseStub, "queryFiles");
    const request = {
      body: {
        projectName: "proj",
        type: "architecture",
        status: "active",
        tags: ["rust"],
        updatedAfter: "2026-01-01",
        maxResults: 10,
      },
    };
    await sut.handle(request);
    expect(queryFilesSpy).toHaveBeenCalledWith({
      projectName: "proj",
      type: "architecture",
      status: "active",
      tags: ["rust"],
      updatedAfter: "2026-01-01",
      maxResults: 10,
    });
  });

  it("should return 200 with JSON entries on success", async () => {
    const { sut, queryFilesUseCaseStub } = makeSut();
    vi.spyOn(queryFilesUseCaseStub, "queryFiles").mockResolvedValueOnce([
      { project: "p", fileName: "f.md", abstract: "a" },
    ]);
    const request = {
      body: { projectName: "proj" },
    };
    const response = await sut.handle(request);
    expect(response.statusCode).toBe(200);
  });

  it("should return 500 when use case throws", async () => {
    const { sut, queryFilesUseCaseStub } = makeSut();
    vi.spyOn(queryFilesUseCaseStub, "queryFiles").mockRejectedValueOnce(
      new Error("any_error")
    );
    const request = {
      body: { projectName: "proj" },
    };
    const response = await sut.handle(request);
    expect(response).toEqual({
      statusCode: 500,
      body: new UnexpectedError(new Error("any_error")),
    });
  });

  it("should call validator with request body", async () => {
    const { sut, validatorStub } = makeSut();
    const validateSpy = vi.spyOn(validatorStub, "validate");
    const request = {
      body: { projectName: "proj", type: "architecture" },
    };
    await sut.handle(request);
    expect(validateSpy).toHaveBeenCalledWith(request.body);
  });

  it("should return 400 when validator returns error", async () => {
    const { sut, validatorStub } = makeSut();
    vi.spyOn(validatorStub, "validate").mockReturnValueOnce(
      new Error("validation_error")
    );
    const request = {
      body: { projectName: "proj" },
    };
    const response = await sut.handle(request);
    expect(response).toEqual({
      statusCode: 400,
      body: new Error("validation_error"),
    });
  });

  it("should pass undefined params when body is empty", async () => {
    const { sut, queryFilesUseCaseStub } = makeSut();
    const queryFilesSpy = vi.spyOn(queryFilesUseCaseStub, "queryFiles");
    const request = { body: {} };
    await sut.handle(request);
    expect(queryFilesSpy).toHaveBeenCalledWith({
      projectName: undefined,
      type: undefined,
      status: undefined,
      tags: undefined,
      updatedAfter: undefined,
      maxResults: undefined,
    });
  });
});
