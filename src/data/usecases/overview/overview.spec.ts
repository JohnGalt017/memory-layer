import { describe, it, expect, vi } from "vitest";
import { DbOverview } from "./overview.js";
import { FileRepository } from "../../protocols/index.js";

const makeFileRepository = (): FileRepository =>
  ({
    listFiles: vi.fn(),
    loadFile: vi.fn(),
    writeFile: vi.fn(),
    updateFile: vi.fn(),
    upsertFile: vi.fn(),
    appendFile: vi.fn(),
    searchFiles: vi.fn(),
    loadFileAtLevel: vi.fn(),
    listFilesWithMetadata: vi.fn().mockResolvedValue([
      {
        project: "proj",
        fileName: "arch.md",
        metadata: { type: "architecture", status: "active", tags: ["rust"] },
        abstract: "Main architecture doc",
      },
    ]),
  }) as unknown as FileRepository;

describe("DbOverview", () => {
  it("should return overview entries", async () => {
    const repo = makeFileRepository();
    const sut = new DbOverview(repo);
    const result = await sut.getOverview({ projectName: "proj" });
    expect(vi.mocked(repo.listFilesWithMetadata)).toHaveBeenCalledWith("proj");
    expect(result[0]).toMatchObject({
      project: "proj",
      fileName: "arch.md",
      abstract: "Main architecture doc",
      type: "architecture",
    });
  });

  it("should call listFilesWithMetadata with undefined when no project", async () => {
    const repo = makeFileRepository();
    const sut = new DbOverview(repo);
    await sut.getOverview({});
    expect(vi.mocked(repo.listFilesWithMetadata)).toHaveBeenCalledWith(undefined);
  });
});
