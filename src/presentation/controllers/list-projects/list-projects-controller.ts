import { ok, serverError } from "../../helpers/index.js";
import {
  Controller,
  ListProjectsResponse,
  ListProjectsUseCase,
  Response,
} from "./protocols.js";
import { PendingChangesRepository } from "../../../data/protocols/pending-changes-repository.js";

export class ListProjectsController
  implements Controller<void, ListProjectsResponse>
{
  constructor(
    private readonly listProjectsUseCase: ListProjectsUseCase,
    private readonly pendingRepo?: PendingChangesRepository
  ) {}

  async handle(): Promise<Response<ListProjectsResponse>> {
    try {
      const projects = await this.listProjectsUseCase.listProjects();
      if (!this.pendingRepo) return ok(projects);

      const enriched = await Promise.all(
        projects.map(async (name) => {
          const pending = await this.pendingRepo!.countChanges(name as string);
          return pending > 0
            ? { name, pendingChanges: pending }
            : { name };
        })
      );
      return ok(enriched as unknown as ListProjectsResponse);
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
