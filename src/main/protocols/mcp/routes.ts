import {
  makeListProjectFilesController,
  makeListProjectsController,
  makeReadController,
  makeUpdateController,
  makeWriteController,
} from "../../factories/controllers/index.js";
import { makeUpsertController } from "../../factories/controllers/upsert/index.js";
import { makeAppendController } from "../../factories/controllers/append/index.js";
import { makeSearchController } from "../../factories/controllers/search/index.js";
import { makeOverviewController } from "../../factories/controllers/overview/index.js";
import { makeQueryController } from "../../factories/controllers/query/index.js";
import { adaptMcpRequestHandler } from "./adapters/mcp-request-adapter.js";
import { McpRouterAdapter } from "./adapters/mcp-router-adapter.js";

export default () => {
  const router = new McpRouterAdapter();

  router.setTool({
    schema: {
      name: "list_projects",
      description: "List all projects in the memory bank",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    handler: adaptMcpRequestHandler(makeListProjectsController()),
  });

  router.setTool({
    schema: {
      name: "list_project_files",
      description: "List all files within a specific project",
      inputSchema: {
        type: "object",
        properties: {
          projectName: {
            type: "string",
            description: "The name of the project",
          },
        },
        required: ["projectName"],
      },
    },
    handler: adaptMcpRequestHandler(makeListProjectFilesController()),
  });

  router.setTool({
    schema: {
      name: "memory_bank_read",
      description:
        "Read a memory bank file. Call memory_bank_overview first to identify what to read. " +
        "Prefer level=L1 (~500 tokens) over L2 unless full content is required. " +
        "Use L0 for a single-line abstract, L1 for frontmatter + first section, L2 for full file (default).",
      inputSchema: {
        type: "object",
        properties: {
          projectName: {
            type: "string",
            description: "The name of the project",
          },
          fileName: {
            type: "string",
            description: "The name of the file",
          },
          level: {
            type: "string",
            enum: ["L0", "L1", "L2"],
            description: "Context level: L0=abstract only (~100 tokens), L1=overview (~500 tokens), L2=full content (default)",
          },
        },
        required: ["projectName", "fileName"],
      },
    },
    handler: adaptMcpRequestHandler(makeReadController()),
  });

  router.setTool({
    schema: {
      name: "memory_bank_write",
      description: "Create a new memory bank file for a specific project",
      inputSchema: {
        type: "object",
        properties: {
          projectName: {
            type: "string",
            description: "The name of the project",
          },
          fileName: {
            type: "string",
            description: "The name of the file",
          },
          content: {
            type: "string",
            description: "The content of the file",
          },
        },
        required: ["projectName", "fileName", "content"],
      },
    },
    handler: adaptMcpRequestHandler(makeWriteController()),
  });

  router.setTool({
    schema: {
      name: "memory_bank_update",
      description: "Update an existing memory bank file for a specific project",
      inputSchema: {
        type: "object",
        properties: {
          projectName: {
            type: "string",
            description: "The name of the project",
          },
          fileName: {
            type: "string",
            description: "The name of the file",
          },
          content: {
            type: "string",
            description: "The content of the file",
          },
        },
        required: ["projectName", "fileName", "content"],
      },
    },
    handler: adaptMcpRequestHandler(makeUpdateController()),
  });

  router.setTool({
    schema: {
      name: "memory_bank_upsert",
      description: "Write a new file or update it if it already exists for a specific project",
      inputSchema: {
        type: "object",
        properties: {
          projectName: { type: "string", description: "The name of the project" },
          fileName: { type: "string", description: "The name of the file" },
          content: { type: "string", description: "The content of the file" },
        },
        required: ["projectName", "fileName", "content"],
      },
    },
    handler: adaptMcpRequestHandler(makeUpsertController()),
  });

  router.setTool({
    schema: {
      name: "memory_bank_append",
      description: "Append content to the end of an existing file for a specific project (creates it if it doesn't exist)",
      inputSchema: {
        type: "object",
        properties: {
          projectName: { type: "string", description: "The name of the project" },
          fileName: { type: "string", description: "The name of the file" },
          content: { type: "string", description: "Content to append" },
        },
        required: ["projectName", "fileName", "content"],
      },
    },
    handler: adaptMcpRequestHandler(makeAppendController()),
  });

  router.setTool({
    schema: {
      name: "memory_bank_search",
      description: "Search for text across all files in a project. Returns file names and matching lines.",
      inputSchema: {
        type: "object",
        properties: {
          projectName: { type: "string", description: "The name of the project" },
          query: { type: "string", description: "The text to search for (case-insensitive)" },
        },
        required: ["projectName", "query"],
      },
    },
    handler: adaptMcpRequestHandler(makeSearchController()),
  });

  router.setTool({
    schema: {
      name: "memory_bank_overview",
      description:
        "ALWAYS call this first before reading any memory bank files. " +
        "Returns L0 abstracts (~100 tokens per file) for all files in a project or all projects. " +
        "Use this to understand what exists and decide what to load — never read files blindly. " +
        "Returns JSON array with project, fileName, abstract, type, status, tags, updated.",
      inputSchema: {
        type: "object",
        properties: {
          projectName: {
            type: "string",
            description: "Project name. If omitted, returns overview of all projects.",
          },
        },
        required: [],
      },
    },
    handler: adaptMcpRequestHandler(makeOverviewController()),
  });

  router.setTool({
    schema: {
      name: "memory_bank_query",
      description:
        "Filter memory bank files by metadata (type, status, tags, updatedAfter). " +
        "Use instead of memory_bank_overview when you need targeted results. " +
        "Returns L0 abstracts only — no full content loaded.",
      inputSchema: {
        type: "object",
        properties: {
          projectName: { type: "string" },
          type: { type: "string", description: "Filter by type: architecture, progress, decisions, reference, notes" },
          status: { type: "string", description: "Filter by status: active, archived, draft" },
          tags: { type: "array", items: { type: "string" }, description: "All specified tags must be present" },
          updatedAfter: { type: "string", description: "ISO date string, e.g. 2026-01-01" },
          maxResults: { type: "number", description: "Max results to return (default: 50)" },
        },
        required: [],
      },
    },
    handler: adaptMcpRequestHandler(makeQueryController()),
  });

  return router;
};
