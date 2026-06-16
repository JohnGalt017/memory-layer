import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

let routes: typeof import("./routes.js").default;

describe("MCP routes", () => {
  beforeAll(async () => {
    process.env.MEMORY_BANK_ROOT = fs.mkdtempSync(
      path.join(os.tmpdir(), "memory-bank-routes-test-")
    );
    routes = (await import("./routes.js")).default;
  });

  it("should expose memory_bank_patch tool schema and handler", async () => {
    const router = routes();
    const patchSchema = router
      .getToolsSchemas()
      .find((schema) => schema?.name === "memory_bank_patch");

    expect(patchSchema).toMatchObject({
      name: "memory_bank_patch",
      inputSchema: {
        required: ["projectName", "fileName", "oldText", "newText"],
      },
    });
    const handler = await router.getToolHandler("memory_bank_patch");
    expect(handler).toBeTypeOf("function");
  });
});
