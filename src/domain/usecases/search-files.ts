export interface SearchFilesParams {
  projectName: string;
  query: string;
}

export interface SearchMatch {
  fileName: string;
  matches: string[];
}

export interface SearchFilesUseCase {
  searchFiles(params: SearchFilesParams): Promise<SearchMatch[]>;
}
