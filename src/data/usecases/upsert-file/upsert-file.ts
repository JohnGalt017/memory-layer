import { File } from "../../../domain/entities/index.js";
import { UpsertFileUseCase, UpsertFileParams } from "../../../domain/usecases/index.js";
import { FileRepository } from "../../protocols/index.js";
import { FrontmatterService } from "../../../domain/services/index.js";

export class UpsertFile implements UpsertFileUseCase {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly frontmatterService: FrontmatterService
  ) {}

  async upsertFile(params: UpsertFileParams): Promise<File | null> {
    const { projectName, fileName, content } = params;
    const enriched = this.frontmatterService.injectAbstract(content);
    return this.fileRepository.upsertFile(projectName, fileName, enriched);
  }
}
