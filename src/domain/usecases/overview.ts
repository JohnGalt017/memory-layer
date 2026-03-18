export interface OverviewParams {
  projectName?: string;
}

export interface OverviewEntry {
  project: string;
  fileName: string;
  type?: string;
  status?: string;
  abstract: string;
  tags?: string[];
  updated?: string;
  tokens?: string;
  pendingChanges?: number;
}

export interface OverviewUseCase {
  getOverview(params: OverviewParams): Promise<OverviewEntry[]>;
}
