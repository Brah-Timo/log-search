/**
 * SearchWorker.ts
 * Worker thread for parallel regex/fuzzy search over file chunks.
 * Used for fallback searches that bypass the index (e.g., pure regex).
 */

import { workerData, parentPort } from 'worker_threads';
import { createReadStream } from 'fs';

interface SearchWorkerData {
  filePath: string;
  startByte: number;
  endByte: number;
  pattern: string;
  isRegex: boolean;
  ignoreCase: boolean;
  chunkId: number;
}

interface SearchWorkerResult {
  chunkId: number;
  matches: Array<{ offset: number; content: string }>;
  error?: string;
}

async function run(): Promise<void> {
  if (!parentPort) process.exit(1);

  const data = workerData as SearchWorkerData;
  const matches: Array<{ offset: number; content: string }> = [];

  try {
    const flags = data.ignoreCase ? 'gi' : 'g';
    const regex = data.isRegex
      ? new RegExp(data.pattern, flags)
      : new RegExp(data.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);

    let buffer = '';
    let currentOffset = data.startByte;

    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(data.filePath, {
        start: data.startByte,
        end: data.endByte,
        encoding: 'utf8',
        highWaterMark: 256 * 1024,
      });

      stream.on('data', (chunk: any) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const lineBytes = Buffer.byteLength(line, 'utf8') + 1;
          if (regex.test(line)) {
            matches.push({ offset: currentOffset, content: line });
          }
          regex.lastIndex = 0;
          currentOffset += lineBytes;
        }
      });

      stream.on('end', () => {
        if (buffer.length > 0 && regex.test(buffer)) {
          matches.push({ offset: currentOffset, content: buffer });
        }
        resolve();
      });

      stream.on('error', reject);
    });

    const result: SearchWorkerResult = { chunkId: data.chunkId, matches };
    parentPort!.postMessage(result);
  } catch (err) {
    const result: SearchWorkerResult = {
      chunkId: data.chunkId,
      matches: [],
      error: err instanceof Error ? err.message : String(err),
    };
    parentPort!.postMessage(result);
  }
}

run();
