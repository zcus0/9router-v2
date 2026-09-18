#!/usr/bin/env node

// Postinstall: warm-up SQLite deps into ~/.9router-v2/runtime so the first
// `9router-v2` start doesn't need network. Failure here is non-fatal —
// cli.js will retry at runtime if anything is missing.
const { ensureSqliteRuntime } = require("./sqliteRuntime");
const { ensureTrayRuntime } = require("./trayRuntime");

try {
  ensureSqliteRuntime({ silent: false });
  console.log("[9router-v2] runtime SQLite deps ready");
} catch (e) {
  console.warn(`[9router-v2] runtime warm-up skipped: ${e.message}`);
}

try {
  ensureTrayRuntime({ silent: false });
} catch (e) {
  console.warn(`[9router-v2] tray runtime skipped: ${e.message}`);
}

process.exit(0);
