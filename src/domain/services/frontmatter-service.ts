export interface ParsedFile {
  metadata: Record<string, unknown>;
  body: string;
}

export interface FrontmatterService {
  parse(content: string): ParsedFile;
  stringify(metadata: Record<string, unknown>, body: string): string;
  extractAbstract(content: string): string;
  injectAbstract(content: string): string;
}
