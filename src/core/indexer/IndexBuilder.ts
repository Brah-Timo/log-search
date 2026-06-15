/**
 * IndexBuilder.ts
 * Core engine for building the inverted index from a log file.
 * Splits the file into chunks and processes them in parallel using WorkerPool.
 * Then merges all chunk results into a single InvertedIndex and serializes it.
 */

import { createReadStream } from 'fs';
import { stat, mkdir } from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { IndexSerializer } from './IndexSerializer';
import { WorkerPool } from '../workers/WorkerPool';
import type {
  IndexConfig,
  BuildResult,
  ChunkResult,
  InvertedIndex,
  ChunkBoundary,
} from '../../types/IndexTypes';

const DEFAULT_CHUNK_SIZE = 64 * 1024 * 1024; // 64 MB
const INDEX_VERSION = '1.0.0';

export class IndexBuilder {
  private filePath: string;
  private config: Required<IndexConfig>;
  private workerPool: WorkerPool;
  private serializer: IndexSerializer;

  constructor(filePath: string, config: IndexConfig = {}) {
    this.filePath = path.resolve(filePath);
    this.config = {
      chunkSize: config.chunkSize ?? DEFAULT_CHUNK_SIZE,
      maxWorkers: config.maxWorkers ?? Math.max(1, os.cpus().length - 1),
      compression: config.compression ?? 'gzip',
      tokenMinLength: config.tokenMinLength ?? 2,
      includeLineNumbers: config.includeLineNumbers ?? true,
      includeTimestamps: config.includeTimestamps ?? true,
      stopWords: config.stopWords ?? [],
    };
    this.workerPool = new WorkerPool(this.config.maxWorkers);
    this.serializer = new IndexSerializer();
  }

