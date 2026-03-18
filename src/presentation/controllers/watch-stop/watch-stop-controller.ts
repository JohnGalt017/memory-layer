import { badRequest, ok, serverError } from "../../helpers/index.js";
import {
  Controller,
  Request,
  Response,
} from "../../protocols/index.js";
import { Validator } from "../../protocols/validator.js";
import {
  WatchStopUseCase,
  WatchStopParams,
  WatchStopResult,
} from "../../../domain/usecases/watch-stop.js";

export class WatchStopController
  implements Controller<WatchStopParams, WatchStopResult>
{
  constructor(
    private readonly useCase: WatchStopUseCase,
    private readonly validator: Validator
  ) {}

  async handle(
    request: Request<WatchStopParams>
  ): Promise<Response<WatchStopResult>> {
    try {
      const error = this.validator.validate(request.body);
      if (error) return badRequest(error);
      const result = await this.useCase.watchStop(request.body!);
      return ok(result);
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
