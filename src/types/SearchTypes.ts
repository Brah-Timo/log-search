/**
 * SearchTypes.ts
 * All TypeScript types and interfaces related to search queries and results.
 */

export type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'WARNING' | 'ERROR' | 'FATAL' | 'CRITICAL';

export interface SearchOptions {
  /** Maximum number of results to return. Default: 1000 */
  limit?: number;
  /** Skip N results (for pagination). Default: 0 */
  offset?: number;
  /** Case-insensitive search. Default: true */
  ignoreCase?: boolean;
  /** Treat query as regex pattern. Default: false */
  isRegex?: boolean;
  /** Number of context lines around each match. Default: 0 */
  context?: number;
  /** Filter results after this ISO datetime */
  since?: string;
  /** Filter results before this ISO datetime */
  until?: string;
  /** Filter by log level */
  level?: LogLevel;
  /** Sort order for results. Default: 'line' */
  sortBy?: 'line' | 'score' | 'timestamp';
  /** Sort direction. Default: 'asc' */
  sortDir?: 'asc' | 'desc';
}

export interface SearchResult {
  /** 1-based line number in the original file */
  lineNumber: number;
  /** Byte offset in the file */
  offset: number;
  /** The raw line content */
  content: string;
  /** Array of [start, end] positions of matches within content */
  highlights: Array<[number, number]>;
  /** Relevance score (BM25-simplified) */
  matchScore: number;
  /** Context lines before the match */
  contextBefore?: string[];
  /** Context lines after the match */
  contextAfter?: string[];
}

export interface SearchStats {
  query: string;
  filePath: string;
  totalMatches: number;
  searchTimeMs: number;
  indexLoaded: boolean;
}

// ─── Query Parser Types ───────────────────────────────────────────────────────

export type QueryType =
  | 'simple'
  | 'phrase'
  | 'and'
  | 'or'
  | 'not'
  | 'regex'
  | 'fuzzy'
  | 'range'
  | 'level'
  | 'field';

export interface BaseQuery {
  type: QueryType;
  raw: string;
}

export interface SimpleQuery extends BaseQuery {
  type: 'simple';
  term: string;
}

export interface PhraseQuery extends BaseQuery {
  type: 'phrase';
  terms: string[];
  phrase: string;
}

export interface AndQuery extends BaseQuery {
  type: 'and';
  operands: ParsedQuery[];
}

export interface OrQuery extends BaseQuery {
  type: 'or';
  operands: ParsedQuery[];
}

export interface NotQuery extends BaseQuery {
  type: 'not';
  operand: ParsedQuery;
}

export interface RegexQuery extends BaseQuery {
  type: 'regex';
  pattern: RegExp;
}

export interface FuzzyQuery extends BaseQuery {
  type: 'fuzzy';
  term: string;
  threshold: number;
}

export interface RangeQuery extends BaseQuery {
  type: 'range';
  field: string;
  from?: string;
  to?: string;
}

export interface LevelQuery extends BaseQuery {
  type: 'level';
  level: LogLevel;
}

export interface FieldQuery extends BaseQuery {
  type: 'field';
  field: string;
  value: string;
}

export type ParsedQuery =
  | SimpleQuery
  | PhraseQuery
  | AndQuery
  | OrQuery
  | NotQuery
  | RegexQuery
  | FuzzyQuery
  | RangeQuery
  | LevelQuery
  | FieldQuery;
