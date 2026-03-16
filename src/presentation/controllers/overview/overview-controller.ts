import { ok, serverError, badRequest } from "../../helpers/index.js";
import { Controller, Request, Response, Validator, OverviewUseCase } from "./protocols.js";
import { OverviewRequest, OverviewResponse } from "./protocols.js";

export class OverviewController implements Controller<OverviewRequest, OverviewResponse> {
  constructor(
    private readonly overviewUseCase: OverviewUseCase,
    private readonly validator: Validator
  ) {}

  async handle(request: Request<OverviewRequest>): Promise<Response<OverviewResponse>> {
    try {
      const validationError = this.validator.validate(request.body);
      if (validationError) return badRequest(validationError);
      const { projectName } = request.body ?? {};
      const entries = await this.overviewUseCase.getOverview({ projectName });
      return ok(JSON.stringify(entries, null, 2));
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
