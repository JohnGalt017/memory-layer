import { WatchStartController } from "../../../../presentation/controllers/watch-start/watch-start-controller.js";
import { WatchStart } from "../../../../data/usecases/watch-start/watch-start.js";
import { ValidatorComposite } from "../../../../validators/validator-composite.js";
import { RequiredFieldValidator } from "../../../../validators/required-field-validator.js";
import { PathSecurityValidator } from "../../../../validators/path-security-validator.js";
import { AbsolutePathValidator } from "../../../../validators/absolute-path-validator.js";
import { InitialScanExtractor } from "../../../../infra/watchers/initial-scan-extractor.js";
import { WatchIgnore } from "../../../../infra/security/watch-ignore.js";
import {
  configRepo,
  pendingRepo,
  gitStateRepo,
  watcherRegistry,
} from "../../../services/watcher-singletons.js";

export const makeWatchStartController = () => {
  const watchIgnore = new WatchIgnore();
  const initialScanExtractor = new InitialScanExtractor(watchIgnore);
  const useCase = new WatchStart(
    configRepo,
    pendingRepo,
    gitStateRepo,
    initialScanExtractor,
    watcherRegistry
  );
  const validator = new ValidatorComposite([
    new RequiredFieldValidator("path"),
    new RequiredFieldValidator("projectName"),
    new PathSecurityValidator("projectName"),
    new AbsolutePathValidator("path"),
  ]);
  return new WatchStartController(useCase, validator);
};