  /**
   * Build the full inverted index for this.filePath.
   * Calls onProgress with a percentage 0–100 as work proceeds.
   */
  async build(onProgress?: (percent: number) => void): Promise<BuildResult> {
    const startTime = Date.now();
    onProgress?.(0);

    // ── Step 1: File metadata ────────────────────────────────────────────────
    const fileStats = await stat(this.filePath);
    const fileSize = fileStats.size;
    const fileHash = await this.computeFileHash(fileSize);

    onProgress?.(3);

    // ── Step 2: Calculate chunk boundaries (aligned to newlines) ────────────
    const chunks = await this.calculateChunkBoundaries(fileSize);
    onProgress?.(5);

    // ── Step 3: Parallel chunk processing ───────────────────────────────────
    let completedChunks = 0;
    const chunkResults: ChunkResult[] = await Promise.all(
      chunks.map((chunk) =>
        this.workerPool
          .run({
            task: 'processChunk',
            filePath: this.filePath,
            startByte: chunk.start,
            endByte: chunk.end,
            chunkId: chunk.chunkId,
            config: this.config,
          })
          .then((result) => {
            completedChunks++;
            const progress = 5 + (completedChunks / chunks.length) * 75;
            onProgress?.(Math.round(progress));
            return result;
          })
      )
    );

    onProgress?.(80);

    // ── Step 4: Merge chunk indexes ──────────────────────────────────────────
    const mergedIndex = this.mergeChunkResults(chunkResults, fileSize, fileHash);
    onProgress?.(90);

    // ── Step 5: Serialize and save ───────────────────────────────────────────
    const indexPath = await this.resolveIndexPath();
    await this.serializer.save(mergedIndex, indexPath, this.config.compression);

    // Update compression ratio
    const indexSize = await this.serializer.getSize(indexPath);
    mergedIndex.metadata.compressionRatio =
      fileSize > 0 ? Math.round((1 - indexSize / fileSize) * 100) / 100 : 0;

    onProgress?.(100);

    await this.workerPool.terminate();

    const elapsed = Date.now() - startTime;
    mergedIndex.metadata.buildTimeMs = elapsed;

    return {
      indexPath,
      fileSize,
      totalLines: mergedIndex.metadata.totalLines,
      uniqueTerms: mergedIndex.metadata.uniqueTerms,
      buildTimeMs: elapsed,
      compressionRatio: mergedIndex.metadata.compressionRatio,
    };
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Divide the file into N chunks, each starting and ending exactly at a newline.
   */
  private async calculateChunkBoundaries(fileSize: number): Promise<ChunkBoundary[]> {
    if (fileSize === 0) return [{ start: 0, end: 0, chunkId: 0 }];

    const numChunks = Math.max(1, Math.ceil(fileSize / this.config.chunkSize));
    const boundaries: ChunkBoundary[] = [];
    let position = 0;

    for (let i = 0; i < numChunks; i++) {
      const targetEnd = Math.min(position + this.config.chunkSize, fileSize - 1);
      const actualEnd =
        i === numChunks - 1 ? fileSize - 1 : await this.findNextNewline(targetEnd);

      boundaries.push({ start: position, end: actualEnd, chunkId: i });
      position = actualEnd + 1;

      if (position >= fileSize) break;
    }

    return boundaries;
  }

  /**
   * Scan forward from `position` until we find a '\n' character.
   * Returns the offset of that '\n'.
   */
  private findNextNewline(position: number): Promise<number> {
    return new Promise((resolve) => {
      const stream = createReadStream(this.filePath, {
        start: position,
        end: position + 1024,
      });

      let offset = position;
      let found = false;

      stream.on('data', (chunk: any) => {
        const newlinePos = chunk.indexOf(0x0a);
        if (newlinePos !== -1 && !found) {
          found = true;
          resolve(offset + newlinePos);
          stream.destroy();
        } else {
          offset += chunk.length;
        }
      });

      stream.on('end', () => {
        if (!found) resolve(position);
      });

      stream.on('error', () => resolve(position));
      stream.on('close', () => {
        if (!found) resolve(position);
      });
    });
  }

  /**
   * Merge all chunk InvertedIndexes into a single master index.
   */
  private mergeChunkResults(
    chunks: ChunkResult[],
    fileSize: number,
    fileHash: string
  ): InvertedIndex {
    // Sort chunks by their chunk ID to ensure correct line ordering
    const sorted = [...chunks].sort((a, b) => a.chunkId - b.chunkId);

    const masterIndex: Map<string, number[]> = new Map();
    const allLineOffsets: number[] = [];
    let totalLines = 0;

    for (const chunk of sorted) {
      totalLines += chunk.lineCount;

      // Merge line offsets
      for (const offset of chunk.lineOffsets) {
        allLineOffsets.push(offset);
      }

      // Merge inverted index
      for (const [term, offsets] of Object.entries(chunk.termOffsets)) {
        const existing = masterIndex.get(term);
        if (existing) {
          for (const o of offsets) existing.push(o);
        } else {
          masterIndex.set(term, [...offsets]);
        }
      }
    }

    // Sort line offsets
    allLineOffsets.sort((a, b) => a - b);

    return {
      invertedIndex: Object.fromEntries(masterIndex),
      lineOffsets: allLineOffsets,
      metadata: {
        totalLines,
        uniqueTerms: masterIndex.size,
        fileSize,
        filePath: this.filePath,
        fileHash,
        builtAt: new Date().toISOString(),
        buildTimeMs: 0, // filled in after
        compressionRatio: 0, // filled in after
        version: INDEX_VERSION,
      },
    };
  }

  /**
   * Compute a quick hash of the file for staleness detection.
   * Only reads the first and last 64KB + file size for speed.
   */
  private async computeFileHash(fileSize: number): Promise<string> {
    return new Promise((resolve) => {
      const hash = crypto.createHash('md5');
      hash.update(String(fileSize));

      const readChunk = (start: number, end: number, cb: () => void) => {
        const s = createReadStream(this.filePath, { start, end });
        s.on('data', (d) => hash.update(d));
        s.on('end', cb);
        s.on('error', cb);
      };

      const tail = Math.max(0, fileSize - 65536);
      readChunk(0, Math.min(65535, fileSize - 1), () => {
        if (tail > 65536) {
          readChunk(tail, fileSize - 1, () => resolve(hash.digest('hex').slice(0, 16)));
        } else {
          resolve(hash.digest('hex').slice(0, 16));
        }
      });
    });
  }

  /**
   * Resolve the path where the index will be stored.
   * Format: ~/.log-search/indexes/<filename>-<hash>.lsi
   */
  private async resolveIndexPath(): Promise<string> {
    const hash = crypto
      .createHash('md5')
      .update(this.filePath)
      .digest('hex')
      .slice(0, 8);

    const cacheDir = path.join(os.homedir(), '.log-search', 'indexes');
    await mkdir(cacheDir, { recursive: true });

    const basename = path.basename(this.filePath);
    return path.join(cacheDir, `${basename}-${hash}.lsi`);
  }

  /**
   * Get the index path for this file (without building it).
   */
  async getIndexPath(): Promise<string> {
    return this.resolveIndexPath();
  }
}
