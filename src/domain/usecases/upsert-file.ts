import { File } from "../entities/index.js";

export interface UpsertFileParams {
  projectName: string;
  fileName: string;
  content: string;
}

export interface UpsertFileUseCase {
  upsertFile(params: UpsertFileParams): Promise<File | null>;
}
