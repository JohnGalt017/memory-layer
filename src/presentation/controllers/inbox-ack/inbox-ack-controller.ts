import { badRequest, ok, serverError } from "../../helpers/index.js";
import {
  Controller,
  Request,
  Response,
} from "../../protocols/index.js";
import { Validator } from "../../protocols/validator.js";
import {
  InboxAckUseCase,
  InboxAckParams,
  InboxAckResult,
} from "../../../domain/usecases/inbox-ack.js";

export class InboxAckController
  implements Controller<InboxAckParams, InboxAckResult>
{
  constructor(
    private readonly useCase: InboxAckUseCase,
    private readonly validator: Validator
  ) {}

  async handle(
    request: Request<InboxAckParams>
  ): Promise<Response<InboxAckResult>> {
    try {
      const error = this.validator.validate(request.body);
      if (error) return badRequest(error);
      const result = await this.useCase.inboxAck(request.body!);
      return ok(result);
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
