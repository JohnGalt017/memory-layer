import {
  PatchFileParams,
  PatchFileResult,
  PatchFileUseCase,
} from "../../../src/domain/usecases/patch-file.js";

export class MockPatchFileUseCase implements PatchFileUseCase {
  async patchFile(_params: PatchFileParams): Promise<PatchFileResult> {
    return {
      success: true,
      file: "patched content",
      replacements: 1,
    };
  }
}

export const makePatchFileUseCase = (): PatchFileUseCase => {
  return new MockPatchFileUseCase();
};
