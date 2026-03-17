export interface WatchStopParams {
  projectName: string;
}

export interface WatchStopResult {
  status: "stopped";
}

export interface WatchStopUseCase {
  watchStop(params: WatchStopParams): Promise<WatchStopResult>;
}
