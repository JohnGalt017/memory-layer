import { DbOverview } from "../../../data/usecases/overview/overview.js";
import { FsFileRepository } from "../../../infra/filesystem/index.js";
import { env } from "../../config/env.js";
import { pendingRepo } from "../../services/watcher-singletons.js";
export const makeOverviewUseCase = () => new DbOverview(new FsFileRepository(env.rootPath), pendingRepo);
