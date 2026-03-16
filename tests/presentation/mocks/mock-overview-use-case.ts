import { OverviewUseCase, OverviewParams, OverviewEntry } from "../../../src/domain/usecases/overview.js";

export class MockOverviewUseCase implements OverviewUseCase {
  async getOverview(_params: OverviewParams): Promise<OverviewEntry[]> {
    return [{ project: "p", fileName: "f.md", abstract: "a" }];
  }
}

export const makeOverviewUseCase = (): OverviewUseCase => {
  return new MockOverviewUseCase();
};
