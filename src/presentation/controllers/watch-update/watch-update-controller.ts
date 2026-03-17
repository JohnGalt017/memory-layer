import { badRequest, ok, serverError } from "../../helpers/index.js";
import {
  Controller,
  Request,
  Response,
} from "../../protocols/index.js";
import { Validator } from "../../protocols/validator.js";
import {
  WatchUpdateUseCase,
  WatchUpdateParams,
  WatchUpdateResult,
} from "../../../domain/usecases/watch-update.js";

export class WatchUpdateController
  implements Controller<WatchUpdateParams, WatchUpdateResult>
{
  constructor(
    private readonly useCase: WatchUpdateUseCase,
    private readonly validator: Validator
  ) {}

  async handle(
    request: Request<WatchUpdateParams>
  ): Promise<Response<WatchUpdateResult>> {
    try {
      const error = this.validator.validate(request.body);
      if (error) return badRequest(error);
      const result = await this.useCase.watchUpdate(request.body!);
      return ok(result);
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
