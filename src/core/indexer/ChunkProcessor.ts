/**
 * ChunkProcessor.ts
 * Processes a single chunk (byte range) of the log file.
 * Reads the chunk, splits into lines, extracts tokens, and maps offsets.
 * Designed to run inside a Worker thread.
 */

import { createReadStream } from 'fs';
import { TokenExtractor } from './TokenExtractor';
import type { ChunkResult, IndexConfig } from '../../types/IndexTypes';

export class ChunkProcessor {
  private filePath: string;
  private config: IndexConfig;
  private tokenExtractor: TokenExtractor;

  constructor(filePath: string, config: IndexConfig) {
    this.filePath = filePath;
    this.config = config;
    this.tokenExtractor = new TokenExtractor({
      minLength: config.tokenMinLength ?? 2,
      stopWords: config.stopWords ?? [],
      includeTimestamps: config.includeTimestamps ?? true,
    });
  }

  /**
   * Process a byte range of the file and return an inverted index for that chunk.
   * @param startByte  First byte to read (inclusive)
   * @param endByte    Last byte to read (inclusive)
   * @param chunkId    Chunk identifier for ordering
   */
  async process(startByte: number, endByte: number, chunkId: number): Promise<ChunkResult> {
    const termOffsets: Record<string, number[]> = {};
    const lineOffsets: number[] = [];
    let lineCount = 0;
    let bytesProcessed = 0;
    let currentOffset = startByte;
    let buffer = '';

    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(this.filePath, {
        start: startByte,
        end: endByte,
        encoding: 'utf8',
        highWaterMark: 512 * 1024, // 512KB read buffer
      });

      stream.on('data', (chunk: any) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.length === 0) {
            currentOffset += 1; // account for the '\n'
            continue;
          }

          // Record this line's byte offset
          lineOffsets.push(currentOffset);
          lineCount++;
          bytesProcessed += Buffer.byteLength(line, 'utf8') + 1; // +1 for '\n'

          // Extract tokens from this line
          const tokens = this.tokenExtractor.extract(line);
          for (const token of tokens) {
            if (!termOffsets[token]) {
              termOffsets[token] = [];
            }
            // Avoid duplicate offsets for the same line
            const arr = termOffsets[token];
            if (arr.length === 0 || arr[arr.length - 1] !== currentOffset) {
              arr.push(currentOffset);
            }
          }

          currentOffset += Buffer.byteLength(line, 'utf8') + 1;
        }
      });

      stream.on('end', () => {
        // Process the last line if there's no trailing newline
        if (buffer.length > 0) {
          lineOffsets.push(currentOffset);
          lineCount++;
          const tokens = this.tokenExtractor.extract(buffer);
          for (const token of tokens) {
            if (!termOffsets[token]) {
              termOffsets[token] = [];
            }
            const arr = termOffsets[token];
            if (arr.length === 0 || arr[arr.length - 1] !== currentOffset) {
              arr.push(currentOffset);
            }
          }
          bytesProcessed += Buffer.byteLength(buffer, 'utf8');
        }
        resolve();
      });

      stream.on('error', reject);
    });

    return {
      chunkId,
      lineCount,
      bytesProcessed,
      termOffsets,
      lineOffsets,
    };
  }
}
