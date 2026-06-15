/**
 * IndexWorker.ts
 * Worker thread script for processing a file chunk.
 * This file is loaded by WorkerPool as a worker_threads Worker.
 * It runs inside a separate thread and communicates via parentPort.
 */

import { workerData, parentPort } from 'worker_threads';
import { ChunkProcessor } from '../indexer/ChunkProcessor';
import type { WorkerTask, WorkerResult } from '../../types/IndexTypes';

async function run(): Promise<void> {
  const task = workerData as WorkerTask;

  if (!parentPort) {
    process.exit(1);
  }

  try {
    const processor = new ChunkProcessor(task.filePath, task.config);
    const result = await processor.process(task.startByte, task.endByte, task.chunkId);

    const response: WorkerResult = {
      chunkId: task.chunkId,
      result,
    };

    parentPort.postMessage(response);
  } catch (err) {
    const response: WorkerResult = {
      chunkId: task.chunkId,
      result: {
        chunkId: task.chunkId,
        lineCount: 0,
        bytesProcessed: 0,
        termOffsets: {},
        lineOffsets: [],
      },
      error: err instanceof Error ? err.message : String(err),
    };
    parentPort.postMessage(response);
  }
}

run();
