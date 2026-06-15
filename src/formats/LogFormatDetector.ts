/**
 * LogFormatDetector.ts
 * Automatically detects the format of a log file by sampling the first N lines.
 * Scores each format based on pattern matching frequency.
 */

import { createReadStream } from 'fs';
import type { LogFormat } from '../types/ConfigTypes';
import { NginxParser } from './parsers/NginxParser';
import { ApacheParser } from './parsers/ApacheParser';
import { JsonParser } from './parsers/JsonParser';
import { SyslogParser } from './parsers/SyslogParser';

interface FormatScore {
  format: LogFormat;
  score: number;
}

// Ordered list of format testers (most specific first)
const FORMAT_TESTERS: Array<{ format: LogFormat; test: (line: string) => boolean }> = [
  { format: 'json', test: JsonParser.test },
  { format: 'nginx', test: NginxParser.test },
  { format: 'apache', test: ApacheParser.test },
  { format: 'kubernetes', test: (line) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s+\w+/.test(line) },
  { format: 'docker', test: (line) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z/.test(line) },
  { format: 'syslog', test: SyslogParser.test },
];

export class LogFormatDetector {
  private sampleSize: number;

  constructor(sampleSize: number = 200) {
    this.sampleSize = sampleSize;
  }

  /**
   * Detect the format of a log file.
   * @param filePath  Path to the log file
   * @returns         Detected LogFormat string
   */
  async detect(filePath: string): Promise<LogFormat> {
    const sample = await this.readSampleLines(filePath);
    if (sample.length === 0) return 'generic';

    const scores: Record<string, number> = {};
    for (const { format } of FORMAT_TESTERS) scores[format] = 0;

    for (const line of sample) {
      if (!line.trim()) continue;
      for (const { format, test } of FORMAT_TESTERS) {
        if (test(line)) scores[format]++;
      }
    }

    // Find the format with the highest score
    const total = sample.filter((l) => l.trim().length > 0).length;
    const threshold = total * 0.3; // 30% of lines must match

    let best: FormatScore = { format: 'generic', score: 0 };
    for (const { format } of FORMAT_TESTERS) {
      if (scores[format] > best.score && scores[format] >= threshold) {
        best = { format, score: scores[format] };
      }
    }

    return best.format;
  }

  /**
   * Detect format from a string sample (for testing / streaming use).
   */
  detectFromLines(lines: string[]): LogFormat {
    const scores: Record<string, number> = {};
    for (const { format } of FORMAT_TESTERS) scores[format] = 0;

    for (const line of lines) {
      if (!line.trim()) continue;
      for (const { format, test } of FORMAT_TESTERS) {
        if (test(line)) scores[format]++;
      }
    }

    const total = lines.filter((l) => l.trim().length > 0).length;
    const threshold = Math.max(1, total * 0.25);

    for (const { format } of FORMAT_TESTERS) {
      if (scores[format] >= threshold) return format;
    }

    return 'generic';
  }

  private readSampleLines(filePath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const lines: string[] = [];
      let buffer = '';
      let done = false;

      const stream = createReadStream(filePath, {
        encoding: 'utf8',
        highWaterMark: 64 * 1024,
      });

      stream.on('data', (chunk: any) => {
        if (done) return;
        buffer += chunk;
        const parts = buffer.split('\n');
        buffer = parts.pop() ?? '';
        for (const line of parts) {
          lines.push(line);
          if (lines.length >= this.sampleSize) {
            done = true;
            stream.destroy();
            resolve(lines);
            break;
          }
        }
      });

      stream.on('end', () => {
        if (!done) {
          if (buffer.length > 0) lines.push(buffer);
          resolve(lines);
        }
      });

      stream.on('error', reject);
      stream.on('close', () => {
        if (!done) resolve(lines);
      });
    });
  }
}
