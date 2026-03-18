import { env } from "../config/env.js";
import { FsWatcherConfigRepository } from "../../infra/filesystem/repositories/fs-watcher-config-repository.js";
import { FsPendingChangesRepository } from "../../infra/filesystem/repositories/fs-pending-changes-repository.js";
import { FsGitStateRepository } from "../../infra/filesystem/repositories/fs-git-state-repository.js";
import { FsSnapshotRepositoryImpl } from "../../infra/filesystem/repositories/fs-snapshot-repository.js";
import { WatcherRegistry } from "./watcher-registry.js";
import { WatcherBootstrap } from "./watcher-bootstrap.js";

export const configRepo = new FsWatcherConfigRepository(env.rootPath);
export const pendingRepo = new FsPendingChangesRepository(env.rootPath);
export const gitStateRepo = new FsGitStateRepository(env.rootPath);
export const snapshotRepo = new FsSnapshotRepositoryImpl(env.rootPath);

export const watcherRegistry = new WatcherRegistry(
  configRepo,
  pendingRepo,
  gitStateRepo,
  snapshotRepo
);
export const watcherBootstrap = new WatcherBootstrap(configRepo, watcherRegistry);
