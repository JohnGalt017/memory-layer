import {
  FileRepository,
  ProjectRepository,
  WriteFileParams,
  WriteFileUseCase,
} from "./write-file-protocols.js";
import { FrontmatterService } from "../../../domain/services/index.js";

export class WriteFile implements WriteFileUseCase {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly frontmatterService: FrontmatterService
  ) {}

  async writeFile(params: WriteFileParams): Promise<string | null> {
    const { projectName, fileName, content } = params;

    await this.projectRepository.ensureProject(projectName);

    const existingFile = await this.fileRepository.loadFile(
      projectName,
      fileName
    );
    if (existingFile !== null) {
      return null;
    }

    const enriched = this.frontmatterService.injectAbstract(content);
    await this.fileRepository.writeFile(projectName, fileName, enriched);
    return await this.fileRepository.loadFile(projectName, fileName);
  }
}
