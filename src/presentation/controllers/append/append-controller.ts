import { badRequest, ok, serverError } from "../../helpers/index.js";
import { Controller, Request, Response, Validator, AppendFileUseCase, AppendRequest, AppendResponse } from "./protocols.js";

export class AppendController implements Controller<AppendRequest, AppendResponse> {
  constructor(
    private readonly appendFileUseCase: AppendFileUseCase,
    private readonly validator: Validator
  ) {}

  async handle(request: Request<AppendRequest>): Promise<Response<AppendResponse>> {
    try {
      const validationError = this.validator.validate(request.body);
      if (validationError) return badRequest(validationError);
      const { projectName, fileName, content } = request.body!;
      const result = await this.appendFileUseCase.appendFile({ projectName, fileName, content });
      if (result === null) {
        return serverError(new Error(`Failed to append to ${fileName}`));
      }
      return ok(`Content appended to ${fileName} in project ${projectName}`);
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
