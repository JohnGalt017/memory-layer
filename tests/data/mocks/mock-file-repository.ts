import { FileRepository } from "../../../src/data/protocols/file-repository.js";
import { SearchMatch } from "../../../src/domain/usecases/search-files.js";

export class MockFileRepository implements FileRepository {
  private projectFiles: Record<string, Record<string, string>> = {
    "project-1": {
      "file1.md": "Content of file1.md",
      "file2.md": "Content of file2.md",
    },
    "project-2": {
      "fileA.md": "Content of fileA.md",
      "fileB.md": "Content of fileB.md",
    },
  };

  async listFiles(projectName: string): Promise<string[]> {
    return Object.keys(this.projectFiles[projectName] || {});
  }

  async loadFile(
    projectName: string,
    fileName: string
  ): Promise<string | null> {
    if (
      this.projectFiles[projectName] &&
      this.projectFiles[projectName][fileName]
    ) {
      return this.projectFiles[projectName][fileName];
    }
    return null;
  }

  async writeFile(
    projectName: string,
    fileName: string,
    content: string
  ): Promise<string | null> {
    if (!this.projectFiles[projectName]) {
      this.projectFiles[projectName] = {};
    }
    this.projectFiles[projectName][fileName] = content;
    return content;
  }

  async updateFile(
    projectName: string,
    fileName: string,
    content: string
  ): Promise<string | null> {
    if (
      this.projectFiles[projectName] &&
      this.projectFiles[projectName][fileName]
    ) {
      this.projectFiles[projectName][fileName] = content;
      return content;
    }
    return null;
  }

  async upsertFile(
    projectName: string,
    fileName: string,
    content: string
  ): Promise<string | null> {
    if (!this.projectFiles[projectName]) {
      this.projectFiles[projectName] = {};
    }
    this.projectFiles[projectName][fileName] = content;
    return content;
  }

  async appendFile(
    projectName: string,
    fileName: string,
    content: string
  ): Promise<string | null> {
    if (!this.projectFiles[projectName]) {
      this.projectFiles[projectName] = {};
    }
    const existing = this.projectFiles[projectName][fileName] ?? "";
    this.projectFiles[projectName][fileName] = existing + content;
    return this.projectFiles[projectName][fileName];
  }

  async searchFiles(
    _projectName: string,
    _query: string
  ): Promise<SearchMatch[]> {
    return [];
  }

  async loadFileAtLevel(
    projectName: string,
    fileName: string,
    _level: "L0" | "L1" | "L2"
  ): Promise<string | null> {
    return this.loadFile(projectName, fileName);
  }

  async listFilesWithMetadata(
    _projectName?: string
  ): Promise<Array<{ project: string; fileName: string; metadata: Record<string, unknown>; abstract: string }>> {
    return [];
  }
}
