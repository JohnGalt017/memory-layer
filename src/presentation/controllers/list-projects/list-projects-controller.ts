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

      const pendingCounts = new Map<string, number>();
      await Promise.all(
        projects.map(async (name) => {
          const count = await this.pendingRepo!.countChanges(name as string);
          pendingCounts.set(name as string, count);
        })
      );

      const enrichedProjects: string[] = projects.map((project) => {
        const count = pendingCounts.get(project as string) ?? 0;
        if (count > 0) {
          return `${project} (pending: ${count} changes)`;
        }
        return project as string;
      });

      return ok(enrichedProjects);
    } catch (error) {
      return serverError(error as Error);
    }
  }
}
