# memory-layer

MCP server for persistent AI memory management across projects. Built on top of the [Memory Bank](https://github.com/nickbaumann98/cline_docs/blob/main/prompting/custom%20instructions%20library/cline-memory-bank.md) concept with leveled context to reduce token consumption.

## Why

When working with large memory banks (50+ files), reading everything at full content is expensive. This server adds **L0/L1/L2 context levels** so the AI can quickly scan abstracts before deciding what to read in full.

```
memory_bank_overview   → L0 abstracts for all files (~100 tokens each)
memory_bank_read L1    → frontmatter + first section (~500 tokens)
memory_bank_read L2    → full content (default)
```

## Tools

| Tool | Description |
|------|-------------|
| `memory_bank_overview` | L0 abstracts for all files in a project or all projects. **Call this first.** |
| `memory_bank_query` | Filter files by `type`, `status`, `tags`, `updatedAfter` |
| `memory_bank_read` | Read a file with optional `level` param (L0/L1/L2) |
| `memory_bank_write` | Create a new file |
| `memory_bank_update` | Update an existing file |
| `memory_bank_patch` | Safely replace exact text in an existing file (`oldText` → `newText`, default one match) |
| `memory_bank_upsert` | Create or update (idempotent) |
| `memory_bank_append` | Append content to a file |
| `memory_bank_search` | Full-text search across all files in a project |
| `list_projects` | List all projects |
| `list_project_files` | List files in a project |

## Frontmatter

Files support YAML frontmatter for metadata. Abstract is auto-injected on write if missing.

```markdown
---
type: architecture
status: active
abstract: "One-line description (~100 tokens)"
tags: [rust, polyalgo]
updated: 2026-03-16
---

# File Title

Content starts here...
```

`type`: `architecture` | `progress` | `decisions` | `reference` | `notes`
`status`: `active` | `archived` | `draft`

## Installation

### Claude Code

Add to `~/.claude.json`:

```json
"memory-layer": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "github:JohnGalt017/memory-layer"],
  "env": {
    "MEMORY_BANK_ROOT": "/path/to/your/memory-bank"
  },
  "autoApprove": [
    "memory_bank_read",
    "memory_bank_overview",
    "list_projects",
    "list_project_files"
  ]
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
"memory-layer": {
  "command": "npx",
  "args": ["-y", "github:JohnGalt017/memory-layer"],
  "env": {
    "MEMORY_BANK_ROOT": "/path/to/your/memory-bank"
  }
}
```

### Cline / Roo Code / Cursor

Same config, placed in the corresponding MCP settings file for your client.

### Local build

```bash
git clone https://github.com/JohnGalt017/memory-layer.git
cd memory-layer
npm install
npm run build
```

Then point `command` to `node` and `args` to `dist/main/index.js`.

## Migrate existing files

If you have existing memory bank files without `abstract` frontmatter:

```bash
npx tsx scripts/migrate-abstracts.ts
```

Reads `MEMORY_BANK_ROOT` env var. Skips files that already have `abstract`.

## Development

```bash
npm install       # install deps
npm run build     # compile TypeScript
npm test          # run tests (159 tests)
npm run test:watch
```

## Credits

Forked from [alioshr/memory-bank-mcp](https://github.com/alioshr/memory-bank-mcp) by Aliosh Pimenta. This project adds leveled context (L0/L1/L2), frontmatter support, and new tools built on top of the original foundation.

## License

MIT
