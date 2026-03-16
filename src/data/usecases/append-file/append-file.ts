import { File } from "../../../domain/entities/index.js";
import { AppendFileUseCase, AppendFileParams } from "../../../domain/usecases/index.js";
import { FileRepository } from "../../protocols/index.js";

export class AppendFile implements AppendFileUseCase {
  constructor(private readonly fileRepository: FileRepository) {}

  async appendFile(params: AppendFileParams): Promise<File | null> {
    const { projectName, fileName, content } = params;
    return this.fileRepository.appendFile(projectName, fileName, content);
  }
}
