/**
 * progress.ts
 * CLI progress bar utility.
 */

import cliProgress from 'cli-progress';
import chalk from 'chalk';

export function createProgressBar(label: string): cliProgress.SingleBar {
  return new cliProgress.SingleBar(
    {
      format: `  ${chalk.cyan(label)} ${chalk.cyan('{bar}')} {percentage}% | {value}/{total}`,
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true,
      clearOnComplete: false,
    },
    cliProgress.Presets.shades_classic
  );
}
