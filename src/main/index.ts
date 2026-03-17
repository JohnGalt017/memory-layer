#!/usr/bin/env node

import app from "./protocols/mcp/app.js";
import { watcherBootstrap } from "./services/watcher-singletons.js";

app.start().then(() => {
  watcherBootstrap.restore().catch(console.error);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
