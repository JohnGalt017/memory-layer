import fs from "fs-extra";
import path from "path";
import { FileRepository } from "../../../data/protocols/file-repository.js";
import { File } from "../../../domain/entities/index.js";
import { SearchMatch } from "../../../domain/usecases/search-files.js";
import { FsFrontmatterService } from "../services/fs-frontmatter-service.js";
/**
 * Filesystem implementation of the FileRepository protocol
 */
export class FsFileRepository implements FileRepository {
  private readonly frontmatter = new FsFrontmatterService();

  /**
   * Creates a new FsFileRepository
   * @param rootDir The root directory where all projects are stored
   */
  constructor(private readonly rootDir: string) {}

  /**
   * Lists all files in a project
   * @param projectName The name of the project
   * @returns An array of file names
   */
  async listFiles(projectName: string): Promise<File[]> {
    const projectPath = path.join(this.rootDir, projectName);

    const projectExists = await fs.pathExists(projectPath);
    if (!projectExists) {
      return [];
    }

    const entries = await fs.readdir(projectPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  }

  /**
   * Loads the content of a file
   * @param projectName The name of the project
   * @param fileName The name of the file
   * @returns The content of the file or null if the file doesn't exist
   */
  async loadFile(
    projectName: string,
    fileName: string
  ): Promise<string | null> {
    const filePath = path.join(this.rootDir, projectName, fileName);

    const fileExists = await fs.pathExists(filePath);
    if (!fileExists) {
      return null;
    }

    const content = await fs.readFile(filePath, "utf-8");
    return content;
  }

  /**
   * Writes a new file
   * @param projectName The name of the project
   * @param fileName The name of the file
   * @param content The content to write
   * @returns The content of the file after writing, or null if the file already exists
   */
  async writeFile(
    projectName: string,
    fileName: string,
    content: string
  ): Promise<File | null> {
    const projectPath = path.join(this.rootDir, projectName);
    await fs.ensureDir(projectPath);

    const filePath = path.join(projectPath, fileName);

    const fileExists = await fs.pathExists(filePath);
    if (fileExists) {
      return null;
    }

    await fs.writeFile(filePath, content, "utf-8");

    return await this.loadFile(projectName, fileName);
  }

  /**
   * Updates an existing file
   * @param projectName The name of the project
   * @param fileName The name of the file
   * @param content The new content
   * @returns The content of the file after updating, or null if the file doesn't exist
   */
  async updateFile(
    projectName: string,
    fileName: string,
    content: string
  ): Promise<File | null> {
    const filePath = path.join(this.rootDir, projectName, fileName);

    const fileExists = await fs.pathExists(filePath);
    if (!fileExists) {
      return null;
    }

    await fs.writeFile(filePath, content, "utf-8");

    return await this.loadFile(projectName, fileName);
  }

  /**
   * Writes a file if it doesn't exist, or updates it if it does
   * @param projectName The name of the project
   * @param fileName The name of the file
   * @param content The content to write
   * @returns The content of the file after writing or updating
   */
  async upsertFile(
    projectName: string,
    fileName: string,
    content: string
  ): Promise<File | null> {
    const projectPath = path.join(this.rootDir, projectName);
    await fs.ensureDir(projectPath);
    const filePath = path.join(projectPath, fileName);
    await fs.writeFile(filePath, content, "utf-8");
    return await this.loadFile(projectName, fileName);
  }

  async appendFile(projectName: string, fileName: string, content: string): Promise<File | null> {
    const projectPath = path.join(this.rootDir, projectName);
    await fs.ensureDir(projectPath);
    const filePath = path.join(projectPath, fileName);
    await fs.appendFile(filePath, content, "utf-8");
    return await this.loadFile(projectName, fileName);
  }

  async searchFiles(
    projectName: string,
    query: string
  ): Promise<SearchMatch[]> {
    const files = await this.listFiles(projectName);
    const results: SearchMatch[] = [];
    const lowerQuery = query.toLowerCase();

    for (const fileName of files) {
      const content = await this.loadFile(projectName, fileName as string);
      if (!content) continue;
      const matchingLines = content
        .split("\n")
        .filter((line) => line.toLowerCase().includes(lowerQuery));
      if (matchingLines.length > 0) {
        results.push({ fileName: fileName as string, matches: matchingLines });
      }
    }

    return results;
  }

  async loadFileAtLevel(
    projectName: string,
    fileName: string,
    level: "L0" | "L1" | "L2"
  ): Promise<string | null> {
    const content = await this.loadFile(projectName, fileName);
    if (content === null) return null;

    if (level === "L2") return content;

    const { metadata, body } = this.frontmatter.parse(content);

    if (level === "L0") {
      const abstract = this.frontmatter.extractAbstract(content);
      const type = metadata.type ? `[${metadata.type}]` : "";
      const status = metadata.status ? ` (${metadata.status})` : "";
      return `${fileName}${type}${status}: ${abstract}`;
    }

    // L1: frontmatter + first 50 lines of body
    const bodyLines = body.split("\n").slice(0, 50).join("\n");
    const metaStr =
      Object.keys(metadata).length > 0
        ? this.frontmatter.stringify(metadata, "").trim() + "\n\n"
        : "";
    return metaStr + bodyLines;
  }

  async listFilesWithMetadata(
    projectName?: string
  ): Promise<Array<{ project: string; fileName: string; metadata: Record<string, unknown>; abstract: string }>> {
    const results: Array<{ project: string; fileName: string; metadata: Record<string, unknown>; abstract: string }> = [];

    const projects = projectName
      ? [projectName]
      : (await fs.readdir(this.rootDir, { withFileTypes: true }))
          .filter((e) => e.isDirectory())
          .map((e) => e.name);

    for (const project of projects) {
      const files = await this.listFiles(project);
      for (const file of files) {
        const content = await this.loadFile(project, file as string);
        if (!content) continue;
        const { metadata } = this.frontmatter.parse(content);
        const abstract = this.frontmatter.extractAbstract(content);
        results.push({ project, fileName: file as string, metadata, abstract });
      }
    }

    return results;
  }
}
