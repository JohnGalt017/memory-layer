import { OverviewUseCase, OverviewParams, OverviewEntry } from "../../../domain/usecases/index.js";
import { FileRepository } from "../../protocols/index.js";
import { PendingChangesRepository } from "../../protocols/pending-changes-repository.js";

export class DbOverview implements OverviewUseCase {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly pendingRepo?: PendingChangesRepository
  ) {}

  async getOverview(params: OverviewParams): Promise<OverviewEntry[]> {
    const files = await this.fileRepository.listFilesWithMetadata(params.projectName);

    const projectNames = [...new Set(files.map((f) => f.project))];
    const pendingMap = new Map<string, number>();
    if (this.pendingRepo) {
      await Promise.all(
        projectNames.map(async (name) => {
          const count = await this.pendingRepo!.countChanges(name);
          if (count > 0) pendingMap.set(name, count);
        })
      );
    }

    return files.map(({ project, fileName, metadata, abstract, tokens }) => ({
      project,
      fileName,
      abstract,
      tokens,
      type: metadata.type as string | undefined,
      status: metadata.status as string | undefined,
      tags: metadata.tags as string[] | undefined,
      updated: metadata.updated as string | undefined,
      ...(pendingMap.has(project) ? { pendingChanges: pendingMap.get(project) } : {}),
    }));
  }
}
