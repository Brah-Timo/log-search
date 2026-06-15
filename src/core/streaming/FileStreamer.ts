/**
 * FileStreamer.ts
 * Streams a large log file line by line with backpressure support.
 * Used for regex fallback searches and format detection.
 */

import { createReadStream } from 'fs';
import { EventEmitter } from 'events';

export interface StreamOptions {
  start?: number;
  end?: number;
  encoding?: BufferEncoding;
  highWaterMark?: number;
}

export class FileStreamer extends EventEmitter {
  private filePath: string;
  private aborted: boolean = false;

  constructor(filePath: string) {
    super();
    this.filePath = filePath;
  }

  /**
   * Stream the file line by line.
   * Emits:
   *   - 'line'    (line: string, offset: number)  — for each line
   *   - 'end'     ()                               — when done
   *   - 'error'   (err: Error)                     — on error
   *
   * Returns a Promise that resolves when streaming is complete.
   */
  stream(options: StreamOptions = {}): Promise<{ lineCount: number; bytesRead: number }> {
    return new Promise((resolve, reject) => {
      let buffer = '';
      let currentOffset = options.start ?? 0;
      let lineCount = 0;
      let bytesRead = 0;

      const readStream = createReadStream(this.filePath, {
        start: options.start,
        end: options.end,
        encoding: options.encoding ?? 'utf8',
        highWaterMark: options.highWaterMark ?? 512 * 1024,
      });

      readStream.on('data', (chunk: any) => {
        if (this.aborted) {
          readStream.destroy();
          return;
        }

        buffer += chunk;
        bytesRead += Buffer.byteLength(chunk, 'utf8');

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (this.aborted) break;
          this.emit('line', line, currentOffset);
          lineCount++;
          currentOffset += Buffer.byteLength(line, 'utf8') + 1;
        }
      });

      readStream.on('end', () => {
        if (buffer.length > 0 && !this.aborted) {
          this.emit('line', buffer, currentOffset);
          lineCount++;
          bytesRead += Buffer.byteLength(buffer, 'utf8');
        }
        this.emit('end');
        resolve({ lineCount, bytesRead });
      });

      readStream.on('error', (err) => {
        this.emit('error', err);
        reject(err);
      });
    });
  }

  /**
   * Abort the current streaming operation.
   */
  abort(): void {
    this.aborted = true;
  }

  /**
   * Read the last N lines of a file efficiently (tail).
   */
  static async tail(filePath: string, lineCount: number = 50): Promise<string[]> {
    const { stat } = await import('fs/promises');
    const { size } = await stat(filePath);

    // Start reading from near the end
    const chunkSize = Math.min(lineCount * 500, size); // estimate ~500 bytes/line
    const startPos = Math.max(0, size - chunkSize);

    return new Promise((resolve, reject) => {
      const lines: string[] = [];
      let buffer = '';

      const stream = createReadStream(filePath, {
        start: startPos,
        encoding: 'utf8',
      });

      stream.on('data', (chunk: any) => {
        buffer += chunk;
      });

      stream.on('end', () => {
        const allLines = buffer.split('\n').filter((l) => l.length > 0);
        resolve(allLines.slice(-lineCount));
      });

      stream.on('error', reject);
    });
  }
}
