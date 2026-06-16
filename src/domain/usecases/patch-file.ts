import { File } from "../entities/index.js";

export interface PatchFileParams {
  projectName: string;
  fileName: string;
  oldText: string;
  newText: string;
  expectedReplacements?: number;
}

export type PatchFileFailureReason =
  | "project_not_found"
  | "file_not_found"
  | "old_text_not_found"
  | "replacement_count_mismatch";

export interface PatchFileSuccess {
  success: true;
  file: File;
  replacements: number;
}

export interface PatchFileFailure {
  success: false;
  reason: PatchFileFailureReason;
  replacements: number;
  expectedReplacements: number;
}

export type PatchFileResult = PatchFileSuccess | PatchFileFailure;

export interface PatchFileUseCase {
  patchFile(params: PatchFileParams): Promise<PatchFileResult>;
}
