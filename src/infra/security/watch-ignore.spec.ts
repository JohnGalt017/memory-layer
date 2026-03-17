import { describe, it, expect } from "vitest";
import { WatchIgnore } from "./watch-ignore.js";

describe("WatchIgnore", () => {
  it("should block default blacklist files", () => {
    const wi = new WatchIgnore();
    expect(wi.isIgnored(".env")).toBe(true);
    expect(wi.isIgnored(".env.local")).toBe(true);
    expect(wi.isIgnored("secret.pem")).toBe(true);
    expect(wi.isIgnored("credentials.json")).toBe(true);
    expect(wi.isIgnored(".aws/config")).toBe(true);
    expect(wi.isIgnored(".ssh/id_rsa")).toBe(true);
  });

  it("should allow normal files", () => {
    const wi = new WatchIgnore();
    expect(wi.isIgnored("src/index.ts")).toBe(false);
    expect(wi.isIgnored("README.md")).toBe(false);
    expect(wi.isIgnored("package.json")).toBe(false);
  });

  it("should respect custom patterns", () => {
    const wi = new WatchIgnore(["*.log", "tmp/"]);
    expect(wi.isIgnored("server.log")).toBe(true);
    expect(wi.isIgnored("tmp/cache.json")).toBe(true);
    expect(wi.isIgnored("src/index.ts")).toBe(false);
  });

  it("should respect gitignore patterns", () => {
    const wi = new WatchIgnore([], ["node_modules/", "dist/"]);
    expect(wi.isIgnored("node_modules/express/index.js")).toBe(true);
    expect(wi.isIgnored("dist/main.js")).toBe(true);
    expect(wi.isIgnored("src/index.ts")).toBe(false);
  });

  it("should validate path is within project root", () => {
    const wi = new WatchIgnore();
    expect(wi.isPathSafe("src/index.ts", "/project")).toBe(true);
    expect(wi.isPathSafe("../etc/passwd", "/project")).toBe(false);
    expect(wi.isPathSafe("/etc/passwd", "/project")).toBe(false);
    expect(wi.isPathSafe("src/../../etc/passwd", "/project")).toBe(false);
  });
});
