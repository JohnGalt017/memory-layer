import { PatchController } from "../../../../presentation/controllers/patch/index.js";
import { makePatchFile } from "../../use-cases/patch-file-factory.js";
import { makePatchValidation } from "./patch-validation-factory.js";

export const makePatchController = () => {
  const validator = makePatchValidation();
  const patchFileUseCase = makePatchFile();

  return new PatchController(patchFileUseCase, validator);
};
