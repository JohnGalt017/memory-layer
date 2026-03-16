import { SearchController } from "../../../../presentation/controllers/search/index.js";
import { makeSearchFilesUseCase } from "../../use-cases/search-files-factory.js";
import { makeSearchValidation } from "./search-validation-factory.js";
export const makeSearchController = () => new SearchController(makeSearchFilesUseCase(), makeSearchValidation());
