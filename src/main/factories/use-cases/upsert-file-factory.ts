import { UpsertFile } from "../../../data/usecases/upsert-file/upsert-file.js";
import { FsFileRepository } from "../../../infra/filesystem/index.js";
import { FsFrontmatterService } from "../../../infra/filesystem/services/index.js";
import { env } from "../../config/env.js";

export const makeUpsertFileUseCase = () => {
  const repository = new FsFileRepository(env.rootPath);
  const frontmatterService = new FsFrontmatterService();
  return new UpsertFile(repository, frontmatterService);
};
