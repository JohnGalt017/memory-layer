import { QueryFilesUseCase, QueryFilesParams } from "../../../domain/usecases/index.js";
import { OverviewEntry } from "../../../domain/usecases/index.js";
import { FileRepository } from "../../protocols/index.js";

export class DbQueryFiles implements QueryFilesUseCase {
  constructor(private readonly fileRepository: FileRepository) {}

  async queryFiles(params: QueryFilesParams): Promise<OverviewEntry[]> {
    const all = await this.fileRepository.listFilesWithMetadata(params.projectName);
    const max = params.maxResults ?? 50;

    return all
      .filter(({ metadata }) => {
        if (params.type && metadata.type !== params.type) return false;
        if (params.status && metadata.status !== params.status) return false;
        if (params.tags?.length) {
          const fileTags = (metadata.tags as string[]) ?? [];
          if (!params.tags.every((t) => fileTags.includes(t))) return false;
        }
        if (params.updatedAfter && metadata.updated) {
          if ((metadata.updated as string) < params.updatedAfter) return false;
        }
        return true;
      })
      .slice(0, max)
      .map(({ project, fileName, metadata, abstract }) => ({
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
