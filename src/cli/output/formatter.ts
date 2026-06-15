/**
 * formatter.ts
 * Formats and prints search results to stdout.
 * Supports text, JSON, and table output modes.
 */

import chalk from 'chalk';
import { applyHighlights, colors, colorizeLevel } from './colorizer';
import { renderTable } from './table';
import type { SearchResult, SearchStats } from '../../types/SearchTypes';

export type OutputFormat = 'text' | 'json' | 'table';

export interface FormatterOptions {
  color?: boolean;
  format?: OutputFormat;
  maxResults?: number;
}

export class OutputFormatter {
  private useColor: boolean;
  private format: OutputFormat;

  constructor(options: FormatterOptions = {}) {
    this.useColor = options.color ?? true;
    this.format = options.format ?? 'text';

    if (!this.useColor) {
      chalk.level = 0;
    }
  }

  /**
   * Print results and stats to stdout.
   */
  print(results: SearchResult[], stats: SearchStats): void {
    switch (this.format) {
      case 'json':
        this.printJson(results, stats);
        break;
      case 'table':
        this.printTable(results, stats);
        break;
      default:
        this.printText(results, stats);
    }
  }

  // ─── Text Output ─────────────────────────────────────────────────────────

  private printText(results: SearchResult[], stats: SearchStats): void {
    if (results.length === 0) {
      console.log(colors.muted('\n  No results found.\n'));
      this.printStats(stats);
      return;
    }

    console.log('');

    for (const result of results) {
      this.printTextResult(result, stats.query);
    }

    console.log('');
    this.printStats(stats);
  }

  private printTextResult(result: SearchResult, query: string): void {
    // Context lines before
    if (result.contextBefore && result.contextBefore.length > 0) {
      for (let i = 0; i < result.contextBefore.length; i++) {
        const lineNum = result.lineNumber - result.contextBefore.length + i;
        console.log(
          colors.lineNumber(`  ${String(lineNum).padStart(6)} │ `) +
          colors.muted(result.contextBefore[i])
        );
      }
    }

    // Main match line
    const lineStr = String(result.lineNumber).padStart(6);
    const highlighted = applyHighlights(result.content, result.highlights);
    const levelMatch = result.content.match(/\b(ERROR|WARN|INFO|DEBUG|FATAL|CRITICAL)\b/i);
    const levelColor = levelMatch ? colorizeLevel(levelMatch[1]) : null;

    const lineContent = levelColor
      ? result.content.replace(
          levelMatch![1],
          levelColor
        )
      : highlighted;

    console.log(
      chalk.bold.cyan(`  ${lineStr} `) +
      chalk.bold.cyan('│ ') +
      lineContent
    );

    // Context lines after
    if (result.contextAfter && result.contextAfter.length > 0) {
      for (let i = 0; i < result.contextAfter.length; i++) {
        const lineNum = result.lineNumber + i + 1;
        console.log(
          colors.lineNumber(`  ${String(lineNum).padStart(6)} │ `) +
          colors.muted(result.contextAfter[i])
        );
      }
    }

    // Separator between results with context
    if (
      (result.contextBefore && result.contextBefore.length > 0) ||
      (result.contextAfter && result.contextAfter.length > 0)
    ) {
      console.log(colors.separator('  ───────'));
    }
  }

  private printStats(stats: SearchStats): void {
    const timeStr =
      stats.searchTimeMs < 1
        ? `${(stats.searchTimeMs * 1000).toFixed(0)}μs`
        : `${stats.searchTimeMs.toFixed(1)}ms`;

    console.log(
      colors.muted('  ') +
      colors.success(`✓ ${stats.totalMatches.toLocaleString()} match${stats.totalMatches !== 1 ? 'es' : ''}`) +
      colors.muted(` in ${timeStr}`) +
      colors.muted(` — ${stats.filePath}`)
    );
    console.log('');
  }

  // ─── JSON Output ──────────────────────────────────────────────────────────

  private printJson(results: SearchResult[], stats: SearchStats): void {
    const output = {
      query: stats.query,
      filePath: stats.filePath,
      totalMatches: stats.totalMatches,
      searchTimeMs: stats.searchTimeMs,
      results: results.map((r) => ({
        lineNumber: r.lineNumber,
        offset: r.offset,
        content: r.content,
        matchScore: r.matchScore,
        highlights: r.highlights,
        contextBefore: r.contextBefore,
        contextAfter: r.contextAfter,
      })),
    };
    console.log(JSON.stringify(output, null, 2));
  }

  // ─── Table Output ─────────────────────────────────────────────────────────

  private printTable(results: SearchResult[], stats: SearchStats): void {
    const maxWidth = Math.min(process.stdout.columns ?? 120, 120) - 30;
    console.log('');
    console.log(renderTable(results, { maxContentWidth: maxWidth }));
    console.log('');
    this.printStats(stats);
  }

  // ─── Header/Footer ────────────────────────────────────────────────────────

  static printHeader(query: string, filePath: string): void {
    console.log('');
    console.log(
      chalk.bold('  log-search') +
      chalk.dim(' ›› ') +
      chalk.cyan(JSON.stringify(query)) +
      chalk.dim(' in ') +
      chalk.white(filePath)
    );
    console.log(colors.separator('  ' + '─'.repeat(60)));
  }

  static printError(message: string): void {
    console.error(chalk.bold.red('  ✗ ') + message);
  }

  static printWarning(message: string): void {
    console.warn(chalk.bold.yellow('  ⚠ ') + message);
  }

  static printInfo(message: string): void {
    console.log(chalk.bold.cyan('  ℹ ') + message);
  }
}
