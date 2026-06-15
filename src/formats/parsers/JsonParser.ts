/**
 * JsonParser.ts
 * Parses JSON-structured log lines (e.g., Bunyan, Pino, Winston JSON format).
 * Extracts common fields: timestamp, level, message, and all other fields.
 */

import type { JsonLogEntry } from '../schemas/LogSchema';

// Common timestamp field names
const TS_FIELDS = ['timestamp', 'time', '@timestamp', 'ts', 'date', 'datetime'];
// Common level field names
const LEVEL_FIELDS = ['level', 'severity', 'log.level', 'logLevel'];
// Common message field names
const MSG_FIELDS = ['message', 'msg', 'text', 'body', 'content'];

export class JsonParser {
  parse(line: string, lineNumber?: number, byteOffset?: number): JsonLogEntry | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) return null;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return null;
    }

    // Extract timestamp
    let timestamp: Date | undefined;
    for (const field of TS_FIELDS) {
      const val = parsed[field];
      if (val) {
        const d = new Date(val as string);
        if (!isNaN(d.getTime())) {
          timestamp = d;
          break;
        }
      }
    }

    // Extract level
    let level: string | undefined;
    for (const field of LEVEL_FIELDS) {
      const val = parsed[field];
      if (typeof val === 'string') {
        level = val.toUpperCase();
        break;
      } else if (typeof val === 'number') {
        // Bunyan level numbers
        level = this.bunyanLevelToString(val);
        break;
      }
    }

    // Extract message
    let message: string | undefined;
    for (const field of MSG_FIELDS) {
      const val = parsed[field];
      if (typeof val === 'string') {
        message = val;
        break;
      }
    }

    return {
      raw: line,
      lineNumber,
      byteOffset,
      format: 'json',
      timestamp,
      level,
      message,
      ...parsed,
    } as JsonLogEntry;
  }

  private bunyanLevelToString(level: number): string {
    if (level <= 10) return 'TRACE';
    if (level <= 20) return 'DEBUG';
    if (level <= 30) return 'INFO';
    if (level <= 40) return 'WARN';
    if (level <= 50) return 'ERROR';
    return 'FATAL';
  }

  static test(line: string): boolean {
    const t = line.trim();
    return t.startsWith('{') && t.endsWith('}');
  }
}
