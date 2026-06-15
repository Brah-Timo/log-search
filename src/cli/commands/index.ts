/**
 * index.ts (CLI command)
 * Manually build the index for a file without searching.
 * Usage: log-search index <file> [options]
 */

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';
import { IndexBuilder } from '../../core/indexer/IndexBuilder';
import { IndexStore } from '../../index-store/IndexStore';
import { LogFormatDetector } from '../../formats/LogFormatDetector';
import { OutputFormatter } from '../output/formatter';

export function createIndexCommand(): Command {
  return new Command('index')
    .alias('i')
    .description('Build (or rebuild) the search index for a log file')
    .argument('<file>', 'Path to the log file to index')
    .option('--force', 'Force rebuild even if index exists', false)
    .option('--chunk-size <mb>', 'Chunk size in MB for parallel processing', '64')
    .option('--workers <n>', 'Number of parallel worker threads')
    .action(async (file: string, options) => {
      const filePath = path.resolve(file);

      if (!fs.existsSync(filePath)) {
        OutputFormatter.printError(`File not found: ${filePath}`);
        process.exit(1);
      }

      const store = new IndexStore();
      const existingIndex = await store.getIndexPath(filePath);

      if (existingIndex && !options.force) {
        OutputFormatter.printWarning(
          `Index already exists for this file. Use --force to rebuild.`
        );
        OutputFormatter.printInfo(`Index path: ${existingIndex}`);
        process.exit(0);
      }

      // Detect format
      const detector = new LogFormatDetector();
      const format = await detector.detect(filePath);
      OutputFormatter.printInfo(`Detected format: ${chalk.bold(format)}`);

      // Build index
      const chunkSizeMb = parseInt(options.chunkSize, 10);
      const maxWorkers = options.workers ? parseInt(options.workers, 10) : undefined;

      const spinner = ora({
        text: chalk.cyan('Indexing...'),
        spinner: 'dots',
      }).start();

      const t0 = Date.now();

      try {
        const builder = new IndexBuilder(filePath, {
          chunkSize: chunkSizeMb * 1024 * 1024,
          maxWorkers,
        });

        const result = await builder.build((percent) => {
          spinner.text = chalk.cyan(`Indexing... ${percent}%`);
        });

        await store.saveIndexPath(filePath, result.indexPath, {
          totalLines: result.totalLines,
          fileSize: result.fileSize,
        });

        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        spinner.succeed(chalk.green(`Index built successfully in ${elapsed}s`));

        console.log('');
        console.log(chalk.bold('  Index Stats:'));
        console.log(chalk.dim(`    File:          ${filePath}`));
        console.log(chalk.dim(`    Index:         ${result.indexPath}`));
        console.log(chalk.dim(`    File size:     ${(result.fileSize / 1024 / 1024).toFixed(1)} MB`));
        console.log(chalk.dim(`    Total lines:   ${result.totalLines.toLocaleString()}`));
        console.log(chalk.dim(`    Unique terms:  ${result.uniqueTerms.toLocaleString()}`));
        console.log(chalk.dim(`    Compression:   ${(result.compressionRatio * 100).toFixed(0)}%`));
        console.log('');
      } catch (err) {
        spinner.fail(chalk.red('Indexing failed'));
        console.error(err);
        process.exit(1);
      }
    });
}
