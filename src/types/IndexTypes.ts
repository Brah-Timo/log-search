/**
 * IndexTypes.ts
 * All TypeScript types and interfaces related to index building and storage.
 */

export type CompressionAlgorithm = 'none' | 'gzip' | 'zstd';

export interface IndexConfig {
  /** Size of each chunk processed in parallel (bytes). Default: 64MB */
  chunkSize?: number;
  /** Max number of worker threads. Default: CPU cores - 1 */
  maxWorkers?: number;
  /** Compression algorithm for the index file. Default: 'gzip' */
  compression?: CompressionAlgorithm;
  /** Minimum token length to index. Default: 2 */
  tokenMinLength?: number;
  /** Include line numbers in the index. Default: true */
  includeLineNumbers?: boolean;
  /** Index timestamp tokens. Default: true */
  includeTimestamps?: boolean;
  /** Custom stop words to exclude from index */
  stopWords?: string[];
}

export interface ChunkBoundary {
  start: number;
  end: number;
  chunkId: number;
}

export interface ChunkResult {
  chunkId: number;
  lineCount: number;
  bytesProcessed: number;
  /** Map of term → array of byte offsets in the file */
  termOffsets: Record<string, number[]>;
  /** Byte offset of each line start */
  lineOffsets: number[];
}

export interface IndexMetadata {
  totalLines: number;
  uniqueTerms: number;
  fileSize: number;
  filePath: string;
  fileHash: string;
  builtAt: string;
  buildTimeMs: number;
  compressionRatio: number;
  version: string;
}

export interface InvertedIndex {
  /** term → sorted array of byte offsets (line starts) */
  invertedIndex: Record<string, number[]>;
  /** Sorted array of all line start byte offsets */
  lineOffsets: number[];
  metadata: IndexMetadata;
}

export interface BuildResult {
  indexPath: string;
  fileSize: number;
  totalLines: number;
  uniqueTerms: number;
  buildTimeMs: number;
  compressionRatio: number;
}

export interface IndexInfo {
  indexPath: string;
  filePath: string;
  fileSize: number;
  indexSize: number;
  totalLines: number;
  uniqueTerms: number;
  builtAt: string;
  compressionRatio: number;
  isStale: boolean;
}

export interface WorkerTask {
  task: 'processChunk';
  filePath: string;
  startByte: number;
  endByte: number;
  chunkId: number;
  config: IndexConfig;
}

export interface WorkerResult {
  chunkId: number;
  result: ChunkResult;
  error?: string;
}
