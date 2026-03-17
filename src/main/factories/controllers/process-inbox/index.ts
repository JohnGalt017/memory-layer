import { ProcessInboxController } from "../../../../presentation/controllers/process-inbox/process-inbox-controller.js";
import { ProcessInbox } from "../../../../data/usecases/process-inbox/process-inbox.js";
import { ValidatorComposite } from "../../../../validators/validator-composite.js";
import { RequiredFieldValidator } from "../../../../validators/required-field-validator.js";
import { PathSecurityValidator } from "../../../../validators/path-security-validator.js";
import {
  configRepo,
  pendingRepo,
} from "../../../services/watcher-singletons.js";

export const makeProcessInboxController = () => {
  const useCase = new ProcessInbox(configRepo, pendingRepo);
  const validator = new ValidatorComposite([
    new RequiredFieldValidator("projectName"),
    new PathSecurityValidator("projectName"),
  ]);
  return new ProcessInboxController(useCase, validator);
};
