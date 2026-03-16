import { OverviewEntry } from "./overview.js";

export interface QueryFilesParams {
  projectName?: string;
  type?: string;
  status?: string;
  tags?: string[];
  updatedAfter?: string;
  maxResults?: number;
}

export interface QueryFilesUseCase {
  queryFiles(params: QueryFilesParams): Promise<OverviewEntry[]>;
}
