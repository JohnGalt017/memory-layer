import { ok, serverError, badRequest } from "../../helpers/index.js";
import { Controller, Request, Response, Validator, QueryFilesUseCase, QueryRequest, QueryResponse } from "./protocols.js";

export class QueryController implements Controller<QueryRequest, QueryResponse> {
  constructor(
    private readonly queryFilesUseCase: QueryFilesUseCase,
    private readonly validator: Validator
  ) {}

  async handle(request: Request<QueryRequest>): Promise<Response<QueryResponse>> {
    try {
      const validationError = this.validator.validate(request.body);
      if (validationError) return badRequest(validationError);
      const { projectName, type, status, tags, updatedAfter, maxResults } = request.body ?? {};
      const entries = await this.queryFilesUseCase.queryFiles({ projectName, type, status, tags, updatedAfter, maxResults });
      return ok(JSON.stringify(entries, null, 2));
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
