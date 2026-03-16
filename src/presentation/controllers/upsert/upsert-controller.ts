import { badRequest, ok, serverError } from "../../helpers/index.js";
import {
  Controller,
  Request,
  Response,
  Validator,
  UpsertFileUseCase,
  UpsertRequest,
  UpsertResponse,
} from "./protocols.js";

export class UpsertController implements Controller<UpsertRequest, UpsertResponse> {
  constructor(
    private readonly upsertFileUseCase: UpsertFileUseCase,
    private readonly validator: Validator
  ) {}

  async handle(request: Request<UpsertRequest>): Promise<Response<UpsertResponse>> {
    try {
      const validationError = this.validator.validate(request.body);
      if (validationError) return badRequest(validationError);
      const { projectName, fileName, content } = request.body!;
      const result = await this.upsertFileUseCase.upsertFile({ projectName, fileName, content });
      if (result === null) {
        return serverError(new Error(`Failed to upsert ${fileName}`));
      }
      return ok(`File ${fileName} upserted successfully in project ${projectName}`);
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
