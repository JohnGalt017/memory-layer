import { OverviewController } from "../../../../presentation/controllers/overview/index.js";
import { makeOverviewUseCase } from "../../use-cases/overview-factory.js";
import { makeOverviewValidation } from "./overview-validation-factory.js";
export const makeOverviewController = () => new OverviewController(makeOverviewUseCase(), makeOverviewValidation());
