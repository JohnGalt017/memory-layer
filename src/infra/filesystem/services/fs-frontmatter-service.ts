import matter from "gray-matter";
import { FrontmatterService, ParsedFile } from "../../../domain/services/index.js";

export class FsFrontmatterService implements FrontmatterService {
  parse(content: string): ParsedFile {
    const { data, content: body } = matter(content);
    return { metadata: data, body };
  }

  stringify(metadata: Record<string, unknown>, body: string): string {
    return matter.stringify(body, metadata);
  }

  injectAbstract(content: string): string {
    try {
      const { metadata, body } = this.parse(content);
      if (metadata.abstract) return content;
      const abstract = this.extractAbstract(content);
      if (!abstract) return content;
      return this.stringify({ ...metadata, abstract }, body);
    } catch {
      return content;
    }
  }

  extractAbstract(content: string): string {
    const { data, content: body } = matter(content);

    if (data.abstract && typeof data.abstract === "string") {
      return data.abstract;
    }

    const lines = body.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        return trimmed.slice(0, 200);
      }
    }

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("# ")) {
        return trimmed.replace(/^#\s+/, "").slice(0, 200);
      }
    }

    return "";
  }
}
