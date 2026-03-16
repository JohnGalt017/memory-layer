import { AppendFile } from "../../../data/usecases/append-file/append-file.js";
import { FsFileRepository } from "../../../infra/filesystem/index.js";
import { env } from "../../config/env.js";

export const makeAppendFileUseCase = () => new AppendFile(new FsFileRepository(env.rootPath));
