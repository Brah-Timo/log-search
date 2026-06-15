/**
 * table.ts
 * Renders search results as a formatted CLI table using cli-table3.
 */

import Table from 'cli-table3';
import chalk from 'chalk';
import type { SearchResult } from '../../types/SearchTypes';

export interface TableOptions {
  maxContentWidth?: number;
  showScore?: boolean;
  showOffset?: boolean;
}

export function renderTable(results: SearchResult[], options: TableOptions = {}): string {
  const maxWidth = options.maxContentWidth ?? 80;
  const showScore = options.showScore ?? false;
  const showOffset = options.showOffset ?? false;

  const head: string[] = [chalk.bold('#'), chalk.bold('Line'), chalk.bold('Content')];
  if (showOffset) head.push(chalk.bold('Offset'));
  if (showScore) head.push(chalk.bold('Score'));

  const table = new Table({
    head,
    style: {
      head: [],
      border: ['dim'],
    },
    colWidths: showScore ? [5, 8, maxWidth, 12, 8] : [5, 8, maxWidth + (showOffset ? 0 : 12)],
    wordWrap: true,
  });

  results.forEach((result, i) => {
    const truncated =
      result.content.length > maxWidth
        ? result.content.slice(0, maxWidth - 3) + '...'
        : result.content;

    const row: (string | number)[] = [
      i + 1,
      chalk.dim(String(result.lineNumber)),
      truncated,
    ];

    if (showOffset) row.push(chalk.dim(String(result.offset)));
    if (showScore) row.push(result.matchScore.toFixed(2));

    table.push(row);
  });

  return table.toString();
}
