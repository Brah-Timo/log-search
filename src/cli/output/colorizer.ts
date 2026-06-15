/**
 * colorizer.ts
 * Terminal color utilities using chalk.
 * Respects --no-color flag and CI environments.
 */

import chalk from 'chalk';

export const colors = {
  // Log levels
  error: chalk.bold.red,
  warn: chalk.bold.yellow,
  info: chalk.bold.cyan,
  debug: chalk.bold.gray,
  fatal: chalk.bold.bgRed.white,

  // UI elements
  highlight: chalk.bold.bgYellow.black,
  lineNumber: chalk.dim.gray,
  offset: chalk.dim.cyan,
  separator: chalk.dim.gray,
  filename: chalk.bold.white,
  score: chalk.dim.magenta,

  // Messages
  success: chalk.bold.green,
  failure: chalk.bold.red,
  warning: chalk.bold.yellow,
  muted: chalk.dim.gray,

  // Headers
  header: chalk.bold.white,
  subheader: chalk.dim.white,
};

/**
 * Colorize a log level string.
 */
export function colorizeLevel(level: string): string {
  const upper = level.toUpperCase();
  switch (upper) {
    case 'ERROR':
    case 'ERR':
    case 'FATAL':
    case 'CRITICAL':
      return colors.error(upper);
    case 'WARN':
    case 'WARNING':
      return colors.warn(upper);
    case 'INFO':
      return colors.info(upper);
    case 'DEBUG':
    case 'TRACE':
      return colors.debug(upper);
    default:
      return level;
  }
}

/**
 * Apply highlight color to specific character ranges in a string.
 * @param text      The original string
 * @param ranges    Array of [start, end] pairs to highlight
 */
export function applyHighlights(text: string, ranges: Array<[number, number]>): string {
  if (ranges.length === 0) return text;

  let result = '';
  let lastIdx = 0;

  // Merge overlapping ranges
  const merged = mergeRanges(ranges);

  for (const [start, end] of merged) {
    if (start > lastIdx) {
      result += text.slice(lastIdx, start);
    }
    result += colors.highlight(text.slice(start, end));
    lastIdx = end;
  }

  if (lastIdx < text.length) {
    result += text.slice(lastIdx);
  }

  return result;
}

function mergeRanges(ranges: Array<[number, number]>): Array<[number, number]> {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i][0] <= last[1]) {
      last[1] = Math.max(last[1], sorted[i][1]);
    } else {
      merged.push(sorted[i]);
    }
  }

  return merged;
}
