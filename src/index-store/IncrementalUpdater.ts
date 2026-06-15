/**
 * IncrementalUpdater.ts
 * Incrementally updates an existing index when new lines are appended to a log file.
 * Only processes the newly added bytes — no full rebuild needed.
 */

import { stat } from 'fs/promises';
import { ChunkProcessor } from '../core/indexer/ChunkProcessor';
import { IndexSerializer } from '../core/indexer/IndexSerializer';
import type { InvertedIndex, IndexConfig } from '../types/IndexTypes';

export class IncrementalUpdater {
  private serializer: IndexSerializer;
  private config: IndexConfig;

  constructor(config: IndexConfig = {}) {
    this.config = config;
    this.serializer = new IndexSerializer();
  }

  /**
   * Update the index with any new content added to the file since the index was built.
   * @param filePath   Path to the log file
   * @param indexPath  Path to the existing .lsi index file
   * @returns          Updated index, or null if no updates were needed
   */
  async update(filePath: string, indexPath: string): Promise<InvertedIndex | null> {
    const index = await this.serializer.load(indexPath);
    const { size: currentSize } = await stat(filePath);
    const indexedSize = index.metadata.fileSize;

    if (currentSize <= indexedSize) {
      // No new data
      return null;
    }

    // Process only the new bytes
    const processor = new ChunkProcessor(filePath, this.config);
    const chunkResult = await processor.process(
      indexedSize,
      currentSize - 1,
      999999 // sentinel chunkId for incremental
    );

    if (chunkResult.lineCount === 0) return null;

    // Merge new terms into existing index
    for (const [term, offsets] of Object.entries(chunkResult.termOffsets)) {
      if (index.invertedIndex[term]) {
        index.invertedIndex[term].push(...offsets);
      } else {
        index.invertedIndex[term] = offsets;
      }
    }

    // Append new line offsets
    index.lineOffsets.push(...chunkResult.lineOffsets);
    index.lineOffsets.sort((a, b) => a - b); // keep sorted

    // Update metadata
    index.metadata.totalLines += chunkResult.lineCount;
    index.metadata.fileSize = currentSize;
    index.metadata.uniqueTerms = Object.keys(index.invertedIndex).length;
    index.metadata.builtAt = new Date().toISOString();

    // Persist updated index
    await this.serializer.save(index, indexPath, this.config.compression ?? 'gzip');

    return index;
  }
}
