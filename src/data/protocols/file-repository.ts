import { File } from "../../domain/entities/index.js";
import { SearchMatch } from "../../domain/usecases/search-files.js";

export interface FileRepository {
  listFiles(projectName: string): Promise<File[]>;
  loadFile(projectName: string, fileName: string): Promise<File | null>;
  writeFile(
    projectName: string,
    fileName: string,
    content: string
  ): Promise<File | null>;
  updateFile(
    projectName: string,
    fileName: string,
    content: string
  ): Promise<File | null>;
  upsertFile(projectName: string, fileName: string, content: string): Promise<File | null>;
  appendFile(projectName: string, fileName: string, content: string): Promise<File | null>;
  searchFiles(projectName: string, query: string): Promise<SearchMatch[]>;
  loadFileAtLevel(
    projectName: string,
    fileName: string,
    level: "L0" | "L1" | "L2"
  ): Promise<string | null>;
  listFilesWithMetadata(
    projectName?: string
  ): Promise<Array<{ project: string; fileName: string; metadata: Record<string, unknown>; abstract: string }>>;
}
