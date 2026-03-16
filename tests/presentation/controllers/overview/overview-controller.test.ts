import { describe, expect, it, vi } from "vitest";
import { OverviewRequest } from "../../../../src/presentation/controllers/overview/protocols.js";
import { OverviewController } from "../../../../src/presentation/controllers/overview/overview-controller.js";
import { UnexpectedError } from "../../../../src/presentation/errors/index.js";
import { makeOverviewUseCase, makeValidator } from "../../mocks/index.js";

const makeSut = () => {
  const overviewUseCaseStub = makeOverviewUseCase();
  const validatorStub = makeValidator<OverviewRequest>();
  const sut = new OverviewController(overviewUseCaseStub, validatorStub);
  return {
    sut,
    overviewUseCaseStub,
    validatorStub,
  };
};

describe("OverviewController", () => {
  it("should call OverviewUseCase with correct params", async () => {
    const { sut, overviewUseCaseStub } = makeSut();
    const getOverviewSpy = vi.spyOn(overviewUseCaseStub, "getOverview");
    const request = { body: { projectName: "any_project" } };
    await sut.handle(request);
    expect(getOverviewSpy).toHaveBeenCalledWith({ projectName: "any_project" });
  });

  it("should return 200 with JSON entries on success", async () => {
    const { sut, overviewUseCaseStub } = makeSut();
    vi.spyOn(overviewUseCaseStub, "getOverview").mockResolvedValueOnce([
      { project: "p", fileName: "f.md", abstract: "a" },
    ]);
    const request = { body: { projectName: "any_project" } };
    const response = await sut.handle(request);
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('"project": "p"');
    expect(response.body).toContain('"fileName": "f.md"');
    expect(response.body).toContain('"abstract": "a"');
  });

  it("should return 500 when use case throws", async () => {
    const { sut, overviewUseCaseStub } = makeSut();
    vi.spyOn(overviewUseCaseStub, "getOverview").mockRejectedValueOnce(
      new Error("any_error")
    );
    const request = { body: { projectName: "any_project" } };
    const response = await sut.handle(request);
    expect(response).toEqual({
      statusCode: 500,
      body: new UnexpectedError(new Error("any_error")),
    });
  });

  it("should call validator with request body", async () => {
    const { sut, validatorStub } = makeSut();
    const validateSpy = vi.spyOn(validatorStub, "validate");
    const request = { body: { projectName: "any_project" } };
    await sut.handle(request);
    expect(validateSpy).toHaveBeenCalledWith(request.body);
  });

  it("should return 400 when validator returns error", async () => {
    const { sut, validatorStub } = makeSut();
    vi.spyOn(validatorStub, "validate").mockReturnValueOnce(
      new Error("validation error")
    );
    const request = { body: { projectName: "any_project" } };
    const response = await sut.handle(request);
    expect(response).toEqual({
      statusCode: 400,
      body: new Error("validation error"),
    });
  });
});
