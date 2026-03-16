import { describe, it, expect } from "vitest";
import { FsFrontmatterService } from "./fs-frontmatter-service.js";

describe("FsFrontmatterService", () => {
  const sut = new FsFrontmatterService();

  describe("parse", () => {
    it("should parse frontmatter and body", () => {
      const content = "---\ntitle: Test\n---\n\nBody text.";
      const result = sut.parse(content);
      expect(result.metadata).toEqual({ title: "Test" });
      expect(result.body.trim()).toBe("Body text.");
    });

    it("should return empty metadata for file without frontmatter", () => {
      const result = sut.parse("# Title\n\nBody.");
      expect(result.metadata).toEqual({});
      expect(result.body.trim()).toBe("# Title\n\nBody.");
    });
  });

  describe("extractAbstract", () => {
    it("should return abstract from frontmatter if present", () => {
      const content = "---\nabstract: My abstract\n---\n\n# Title\n\nBody.";
      expect(sut.extractAbstract(content)).toBe("My abstract");
    });

    it("should fall back to first non-heading line", () => {
      const content = "# Title\n\nThis is the description.";
      expect(sut.extractAbstract(content)).toBe("This is the description.");
    });

    it("should fall back to first heading when no body text", () => {
      const content = "# My Title";
      expect(sut.extractAbstract(content)).toBe("My Title");
    });

    it("should return empty string when nothing to extract", () => {
      expect(sut.extractAbstract("")).toBe("");
    });
  });

  describe("stringify", () => {
    it("should produce valid frontmatter + body", () => {
      const result = sut.stringify({ abstract: "test" }, "Body here.");
      expect(result).toContain("abstract: test");
      expect(result).toContain("Body here.");
    });
  });
});
