import { badRequest, ok, serverError } from "../../helpers/index.js";
import {
  Controller,
  Request,
  Response,
} from "../../protocols/index.js";
import { Validator } from "../../protocols/validator.js";
import {
  WatchStartUseCase,
  WatchStartParams,
  WatchStartResult,
} from "../../../domain/usecases/watch-start.js";

export class WatchStartController
  implements Controller<WatchStartParams, WatchStartResult>
{
  constructor(
    private readonly useCase: WatchStartUseCase,
    private readonly validator: Validator
  ) {}

  async handle(
    request: Request<WatchStartParams>
  ): Promise<Response<WatchStartResult>> {
    try {
      const error = this.validator.validate(request.body);
      if (error) return badRequest(error);
      const result = await this.useCase.watchStart(request.body!);
      return ok(result);
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
