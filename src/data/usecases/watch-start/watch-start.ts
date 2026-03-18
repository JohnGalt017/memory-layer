import fs from "fs-extra";
import path from "path";
import {
  WatchStartUseCase,
  WatchStartParams,
  WatchStartResult,
} from "../../../domain/usecases/watch-start.js";
import { WatcherConfigRepository } from "../../protocols/watcher-config-repository.js";
import { PendingChangesRepository } from "../../protocols/pending-changes-repository.js";
import { GitStateRepository } from "../../protocols/git-state-repository.js";
import { InitialScanExtractor } from "../../../infra/watchers/initial-scan-extractor.js";
import { WatcherRegistry } from "../../../main/services/watcher-registry.js";
import { PendingChangesIndex } from "../../../domain/entities/watcher-state.js";

export class WatchStart implements WatchStartUseCase {
  constructor(
    private readonly configRepo: WatcherConfigRepository,
    private readonly pendingRepo: PendingChangesRepository,
    private readonly gitStateRepo: GitStateRepository,
    private readonly initialScanExtractor: InitialScanExtractor,
    private readonly registry: WatcherRegistry
  ) {}

  async watchStart(params: WatchStartParams): Promise<WatchStartResult> {
    const exists = await fs.pathExists(params.path);
    if (!exists) {
      throw new Error("directory not found");
    }

    const gitAvailable = await fs.pathExists(path.join(params.path, ".git"));

    const snapshot = await this.initialScanExtractor.extract(params.path);

    const initialIndex: PendingChangesIndex = {
      type: "initial",
      since: new Date().toISOString(),
      gitAvailable,
      totalChanges: 0,
      commits: snapshot.gitLog,
      hotFiles: [],
      filesCreated: [],
      filesDeleted: [],
      branches: { created: [], deleted: [] },
      snapshot,
    };

    await this.pendingRepo.save(params.projectName, initialIndex);

    if (gitAvailable && snapshot.gitLog.length > 0) {
      await this.gitStateRepo.save(params.projectName, {
        lastRev: snapshot.gitLog[0].hash,
        lastBranches: snapshot.branches,
        lastStatus: snapshot.gitStatus,
      });
    }

    const state = {
      projectName: params.projectName,
      path: params.path,
      processingModel: params.processingModel ?? "sonnet",
      pollInterval: params.pollInterval ?? 30,
      gitAvailable,
      status: "watching" as const,
    };

    await this.configRepo.save(params.projectName, state);
    await this.registry.start(state);

    return {
      status: "watching",
      gitAvailable,
      hasPendingChanges: initialIndex.snapshot !== undefined,
      warning: gitAvailable ? undefined : "No git detected — change tracking is limited",
    };
  }
}
