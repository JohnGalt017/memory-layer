import fs from "fs-extra";
import {
  ProcessInboxDetailUseCase,
  ProcessInboxDetailParams,
  ProcessInboxDetailResult,
  CommitDetail,
  FileDetail,
} from "../../../domain/usecases/process-inbox-detail.js";
import { WatcherConfigRepository } from "../../protocols/watcher-config-repository.js";
import { GitPoller } from "../../../infra/watchers/git-poller.js";
import { WatchIgnore } from "../../../infra/security/watch-ignore.js";

export class ProcessInboxDetail implements ProcessInboxDetailUseCase {
  constructor(private readonly configRepo: WatcherConfigRepository) {}

  async processInboxDetail(
    params: ProcessInboxDetailParams
  ): Promise<ProcessInboxDetailResult> {
    const all = await this.configRepo.loadAll();
    const config = all[params.projectName];
    if (!config) {
      throw new Error(`watcher not found: ${params.projectName}`);
    }

    const projectPath = config.path;
    const watchIgnore = await WatchIgnore.fromProject(projectPath);

    const commits: CommitDetail[] = [];
    const files: FileDetail[] = [];

    if (params.commits && params.commits.length > 0) {
      const poller = new GitPoller(projectPath);
      for (const hash of params.commits) {
        const detail = await poller.getCommitDetail(hash);
        if (detail) {
          const [hashPart, ...rest] = detail.split(" ");
          commits.push({
            hash: hashPart,
            message: rest.join(" "),
            author: "",
            date: "",
            diff: "",
          });
        }
      }
    }

    if (params.files && params.files.length > 0) {
      const poller = config.gitAvailable ? new GitPoller(projectPath) : null;

      for (const filePath of params.files) {
        if (!watchIgnore.isPathSafe(filePath, projectPath)) {
          continue;
        }

        let content = "";

        if (poller) {
          const headRev = await poller.getHeadRev();
          if (headRev) {
            const diff = await poller.getFileDiff(headRev, filePath);
            content = diff ?? "";
          }
        } else {
          const absolutePath = `${projectPath}/${filePath}`;
          const exists = await fs.pathExists(absolutePath);
          if (exists) {
            const raw = await fs.readFile(absolutePath, "utf-8");
            const lines = raw.split("\n");
            content = lines.slice(0, 500).join("\n");
          }
        }

        files.push({ path: filePath, content });
      }
    }

    return { commits, files };
  }
}
