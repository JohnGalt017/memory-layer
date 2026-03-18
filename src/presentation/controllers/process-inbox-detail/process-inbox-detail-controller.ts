import { badRequest, ok, serverError } from "../../helpers/index.js";
import {
  Controller,
  Request,
  Response,
} from "../../protocols/index.js";
import { Validator } from "../../protocols/validator.js";
import {
  ProcessInboxDetailUseCase,
  ProcessInboxDetailParams,
  ProcessInboxDetailResult,
} from "../../../domain/usecases/process-inbox-detail.js";

export class ProcessInboxDetailController
  implements Controller<ProcessInboxDetailParams, ProcessInboxDetailResult>
{
  constructor(
    private readonly useCase: ProcessInboxDetailUseCase,
    private readonly validator: Validator
  ) {}

  async handle(
    request: Request<ProcessInboxDetailParams>
  ): Promise<Response<ProcessInboxDetailResult>> {
    try {
      const error = this.validator.validate(request.body);
      if (error) return badRequest(error);
      const result = await this.useCase.processInboxDetail(request.body!);
      return ok(result);
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
