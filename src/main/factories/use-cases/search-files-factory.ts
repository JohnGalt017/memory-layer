import { SearchFiles } from "../../../data/usecases/search-files/search-files.js";
import { FsFileRepository } from "../../../infra/filesystem/index.js";
import { env } from "../../config/env.js";
export const makeSearchFilesUseCase = () => new SearchFiles(new FsFileRepository(env.rootPath));
