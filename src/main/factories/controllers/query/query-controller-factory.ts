import { QueryController } from "../../../../presentation/controllers/query/index.js";
import { makeQueryFilesUseCase } from "../../use-cases/query-files-factory.js";
import { makeQueryValidation } from "./query-validation-factory.js";
export const makeQueryController = () => new QueryController(makeQueryFilesUseCase(), makeQueryValidation());
