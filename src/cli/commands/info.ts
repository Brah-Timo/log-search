/**
 * info.ts
 * Display detailed info about a file's index.
 * Usage: log-search info <file>
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import { IndexStore } from '../../index-store/IndexStore';
import { OutputFormatter } from '../output/formatter';

export function createInfoCommand(): Command {
  return new Command('info')
    .description('Show index information for a log file')
    .argument('<file>', 'Path to the log file')
    .option('--json', 'Output info as JSON', false)
    .action(async (file: string, options) => {
      const filePath = path.resolve(file);
      const store = new IndexStore();

      const info = await store.getIndexInfo(filePath);

      if (!info) {
        OutputFormatter.printWarning(`No index found for: ${filePath}`);
        OutputFormatter.printInfo(`Run: log-search index "${filePath}" to build one.`);
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(info, null, 2));
        return;
      }

      const compressionPct = (info.compressionRatio * 100).toFixed(0);

      console.log('');
      console.log(chalk.bold('  📊 Index Information'));
      console.log(chalk.dim('  ' + '─'.repeat(50)));
      console.log(`  ${chalk.bold('File:')}          ${info.filePath}`);
      console.log(`  ${chalk.bold('Index:')}         ${info.indexPath}`);
      console.log(`  ${chalk.bold('File size:')}     ${formatBytes(info.fileSize)}`);
      console.log(`  ${chalk.bold('Index size:')}    ${formatBytes(info.indexSize)}`);
      console.log(`  ${chalk.bold('Total lines:')}   ${info.totalLines.toLocaleString()}`);
      console.log(`  ${chalk.bold('Unique terms:')}  ${info.uniqueTerms.toLocaleString()}`);
      console.log(`  ${chalk.bold('Built at:')}      ${new Date(info.builtAt).toLocaleString()}`);
      console.log(`  ${chalk.bold('Compression:')}   ${compressionPct}% smaller than original`);
      console.log(
        `  ${chalk.bold('Status:')}        ` +
        (info.isStale
          ? chalk.yellow('⚠ Stale — file has changed since indexing')
          : chalk.green('✓ Up to date'))
      );
      console.log('');
    });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
