import { WriteFile } from "../../../data/usecases/write-file/write-file.js";
import { FsFileRepository } from "../../../infra/filesystem/index.js";
import { FsProjectRepository } from "../../../infra/filesystem/repositories/fs-project-repository.js";
import { FsFrontmatterService } from "../../../infra/filesystem/services/index.js";
import { env } from "../../config/env.js";

export const makeWriteFile = () => {
  const projectRepository = new FsProjectRepository(env.rootPath);
  const fileRepository = new FsFileRepository(env.rootPath);
  const frontmatterService = new FsFrontmatterService();

  return new WriteFile(fileRepository, projectRepository, frontmatterService);
};
