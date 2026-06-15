/**
 * FileWatcher.ts
 * Watches a log file for changes and notifies when it grows.
 * Uses chokidar (inotify/FSEvents) for efficient OS-level file watching.
 */

import * as chokidar from 'chokidar';
import { EventEmitter } from 'events';

export interface FileChangeEvent {
  filePath: string;
  previousSize: number;
  currentSize: number;
  addedBytes: number;
  timestamp: Date;
}

export class FileWatcher extends EventEmitter {
  private watcher: chokidar.FSWatcher | null = null;
  private fileSizes: Map<string, number> = new Map();

  /**
   * Start watching a file (or glob pattern).
   * Emits:
   *   - 'change'  (event: FileChangeEvent)  — when the file grows
   *   - 'add'     (filePath: string)         — when a new file is added
   *   - 'unlink'  (filePath: string)         — when a file is removed
   *   - 'error'   (err: Error)               — on watcher error
   */
  watch(filePathOrGlob: string | string[]): void {
    if (this.watcher) {
      this.stop();
    }

    this.watcher = chokidar.watch(filePathOrGlob, {
      persistent: true,
      ignoreInitial: false,
      usePolling: false,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
      atomic: false,
    });

    this.watcher.on('add', (filePath, stats) => {
      const size = stats?.size ?? 0;
      this.fileSizes.set(filePath, size);
      this.emit('add', filePath);
    });

    this.watcher.on('change', (filePath, stats) => {
      const previousSize = this.fileSizes.get(filePath) ?? 0;
      const currentSize = stats?.size ?? previousSize;

      if (currentSize > previousSize) {
        const event: FileChangeEvent = {
          filePath,
          previousSize,
          currentSize,
          addedBytes: currentSize - previousSize,
          timestamp: new Date(),
        };
        this.fileSizes.set(filePath, currentSize);
        this.emit('change', event);
      }
    });

    this.watcher.on('unlink', (filePath) => {
      this.fileSizes.delete(filePath);
      this.emit('unlink', filePath);
    });

    this.watcher.on('error', (err) => {
      this.emit('error', err);
    });
  }

  /**
   * Add more files to watch without restarting.
   */
  add(filePath: string): void {
    this.watcher?.add(filePath);
  }

  /**
   * Stop watching.
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.fileSizes.clear();
  }

  /**
   * Check if currently watching.
   */
  isWatching(): boolean {
    return this.watcher !== null;
  }
}
