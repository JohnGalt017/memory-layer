import { QueryFilesUseCase, QueryFilesParams } from "../../../src/domain/usecases/query-files.js";
import { OverviewEntry } from "../../../src/domain/usecases/overview.js";

export class MockQueryFilesUseCase implements QueryFilesUseCase {
  async queryFiles(_params: QueryFilesParams): Promise<OverviewEntry[]> {
    return [];
  }
}

export const makeQueryFilesUseCase = (): QueryFilesUseCase => {
  return new MockQueryFilesUseCase();
};
