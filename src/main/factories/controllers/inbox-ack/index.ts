import { InboxAckController } from "../../../../presentation/controllers/inbox-ack/inbox-ack-controller.js";
import { InboxAck } from "../../../../data/usecases/inbox-ack/inbox-ack.js";
import { ValidatorComposite } from "../../../../validators/validator-composite.js";
import { RequiredFieldValidator } from "../../../../validators/required-field-validator.js";
import { PathSecurityValidator } from "../../../../validators/path-security-validator.js";
import {
  configRepo,
  pendingRepo,
  gitStateRepo,
} from "../../../services/watcher-singletons.js";

export const makeInboxAckController = () => {
  const useCase = new InboxAck(pendingRepo, configRepo, gitStateRepo);
  const validator = new ValidatorComposite([
    new RequiredFieldValidator("projectName"),
    new PathSecurityValidator("projectName"),
  ]);
  return new InboxAckController(useCase, validator);
};
