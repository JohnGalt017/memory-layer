import { WatchUpdateController } from "../../../../presentation/controllers/watch-update/watch-update-controller.js";
import { WatchUpdate } from "../../../../data/usecases/watch-update/watch-update.js";
import { ValidatorComposite } from "../../../../validators/validator-composite.js";
import { RequiredFieldValidator } from "../../../../validators/required-field-validator.js";
import { PathSecurityValidator } from "../../../../validators/path-security-validator.js";
import {
  configRepo,
  watcherRegistry,
} from "../../../services/watcher-singletons.js";

export const makeWatchUpdateController = () => {
  const useCase = new WatchUpdate(configRepo, watcherRegistry);
  const validator = new ValidatorComposite([
    new RequiredFieldValidator("projectName"),
    new PathSecurityValidator("projectName"),
  ]);
  return new WatchUpdateController(useCase, validator);
};
