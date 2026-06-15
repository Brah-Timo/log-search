/**
 * watch.ts
 * Watch a log file for new content and search/alert in real-time.
 * Usage: log-search watch <file> [query] [options]
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';
import { FileWatcher } from '../../index-store/FileWatcher';
import { IncrementalUpdater } from '../../index-store/IncrementalUpdater';
import { IndexStore } from '../../index-store/IndexStore';
import { IndexSearcher } from '../../core/searcher/IndexSearcher';
import { OutputFormatter } from '../output/formatter';
import { FileStreamer } from '../../core/streaming/FileStreamer';

export function createWatchCommand(): Command {
  return new Command('watch')
    .alias('w')
    .description('Watch a log file for new content and alert in real-time')
    .argument('<file>', 'Path to the log file to watch')
    .argument('[query]', 'Optional filter query — only show matching new lines')
    .option('-t, --tail <lines>', 'Show last N lines on startup', '20')
    .option('--alert <pattern>', 'Alert pattern — print a banner when matched')
    .option('--no-color', 'Disable colored output')
    .option('--timestamps', 'Show timestamps for new lines', false)
    .action(async (file: string, query: string | undefined, options) => {
      const filePath = path.resolve(file);

      if (!fs.existsSync(filePath)) {
        OutputFormatter.printError(`File not found: ${filePath}`);
        process.exit(1);
      }

      // Show last N lines on startup
      const tailCount = parseInt(options.tail, 10);
      if (tailCount > 0) {
        const lines = await FileStreamer.tail(filePath, tailCount);
        console.log(chalk.dim(`\n  ── Last ${tailCount} lines ──`));
        lines.forEach((line) => console.log(chalk.dim('  ') + line));
        console.log(chalk.dim('  ── Watching for new content... (Ctrl+C to stop) ──\n'));
      }

      const watcher = new FileWatcher();
      watcher.watch(filePath);

      watcher.on('change', async (event) => {
        // Read new bytes
        const { filePath: changedPath, previousSize, currentSize } = event;
        const buffer = await readNewBytes(changedPath, previousSize, currentSize);
        const newLines = buffer.split('\n').filter(Boolean);

        for (const line of newLines) {
          if (query) {
            const lower = line.toLowerCase();
            const q = query.toLowerCase();
            if (!lower.includes(q)) continue;
          }

          const ts = options.timestamps
            ? chalk.dim(new Date().toISOString() + ' ')
            : '';

          const levelMatch = line.match(/\b(ERROR|WARN|WARNING|INFO|DEBUG|FATAL|CRITICAL)\b/i);
          if (levelMatch) {
            const level = levelMatch[1].toUpperCase();
            if (level === 'ERROR' || level === 'FATAL' || level === 'CRITICAL') {
              console.log(ts + chalk.bold.red('  [ERROR] ') + line);
            } else if (level === 'WARN' || level === 'WARNING') {
              console.log(ts + chalk.bold.yellow('  [WARN]  ') + line);
            } else {
              console.log(ts + chalk.dim('  [INFO]  ') + line);
            }
          } else {
            console.log(ts + '  ' + line);
          }

          // Alert banner
          if (options.alert) {
            const alertRe = new RegExp(options.alert, 'i');
            if (alertRe.test(line)) {
              console.log('');
              console.log(chalk.bold.bgRed.white('  ⚠  ALERT TRIGGERED  ⚠  '));
              console.log(chalk.bold.red(`  Pattern: ${options.alert}`));
              console.log(chalk.bold.red(`  Line: ${line.slice(0, 200)}`));
              console.log('');
            }
          }
        }
      });

      watcher.on('error', (err) => {
        OutputFormatter.printError(`Watcher error: ${err.message}`);
      });

      process.on('SIGINT', async () => {
        console.log(chalk.dim('\n  Stopped watching.'));
        await watcher.stop();
        process.exit(0);
      });
    });
}

function readNewBytes(filePath: string, start: number, end: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = fs.createReadStream(filePath, { start, end: end - 1 });
    stream.on('data', (c: any) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });
}
