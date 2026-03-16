import { DbQueryFiles } from "../../../data/usecases/query-files/query-files.js";
import { FsFileRepository } from "../../../infra/filesystem/index.js";
import { env } from "../../config/env.js";
export const makeQueryFilesUseCase = () => new DbQueryFiles(new FsFileRepository(env.rootPath));
