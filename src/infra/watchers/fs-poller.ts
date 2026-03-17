import fs from "fs-extra";
import path from "path";
import type { FsSnapshot } from "../../domain/entities/watcher-state.js";
import type { WatchIgnore } from "../security/watch-ignore.js";

export interface FsDiff {
  created: string[];
  deleted: string[];
  modified: string[];
}

export class FsPoller {
  async scanDirectory(
    projectPath: string,
    watchIgnore: WatchIgnore
  ): Promise<FsSnapshot> {
    const files: Record<string, { mtime: number; size: number }> = {};
    await this.scanRecursive(projectPath, projectPath, watchIgnore, files);
    return { files };
  }

  private async scanRecursive(
    rootPath: string,
    currentPath: string,
    watchIgnore: WatchIgnore,
    files: Record<string, { mtime: number; size: number }>
  ): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const relativePath = path.relative(
        rootPath,
        path.join(currentPath, entry.name)
      );

      if (entry.isDirectory()) {
        const dirRelative = relativePath + "/";
        if (watchIgnore.isIgnored(dirRelative) || watchIgnore.isIgnored(relativePath)) {
          continue;
        }
        await this.scanRecursive(
          rootPath,
          path.join(currentPath, entry.name),
          watchIgnore,
          files
        );
      } else if (entry.isFile()) {
        if (watchIgnore.isIgnored(relativePath)) continue;
        try {
          const stat = await fs.stat(path.join(currentPath, entry.name));
          files[relativePath] = {
            mtime: stat.mtimeMs,
            size: stat.size,
          };
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  diffSnapshots(oldSnapshot: FsSnapshot, newSnapshot: FsSnapshot): FsDiff {
    const oldFiles = oldSnapshot.files;
    const newFiles = newSnapshot.files;

    const created: string[] = [];
    const deleted: string[] = [];
    const modified: string[] = [];

    for (const filePath of Object.keys(newFiles)) {
      if (!(filePath in oldFiles)) {
        created.push(filePath);
      } else if (newFiles[filePath].mtime !== oldFiles[filePath].mtime) {
        modified.push(filePath);
      }
    }

    for (const filePath of Object.keys(oldFiles)) {
      if (!(filePath in newFiles)) {
        deleted.push(filePath);
      }
    }

    return { created, deleted, modified };
  }
}
