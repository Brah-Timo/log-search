/**
 * src/index.ts
 * Public API exports for programmatic use.
 *
 * @example
 * import { IndexBuilder, IndexSearcher } from 'log-search';
 *
 * const builder = new IndexBuilder('./app.log');
 * const result = await builder.build();
 *
 * const searcher = new IndexSearcher('./app.log');
 * await searcher.loadIndex(result.indexPath);
 * const hits = await searcher.search('ERROR AND timeout');
 */

// Core
export { IndexBuilder } from './core/indexer/IndexBuilder';
export { IndexSearcher } from './core/searcher/IndexSearcher';
export { ResultFetcher } from './core/searcher/ResultFetcher';
export { RankEngine } from './core/searcher/RankEngine';
export { TokenExtractor } from './core/indexer/TokenExtractor';
export { OffsetMapper } from './core/indexer/OffsetMapper';
export { ChunkProcessor } from './core/indexer/ChunkProcessor';
export { IndexSerializer } from './core/indexer/IndexSerializer';
export { WorkerPool } from './core/workers/WorkerPool';

// Streaming
export { FileStreamer } from './core/streaming/FileStreamer';
export { LineBuffer } from './core/streaming/LineBuffer';
export { ChunkSplitter } from './core/streaming/ChunkSplitter';

// Index Store
export { IndexStore } from './index-store/IndexStore';
export { CacheManager } from './index-store/CacheManager';
export { FileWatcher } from './index-store/FileWatcher';
export { IncrementalUpdater } from './index-store/IncrementalUpdater';

// Formats
export { LogFormatDetector } from './formats/LogFormatDetector';
export { NginxParser } from './formats/parsers/NginxParser';
export { ApacheParser } from './formats/parsers/ApacheParser';
export { JsonParser } from './formats/parsers/JsonParser';
export { SyslogParser } from './formats/parsers/SyslogParser';
export { GenericParser } from './formats/parsers/GenericParser';

// Query
export { QueryParser } from './query/QueryEngine';
export { RegexMatcher } from './query/regex/RegexMatcher';
export { FuzzyMatcher } from './query/regex/FuzzyMatcher';
export { AndOperator } from './query/operators/AndOperator';
export { OrOperator } from './query/operators/OrOperator';
export { NotOperator } from './query/operators/NotOperator';
export { RangeOperator } from './query/operators/RangeOperator';

// Types
export * from './types/IndexTypes';
export * from './types/SearchTypes';
export * from './types/ConfigTypes';
