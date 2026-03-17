import { badRequest, ok, serverError } from "../../helpers/index.js";
import {
  Controller,
  Request,
  Response,
} from "../../protocols/index.js";
import { Validator } from "../../protocols/validator.js";
import {
  ProcessInboxUseCase,
  ProcessInboxParams,
  ProcessInboxResult,
} from "../../../domain/usecases/process-inbox.js";

export class ProcessInboxController
  implements Controller<ProcessInboxParams, ProcessInboxResult>
{
  constructor(
    private readonly useCase: ProcessInboxUseCase,
    private readonly validator: Validator
  ) {}

  async handle(
    request: Request<ProcessInboxParams>
  ): Promise<Response<ProcessInboxResult>> {
    try {
      const error = this.validator.validate(request.body);
      if (error) return badRequest(error);
      const result = await this.useCase.processInbox(request.body!);
      return ok(result);
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
