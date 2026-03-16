import { OverviewUseCase, OverviewParams, OverviewEntry } from "../../../domain/usecases/index.js";
import { FileRepository } from "../../protocols/index.js";

export class DbOverview implements OverviewUseCase {
  constructor(private readonly fileRepository: FileRepository) {}

  async getOverview(params: OverviewParams): Promise<OverviewEntry[]> {
    const files = await this.fileRepository.listFilesWithMetadata(params.projectName);
    return files.map(({ project, fileName, metadata, abstract }) => ({
      project,
      fileName,
      abstract,
      type: metadata.type as string | undefined,
      status: metadata.status as string | undefined,
      tags: metadata.tags as string[] | undefined,
      updated: metadata.updated as string | undefined,
    }));
  }
}
