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
import { makeWatchStartController } from "../../factories/controllers/watch-start/index.js";
import { makeWatchStopController } from "../../factories/controllers/watch-stop/index.js";
import { makeWatchUpdateController } from "../../factories/controllers/watch-update/index.js";
import { makeWatchListController } from "../../factories/controllers/watch-list/index.js";
import { makeProcessInboxController } from "../../factories/controllers/process-inbox/index.js";
import { makeProcessInboxDetailController } from "../../factories/controllers/process-inbox-detail/index.js";
import { makeInboxAckController } from "../../factories/controllers/inbox-ack/index.js";
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

  router.setTool({
    schema: {
      name: "memory_bank_watch_start",
      description:
        "Start watching a project directory for changes. " +
        "Performs an initial scan (git log, file tree, README) and begins polling for new commits and file changes. " +
        "Use memory_bank_process_inbox to retrieve accumulated changes.",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Absolute path to the project directory to watch",
          },
          projectName: {
            type: "string",
            description: "The name of the project (used as key in memory bank)",
          },
          processingModel: {
            type: "string",
            description: "Model to use for processing (e.g. sonnet, opus). Defaults to sonnet.",
          },
          pollInterval: {
            type: "number",
            description: "Polling interval in seconds. Defaults to 30.",
          },
        },
        required: ["path", "projectName"],
      },
    },
    handler: adaptMcpRequestHandler(makeWatchStartController()),
  });

  router.setTool({
    schema: {
      name: "memory_bank_watch_stop",
      description: "Stop watching a project directory. The watcher is removed from the active registry.",
      inputSchema: {
        type: "object",
        properties: {
          projectName: {
            type: "string",
            description: "The name of the project to stop watching",
          },
        },
        required: ["projectName"],
      },
    },
    handler: adaptMcpRequestHandler(makeWatchStopController()),
  });

  router.setTool({
    schema: {
      name: "memory_bank_watch_update",
      description: "Update configuration of an active watcher (processingModel, pollInterval).",
      inputSchema: {
        type: "object",
        properties: {
          projectName: {
            type: "string",
            description: "The name of the project",
          },
          processingModel: {
            type: "string",
            description: "New model to use for processing",
          },
          pollInterval: {
            type: "number",
            description: "New polling interval in seconds",
          },
        },
        required: ["projectName"],
      },
    },
    handler: adaptMcpRequestHandler(makeWatchUpdateController()),
  });

  router.setTool({
    schema: {
      name: "memory_bank_watch_list",
      description:
        "List all active and configured watchers with their status, pending change counts, and uptime.",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    handler: adaptMcpRequestHandler(makeWatchListController()),
  });

  router.setTool({
    schema: {
      name: "memory_bank_process_inbox",
      description:
        "Retrieve the accumulated change index for a watched project. " +
        "Returns processingModel, gitAvailable flag, and a PendingChangesIndex with commits, hotFiles, filesCreated, filesDeleted. " +
        "Call memory_bank_inbox_ack after processing to clear the inbox.",
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
    handler: adaptMcpRequestHandler(makeProcessInboxController()),
  });

  router.setTool({
    schema: {
      name: "memory_bank_process_inbox_detail",
      description:
        "Fetch detailed content for specific commits or files from a watched project. " +
        "Use after memory_bank_process_inbox to load diffs or file contents for items that need deeper analysis.",
      inputSchema: {
        type: "object",
        properties: {
          projectName: {
            type: "string",
            description: "The name of the project",
          },
          commits: {
            type: "array",
            items: { type: "string" },
            description: "List of commit hashes to fetch details for",
          },
          files: {
            type: "array",
            items: { type: "string" },
            description: "List of file paths (relative to project root) to fetch content for",
          },
        },
        required: ["projectName"],
      },
    },
    handler: adaptMcpRequestHandler(makeProcessInboxDetailController()),
  });

  router.setTool({
    schema: {
      name: "memory_bank_inbox_ack",
      description:
        "Acknowledge and clear the pending changes inbox for a project. " +
        "Call this after successfully processing the inbox to reset the change accumulator.",
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
    handler: adaptMcpRequestHandler(makeInboxAckController()),
  });

  return router;
};
