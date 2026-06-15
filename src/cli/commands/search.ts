/**
 * search.ts
 * The main `search` CLI command.
 * Usage: log-search search <file> <query> [options]
 *        log-search <file> <query> [options]  (shorthand)
 */

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';
import { IndexBuilder } from '../../core/indexer/IndexBuilder';
import { IndexSearcher } from '../../core/searcher/IndexSearcher';
import { IndexStore } from '../../index-store/IndexStore';
import { IncrementalUpdater } from '../../index-store/IncrementalUpdater';
import { OutputFormatter } from '../output/formatter';
import type { LogLevel } from '../../types/SearchTypes';

export function createSearchCommand(): Command {
  return new Command('search')
    .alias('s')
    .description('Search through a log file at blazing speed')
    .argument('<file>', 'Path to the log file')
    .argument('<query>', 'Search query (supports AND, OR, NOT, phrases, regex, fuzzy)')
    .option('-n, --limit <number>', 'Max number of results to show', '100')
    .option('-c, --context <lines>', 'Show N lines of context around each match', '0')
    .option('-r, --regex', 'Treat query as a regex pattern', false)
    .option('-I, --case-sensitive', 'Case-sensitive search (default: insensitive)', false)
    .option('--json', 'Output results as JSON', false)
    .option('--table', 'Output results as a table', false)
    .option('--no-color', 'Disable colored output')
    .option('--rebuild-index', 'Force rebuild the index even if it exists', false)
    .option('--skip-incremental', 'Skip incremental index update check', false)
    .option('--since <datetime>', 'Only include results after this datetime (ISO format)')
    .option('--until <datetime>', 'Only include results before this datetime (ISO format)')
    .option('--level <level>', 'Filter by log level (ERROR, WARN, INFO, DEBUG, etc.)')
    .option('--sort-by <field>', 'Sort by: line (default) or score', 'line')
    .option('--sort-dir <dir>', 'Sort direction: asc (default) or desc', 'asc')
    .option('--offset <number>', 'Skip N results (pagination)', '0')
    .action(async (file: string, query: string, options) => {
      const filePath = path.resolve(file);

      // ── Validate file exists ─────────────────────────────────────────────
      if (!fs.existsSync(filePath)) {
        OutputFormatter.printError(`File not found: ${filePath}`);
        process.exit(1);
      }

      const stat = fs.statSync(filePath);
      if (!stat.isFile()) {
        OutputFormatter.printError(`Not a regular file: ${filePath}`);
        process.exit(1);
      }

      const store = new IndexStore();
      const searcher = new IndexSearcher(filePath);
      let indexPath: string | null = null;

      // ── Build / locate index ─────────────────────────────────────────────
      if (!options.rebuildIndex) {
        indexPath = await store.getIndexPath(filePath);
      }

      if (!indexPath || options.rebuildIndex) {
        indexPath = await buildIndex(filePath, store);
      } else if (!options.skipIncremental) {
        // Check if file has grown since indexing — do incremental update
        await tryIncrementalUpdate(filePath, indexPath);
      }

      // ── Load index ───────────────────────────────────────────────────────
      await searcher.loadIndex(indexPath);

      // ── Print header ─────────────────────────────────────────────────────
      if (!options.json) {
        OutputFormatter.printHeader(query, filePath);
      }

      // ── Execute search ───────────────────────────────────────────────────
      const t0 = performance.now();

      const results = await searcher.search(query, {
        limit: parseInt(options.limit, 10),
        offset: parseInt(options.offset, 10),
        ignoreCase: !options.caseSensitive,
        isRegex: options.regex,
        context: parseInt(options.context, 10),
        since: options.since,
        until: options.until,
        level: options.level as LogLevel | undefined,
        sortBy: options.sortBy as 'line' | 'score',
        sortDir: options.sortDir as 'asc' | 'desc',
      });

      const searchTimeMs = performance.now() - t0;

      // ── Print results ─────────────────────────────────────────────────────
      const fmt = options.json ? 'json' : options.table ? 'table' : 'text';
      const formatter = new OutputFormatter({
        color: options.color !== false,
        format: fmt,
      });

      formatter.print(results, {
        query,
        filePath,
        totalMatches: results.length,
        searchTimeMs,
        indexLoaded: true,
      });

      process.exit(0);
    });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function buildIndex(filePath: string, store: IndexStore): Promise<string> {
  const spinner = ora({
    text: chalk.cyan('Building index... (first time only)'),
    spinner: 'dots',
  }).start();

  try {
    const builder = new IndexBuilder(filePath);
    const result = await builder.build((percent) => {
      spinner.text = chalk.cyan(`Building index... ${percent}%`);
    });

    spinner.succeed(
      chalk.green(
        `Index built in ${(result.buildTimeMs / 1000).toFixed(1)}s` +
        chalk.dim(` — ${result.totalLines.toLocaleString()} lines, `) +
        chalk.dim(`${result.uniqueTerms.toLocaleString()} unique terms, `) +
        chalk.dim(`${(result.fileSize / 1024 / 1024).toFixed(0)}MB file`)
      )
    );

    await store.saveIndexPath(filePath, result.indexPath, {
      totalLines: result.totalLines,
      fileSize: result.fileSize,
    });

    return result.indexPath;
  } catch (err) {
    spinner.fail(chalk.red('Index build failed'));
    throw err;
  }
}

async function tryIncrementalUpdate(filePath: string, indexPath: string): Promise<void> {
  try {
    const updater = new IncrementalUpdater();
    const updated = await updater.update(filePath, indexPath);
    if (updated) {
      OutputFormatter.printInfo(
        `Index updated (+${updated.metadata.totalLines.toLocaleString()} lines)`
      );
    }
  } catch {
    // Incremental update failure is non-fatal
  }
}
