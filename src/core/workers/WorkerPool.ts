/**
 * WorkerPool.ts
 * Manages a pool of worker threads for parallel chunk processing.
 * Distributes tasks to available workers and collects results.
 */

import { Worker } from 'worker_threads';
import * as path from 'path';
import type { WorkerTask, ChunkResult } from '../../types/IndexTypes';

interface PendingTask {
  task: WorkerTask;
  resolve: (result: ChunkResult) => void;
  reject: (err: Error) => void;
}

export class WorkerPool {
  private maxWorkers: number;
  private workerScript: string;
  private activeWorkers: Set<Worker> = new Set();
  private queue: PendingTask[] = [];

  constructor(maxWorkers: number) {
    this.maxWorkers = Math.max(1, maxWorkers);
    // Points to the compiled JS version of IndexWorker
    this.workerScript = path.join(__dirname, 'IndexWorker.js');
  }

  /**
   * Run a task on an available worker, or queue it if all are busy.
   */
  run(task: WorkerTask): Promise<ChunkResult> {
    return new Promise((resolve, reject) => {
      const pending: PendingTask = { task, resolve, reject };
      if (this.activeWorkers.size < this.maxWorkers) {
        this.spawnWorker(pending);
      } else {
        this.queue.push(pending);
      }
    });
  }

  /**
   * Spawn a new worker thread for the given task.
   */
  private spawnWorker(pending: PendingTask): void {
    const worker = new Worker(this.workerScript, {
      workerData: pending.task,
    });

    this.activeWorkers.add(worker);

    worker.on('message', (message) => {
      this.activeWorkers.delete(worker);

      if (message.error) {
        pending.reject(new Error(`Worker error in chunk ${message.chunkId}: ${message.error}`));
      } else {
        pending.resolve(message.result);
      }

      // Process next item in queue
      if (this.queue.length > 0) {
        const next = this.queue.shift()!;
        this.spawnWorker(next);
      }
    });

    worker.on('error', (err) => {
      this.activeWorkers.delete(worker);
      pending.reject(err);

      if (this.queue.length > 0) {
        const next = this.queue.shift()!;
        this.spawnWorker(next);
      }
    });

    worker.on('exit', (code) => {
      if (code !== 0 && this.activeWorkers.has(worker)) {
        this.activeWorkers.delete(worker);
        pending.reject(new Error(`Worker exited with code ${code}`));
      }
    });
  }

  /**
   * Wait for all active workers to finish and drain the queue.
   */
  async drain(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (this.activeWorkers.size === 0 && this.queue.length === 0) {
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });
  }

  /**
   * Terminate all active workers immediately.
   */
  async terminate(): Promise<void> {
    const terminations = [...this.activeWorkers].map((w) => w.terminate());
    await Promise.all(terminations);
    this.activeWorkers.clear();
    this.queue.length = 0;
  }
}
