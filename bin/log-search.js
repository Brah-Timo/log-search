#!/usr/bin/env node

/**
 * log-search — Entry Point
 * Checks Node.js version first, then launches the CLI.
 * Supports both `log-search` and `lsearch` aliases.
 */

'use strict';

// ─── Node.js Version Check ────────────────────────────────────────────────────
const [major] = process.versions.node.split('.').map(Number);

if (major < 18) {
  console.error(
    '\x1b[31m[log-search] Error:\x1b[0m Node.js 18+ is required.\n' +
      `Current version: v${process.versions.node}\n` +
      'Please upgrade: https://nodejs.org'
  );
  process.exit(1);
}

// ─── Source Map Support (for TypeScript stack traces) ─────────────────────────
try {
  require('source-map-support/register');
} catch (_) {
  // Source map support is optional — silently ignore if not installed
}

// ─── Global Error Handlers ────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('\x1b[31m[log-search] Uncaught Exception:\x1b[0m', err.message);
  if (process.env.DEBUG) {
    console.error(err.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('\x1b[31m[log-search] Unhandled Rejection:\x1b[0m', reason);
  process.exit(1);
});

// ─── Launch CLI ───────────────────────────────────────────────────────────────
require('../dist/cli/main');
