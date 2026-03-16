#!/usr/bin/env tsx
import fs from "fs-extra";
import path from "path";
import matter from "gray-matter";

const MEMORY_BANK_PATH = process.env.MEMORY_BANK_ROOT ?? process.env.MEMORY_BANK_PATH ?? `${process.env.HOME}/.memory-bank`;

async function main() {
  const entries = await fs.readdir(MEMORY_BANK_PATH, { withFileTypes: true });
  const projects = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  let migrated = 0;
  let skipped = 0;

  for (const project of projects) {
    const projectPath = path.join(MEMORY_BANK_PATH, project);
    const files = (await fs.readdir(projectPath, { withFileTypes: true }))
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => e.name);

    for (const fileName of files) {
      const filePath = path.join(projectPath, fileName);
      const content = await fs.readFile(filePath, "utf-8");
      const { data, content: body } = matter(content);

      if (data.abstract) {
        skipped++;
        continue;
      }

      // Extract abstract from first non-empty, non-heading line
      let abstract = "";
      const lines = body.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          abstract = trimmed.slice(0, 200);
          break;
        }
      }
      if (!abstract) {
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("# ")) {
            abstract = trimmed.replace(/^#\s+/, "").slice(0, 200);
            break;
          }
        }
      }

      if (!abstract) {
        skipped++;
        continue;
      }

      const now = new Date().toISOString().split("T")[0];
      const updated = matter.stringify(body, { ...data, abstract, updated: now });
      await fs.writeFile(filePath, updated, "utf-8");
      console.log(`  ✓ ${project}/${fileName}: "${abstract.slice(0, 60)}..."`);
      migrated++;
    }
  }

  console.log(`\nMigrated: ${migrated}, Skipped: ${skipped}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
