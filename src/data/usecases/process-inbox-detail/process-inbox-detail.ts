import fs from "fs-extra";
import path from "path";
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

function parseCommitDetail(output: string, requestedHash: string): CommitDetail {
  const lines = output.split("\n");
  const hash = lines[0]?.trim() || requestedHash;
  const author = lines[1]?.trim() || "";
  const date = lines[2]?.trim() || "";
  const message = lines[3]?.trim() || "";
  // Diff starts after the 4-line header; skip blank separator line
  const diffStart = lines.findIndex((l, i) => i >= 4 && l.startsWith("diff --git"));
  const diff = diffStart >= 0 ? lines.slice(diffStart).join("\n") : "";
  return { hash, message, author, date, diff };
}

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
          commits.push(parseCommitDetail(detail, hash));
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
          // H5: use path.join instead of string concatenation
          const absolutePath = path.join(projectPath, filePath);
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
