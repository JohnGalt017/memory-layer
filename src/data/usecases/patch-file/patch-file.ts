import { PatchFileResult } from "../../../domain/usecases/patch-file.js";
import {
  FileRepository,
  PatchFileParams,
  PatchFileUseCase,
  ProjectRepository,
} from "./patch-file-protocols.js";

const DEFAULT_EXPECTED_REPLACEMENTS = 1;

const countOccurrences = (content: string, search: string): number => {
  if (search.length === 0) return 0;

  let count = 0;
  let index = content.indexOf(search);

  while (index !== -1) {
    count += 1;
    index = content.indexOf(search, index + search.length);
  }

  return count;
};

export class PatchFile implements PatchFileUseCase {
  constructor(
    private readonly fileRepository: FileRepository,
    private readonly projectRepository: ProjectRepository
  ) {}

  async patchFile(params: PatchFileParams): Promise<PatchFileResult> {
    const {
      projectName,
      fileName,
      oldText,
      newText,
      expectedReplacements = DEFAULT_EXPECTED_REPLACEMENTS,
    } = params;

    const projectExists = await this.projectRepository.projectExists(projectName);
    if (!projectExists) {
      return {
        success: false,
        reason: "project_not_found",
        replacements: 0,
        expectedReplacements,
      };
    }

    const existingFile = await this.fileRepository.loadFile(projectName, fileName);
    if (existingFile === null) {
      return {
        success: false,
        reason: "file_not_found",
        replacements: 0,
        expectedReplacements,
      };
    }

    const replacements = countOccurrences(existingFile, oldText);
    if (replacements === 0) {
      return {
        success: false,
        reason: "old_text_not_found",
        replacements,
        expectedReplacements,
      };
    }

    if (replacements !== expectedReplacements) {
      return {
        success: false,
        reason: "replacement_count_mismatch",
        replacements,
        expectedReplacements,
      };
    }

    const patchedContent = existingFile.split(oldText).join(newText);
    const updatedFile = await this.fileRepository.updateFile(
      projectName,
      fileName,
      patchedContent
    );

    if (updatedFile === null) {
      return {
        success: false,
        reason: "file_not_found",
        replacements: 0,
        expectedReplacements,
      };
    }

    return {
      success: true,
      file: updatedFile,
      replacements,
    };
  }
}
