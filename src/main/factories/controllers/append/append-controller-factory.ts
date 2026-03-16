import { AppendController } from "../../../../presentation/controllers/append/index.js";
import { makeAppendFileUseCase } from "../../use-cases/append-file-factory.js";
import { makeAppendValidation } from "./append-validation-factory.js";
export const makeAppendController = () => new AppendController(makeAppendFileUseCase(), makeAppendValidation());
