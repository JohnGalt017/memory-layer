import {
  FileRepository,
  ProjectRepository,
  ReadFileParams,
  ReadFileUseCase,
} from "./read-file-protocols.js";

export class ReadFile implements ReadFileUseCase {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly projectRepository: ProjectRepository
  ) {}

  async readFile(params: ReadFileParams): Promise<string | null> {
    const { projectName, fileName, level } = params;

    const projectExists = await this.projectRepository.projectExists(
      projectName
    );
    if (!projectExists) {
      return null;
    }

    if (level && level !== "L2") {
      return this.fileRepository.loadFileAtLevel(projectName, fileName, level);
    }

    return this.fileRepository.loadFile(projectName, fileName);
  }
}
