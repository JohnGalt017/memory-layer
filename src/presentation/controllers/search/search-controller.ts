import { badRequest, ok, serverError } from "../../helpers/index.js";
import { Controller, Request, Response, Validator, SearchFilesUseCase, SearchRequest, SearchResponse } from "./protocols.js";

export class SearchController implements Controller<SearchRequest, SearchResponse> {
  constructor(
    private readonly searchFilesUseCase: SearchFilesUseCase,
    private readonly validator: Validator
  ) {}

  async handle(request: Request<SearchRequest>): Promise<Response<SearchResponse>> {
    try {
      const validationError = this.validator.validate(request.body);
      if (validationError) return badRequest(validationError);
      const { projectName, query } = request.body!;
      const results = await this.searchFilesUseCase.searchFiles({ projectName, query });
      if (results.length === 0) return ok(`No matches found for "${query}" in project ${projectName}`);
      const formatted = results
        .map((r) => `**${r.fileName}**\n${r.matches.map((m) => `  ${m}`).join("\n")}`)
        .join("\n\n");
      return ok(formatted);
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
