import { badRequest, notFound, ok, serverError } from "../../helpers/index.js";
import { InvalidParamError, MissingParamError } from "../../errors/index.js";
import {
  Controller,
  PatchFileResult,
  PatchFileUseCase,
  PatchRequest,
  PatchResponse,
  Request,
  RequestValidator,
  Response,
} from "./protocols.js";

const hasOwnProperty = (input: object, property: string): boolean =>
  Object.prototype.hasOwnProperty.call(input, property);

const isValidExpectedReplacements = (value: number): boolean =>
  Number.isInteger(value) && value > 0;

const isString = (value: unknown): value is string =>
  typeof value === "string";

export class PatchController implements Controller<PatchRequest, PatchResponse> {
  constructor(
    private readonly patchFileUseCase: PatchFileUseCase,
    private readonly validator: RequestValidator
  ) {}

  async handle(request: Request<PatchRequest>): Promise<Response<PatchResponse>> {
    try {
      const validationError = this.validator.validate(request.body);
      if (validationError) {
        return badRequest(validationError);
      }

      if (!request.body || !hasOwnProperty(request.body, "newText")) {
        return badRequest(new MissingParamError("newText"));
      }

      const {
        projectName,
        fileName,
        oldText,
        newText,
        expectedReplacements,
      } = request.body;

      if (!isString(oldText)) {
        return badRequest(new InvalidParamError("oldText"));
      }

      if (!isString(newText)) {
        return badRequest(new InvalidParamError("newText"));
      }

      if (
        expectedReplacements !== undefined &&
        !isValidExpectedReplacements(expectedReplacements)
      ) {
        return badRequest(new InvalidParamError("expectedReplacements"));
      }

      const result = await this.patchFileUseCase.patchFile({
        projectName,
        fileName,
        oldText,
        newText,
        expectedReplacements,
      });

      if (!result.success) {
        return this.handlePatchFailure(result, fileName, projectName);
      }

      return ok(
        `File ${fileName} patched successfully in project ${projectName}; replacements: ${result.replacements}`
      );
    } catch (error) {
      return serverError(error as Error);
    }
  }

  private handlePatchFailure(
    result: Extract<PatchFileResult, { success: false }>,
    fileName: string,
    projectName: string
  ): Response<PatchResponse> {
    if (result.reason === "project_not_found") {
      return notFound(projectName);
    }

    if (result.reason === "file_not_found") {
      return notFound(fileName);
    }

    if (result.reason === "old_text_not_found") {
      return badRequest(new Error(`oldText was not found in ${fileName}`));
    }

    return badRequest(
      new Error(
        `Expected ${result.expectedReplacements} replacement(s) but found ${result.replacements} in ${fileName}`
      )
    );
  }
}
