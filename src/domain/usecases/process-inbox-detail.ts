export interface ProcessInboxDetailParams {
  projectName: string;
  commits?: string[];
  files?: string[];
}

export interface CommitDetail {
  hash: string;
  message: string;
  author: string;
  date: string;
  diff: string;
}

export interface FileDetail {
  path: string;
  content: string;
}

export interface ProcessInboxDetailResult {
  commits: CommitDetail[];
  files: FileDetail[];
}

export interface ProcessInboxDetailUseCase {
  processInboxDetail(params: ProcessInboxDetailParams): Promise<ProcessInboxDetailResult>;
}
