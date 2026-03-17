import { ProcessInboxDetailController } from "../../../../presentation/controllers/process-inbox-detail/process-inbox-detail-controller.js";
import { ProcessInboxDetail } from "../../../../data/usecases/process-inbox-detail/process-inbox-detail.js";
import { ValidatorComposite } from "../../../../validators/validator-composite.js";
import { RequiredFieldValidator } from "../../../../validators/required-field-validator.js";
import { PathSecurityValidator } from "../../../../validators/path-security-validator.js";
import { configRepo } from "../../../services/watcher-singletons.js";

export const makeProcessInboxDetailController = () => {
  const useCase = new ProcessInboxDetail(configRepo);
  const validator = new ValidatorComposite([
    new RequiredFieldValidator("projectName"),
    new PathSecurityValidator("projectName"),
  ]);
  return new ProcessInboxDetailController(useCase, validator);
};
