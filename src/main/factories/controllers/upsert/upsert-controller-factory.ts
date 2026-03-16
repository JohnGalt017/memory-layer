import { UpsertController } from "../../../../presentation/controllers/upsert/index.js";
import { makeUpsertFileUseCase } from "../../use-cases/upsert-file-factory.js";
import { makeUpsertValidation } from "./upsert-validation-factory.js";

export const makeUpsertController = () =>
  new UpsertController(makeUpsertFileUseCase(), makeUpsertValidation());
