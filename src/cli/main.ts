/**
 * main.ts
 * CLI entry point. Registers all commands and parses argv.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createSearchCommand } from './commands/search';
import { createIndexCommand } from './commands/index';
import { createInfoCommand } from './commands/info';
import { createWatchCommand } from './commands/watch';
import { createClearCommand } from './commands/clear';

const pkg = require('../../package.json');

const program = new Command();

program
  .name('log-search')
  .aliases(['lsearch'])
  .version(pkg.version, '-v, --version', 'Output the current version')
  .description(
    chalk.bold('log-search') +
    ' — Search through 50GB log files in under a second.\n' +
    chalk.dim('  Indexed search engine for DevOps engineers.')
  )
  .usage('<command> [options]');

// ── Commands ──────────────────────────────────────────────────────────────────
program.addCommand(createSearchCommand());
program.addCommand(createIndexCommand());
program.addCommand(createInfoCommand());
program.addCommand(createWatchCommand());
program.addCommand(createClearCommand());

// ── Default action: if first arg looks like a file, run search directly ───────
// Allows: log-search <file> <query> (without the "search" subcommand)
const args = process.argv.slice(2);
const knownCommands = ['search', 'index', 'info', 'watch', 'clear', 's', 'i', 'w', 'c'];
const firstArg = args[0];

if (firstArg && !firstArg.startsWith('-') && !knownCommands.includes(firstArg)) {
  // Looks like a file path — prepend "search" subcommand
  process.argv.splice(2, 0, 'search');
}

// ── Global error handling ─────────────────────────────────────────────────────
program.exitOverride((err) => {
  if (err.code !== 'commander.helpDisplayed' && err.code !== 'commander.version') {
    console.error(chalk.bold.red('Error:'), err.message);
    process.exit(1);
  }
  process.exit(0);
});

// ── Parse ─────────────────────────────────────────────────────────────────────
program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.bold.red('Fatal Error:'), err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
