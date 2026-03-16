import { SearchFilesUseCase, SearchFilesParams, SearchMatch } from "../../../domain/usecases/index.js";
import { FileRepository } from "../../protocols/index.js";

export class SearchFiles implements SearchFilesUseCase {
  constructor(private readonly fileRepository: FileRepository) {}

  async searchFiles(params: SearchFilesParams): Promise<SearchMatch[]> {
    return this.fileRepository.searchFiles(params.projectName, params.query);
  }
}
