/**
 * clear.ts
 * Delete index files for one or all files.
 * Usage: log-search clear <file>   — clear index for a specific file
 *        log-search clear --all    — clear ALL indexes
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import { IndexStore } from '../../index-store/IndexStore';
import { OutputFormatter } from '../output/formatter';

export function createClearCommand(): Command {
  return new Command('clear')
    .alias('c')
    .description('Delete cached index files')
    .argument('[file]', 'Path to the log file (optional — omit with --all)')
    .option('--all', 'Clear ALL cached indexes', false)
    .option('-y, --yes', 'Skip confirmation prompt', false)
    .action(async (file: string | undefined, options) => {
      const store = new IndexStore();

      if (options.all) {
        const entries = await store.listAll();
        if (entries.length === 0) {
          OutputFormatter.printInfo('No indexes found to clear.');
          return;
        }

        console.log(chalk.bold(`\n  About to delete ${entries.length} index(es):`));
        for (const e of entries) {
          console.log(chalk.dim(`    • ${e.indexPath}`));
        }
        console.log('');

        if (!options.yes) {
          const { default: inquirer } = await import('inquirer');
          const { confirm } = await inquirer.prompt([
            { type: 'confirm', name: 'confirm', message: 'Delete all indexes?', default: false },
          ]);
          if (!confirm) {
            OutputFormatter.printInfo('Aborted.');
            return;
          }
        }

        let deleted = 0;
        for (const e of entries) {
          try {
            fs.unlinkSync(e.indexPath);
            deleted++;
          } catch {
            // Ignore if already gone
          }
          await store.removeEntry(e.filePath);
        }

        OutputFormatter.printInfo(`Deleted ${deleted} index file(s).`);
        return;
      }

      // Single file
      if (!file) {
        OutputFormatter.printError('Please specify a file or use --all.');
        process.exit(1);
      }

      const indexPath = await store.getIndexPath(file);
      if (!indexPath) {
        OutputFormatter.printWarning(`No index found for: ${file}`);
        return;
      }

      try {
        fs.unlinkSync(indexPath);
        await store.removeEntry(file);
        OutputFormatter.printInfo(`Index cleared: ${indexPath}`);
      } catch (err) {
        OutputFormatter.printError(`Failed to delete index: ${err}`);
        process.exit(1);
      }
    });
}
