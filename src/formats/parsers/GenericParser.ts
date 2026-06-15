/**
 * GenericParser.ts
 * Fallback parser for unrecognized log formats.
 * Attempts to extract timestamps and log levels heuristically.
 */

import type { GenericLogEntry } from '../schemas/LogSchema';

// Common log level patterns
const LEVEL_RE = /\b(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|ERR|FATAL|CRITICAL|SEVERE)\b/i;
// Common timestamp patterns
const TS_PATTERNS = [
  /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/,
  /\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2}/,
  /\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}/,
];

export class GenericParser {
  parse(line: string, lineNumber?: number, byteOffset?: number): GenericLogEntry {
    // Try to extract timestamp
    let timestamp: Date | undefined;
    for (const re of TS_PATTERNS) {
      const match = line.match(re);
      if (match) {
        const d = new Date(match[0]);
        if (!isNaN(d.getTime())) {
          timestamp = d;
          break;
        }
      }
    }

    // Try to extract level
    let level: string | undefined;
    const levelMatch = line.match(LEVEL_RE);
    if (levelMatch) {
      level = levelMatch[1].toUpperCase();
      if (level === 'WARNING') level = 'WARN';
      if (level === 'ERR') level = 'ERROR';
      if (level === 'SEVERE') level = 'ERROR';
    }

    // Split into whitespace-delimited fields
    const fields = line.split(/\s+/).filter(Boolean);

    return {
      raw: line,
      lineNumber,
      byteOffset,
      format: 'generic',
      timestamp,
      level,
      message: line,
      fields,
    };
  }

  static test(_line: string): boolean {
    return true; // Always matches
  }
}
