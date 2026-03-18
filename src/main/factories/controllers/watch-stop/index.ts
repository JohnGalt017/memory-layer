import { WatchStopController } from "../../../../presentation/controllers/watch-stop/watch-stop-controller.js";
import { WatchStop } from "../../../../data/usecases/watch-stop/watch-stop.js";
import { ValidatorComposite } from "../../../../validators/validator-composite.js";
import { RequiredFieldValidator } from "../../../../validators/required-field-validator.js";
import { PathSecurityValidator } from "../../../../validators/path-security-validator.js";
import {
  configRepo,
  watcherRegistry,
} from "../../../services/watcher-singletons.js";

export const makeWatchStopController = () => {
  const useCase = new WatchStop(configRepo, watcherRegistry);
  const validator = new ValidatorComposite([
    new RequiredFieldValidator("projectName"),
    new PathSecurityValidator("projectName"),
  ]);
  return new WatchStopController(useCase, validator);
};
