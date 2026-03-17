import { ok, serverError } from "../../helpers/index.js";
import {
  Controller,
  Request,
  Response,
} from "../../protocols/index.js";
import {
  WatchListUseCase,
  WatchListEntry,
} from "../../../domain/usecases/watch-list.js";

export class WatchListController
  implements Controller<void, WatchListEntry[]>
{
  constructor(private readonly useCase: WatchListUseCase) {}

  async handle(_request: Request<void>): Promise<Response<WatchListEntry[]>> {
    try {
      const result = await this.useCase.watchList();
      return ok(result);
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
