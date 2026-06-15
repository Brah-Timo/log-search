/**
 * ChunkSplitter.ts
 * Divides a file into N equal byte-range chunks aligned to newline boundaries.
 * Used by IndexBuilder to prepare work for parallel Workers.
 */

import { createReadStream } from 'fs';
import { stat } from 'fs/promises';

export interface FileChunk {
  chunkId: number;
  startByte: number;
  endByte: number;
  estimatedLines: number;
}

export class ChunkSplitter {
  /**
   * Split a file into `numChunks` chunks, each starting and ending at a '\n'.
   * @param filePath   Path to the file
   * @param numChunks  Desired number of chunks (actual may be less for small files)
   */
  static async split(filePath: string, numChunks: number): Promise<FileChunk[]> {
    const { size } = await stat(filePath);
    if (size === 0) return [{ chunkId: 0, startByte: 0, endByte: 0, estimatedLines: 0 }];

    const chunkSize = Math.ceil(size / numChunks);
    const chunks: FileChunk[] = [];
    let position = 0;
    let chunkId = 0;

    while (position < size) {
      const targetEnd = Math.min(position + chunkSize - 1, size - 1);
      const actualEnd =
        targetEnd === size - 1
          ? size - 1
          : await ChunkSplitter.findNewlineBefore(filePath, targetEnd, position);

      chunks.push({
        chunkId: chunkId++,
        startByte: position,
        endByte: actualEnd,
        estimatedLines: Math.round((actualEnd - position) / 150), // ~150 bytes per line estimate
      });

      position = actualEnd + 1;
    }

    return chunks;
  }

  /**
   * Find the byte position of the '\n' at or before `targetPos`.
   * Scans backward from `targetPos`.
   */
  static findNewlineBefore(
    filePath: string,
    targetPos: number,
    minPos: number
  ): Promise<number> {
    return new Promise((resolve) => {
      const scanSize = Math.min(512, targetPos - minPos);
      if (scanSize <= 0) {
        resolve(targetPos);
        return;
      }

      const start = targetPos - scanSize;
      const stream = createReadStream(filePath, { start, end: targetPos });
      const chunks: Buffer[] = [];

      stream.on('data', (chunk: any) => chunks.push(chunk));
      stream.on('end', () => {
        const data = Buffer.concat(chunks);
        // Search backward for '\n'
        for (let i = data.length - 1; i >= 0; i--) {
          if (data[i] === 0x0a) {
            resolve(start + i);
            return;
          }
        }
        resolve(targetPos);
      });
      stream.on('error', () => resolve(targetPos));
    });
  }
}
