/**
 * IndexSearcher.ts
 * Executes queries against a loaded InvertedIndex in milliseconds.
 * Supports AND, OR, NOT, phrase, regex, fuzzy, level, and field queries.
 */

import * as path from 'path';
import { IndexSerializer } from '../indexer/IndexSerializer';
import { ResultFetcher } from './ResultFetcher';
import { RankEngine } from './RankEngine';
import { QueryParser } from '../../query/QueryEngine';
import type { InvertedIndex } from '../../types/IndexTypes';
import type {
  SearchOptions,
  SearchResult,
  ParsedQuery,
} from '../../types/SearchTypes';

export class IndexSearcher {
  private filePath: string;
  private indexData: InvertedIndex | null = null;
  private fetcher: ResultFetcher;
  private rankEngine: RankEngine;
  private serializer: IndexSerializer;
  private parser: QueryParser;

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
    this.fetcher = new ResultFetcher(this.filePath);
    this.rankEngine = new RankEngine();
    this.serializer = new IndexSerializer();
    this.parser = new QueryParser();
  }

  // ─── Index Loading ─────────────────────────────────────────────────────────

  async loadIndex(indexPath: string): Promise<void> {
    this.indexData = await this.serializer.load(indexPath);

    // Calibrate rank engine with average line length from index metadata
    const avgLen =
      this.indexData.metadata.totalLines > 0
        ? this.indexData.metadata.fileSize / this.indexData.metadata.totalLines
        : 200;
    this.rankEngine = new RankEngine(avgLen);
  }

  isIndexLoaded(): boolean {
    return this.indexData !== null;
  }

  // ─── Main Search Entry Point ───────────────────────────────────────────────

  /**
   * Execute a query and return matching SearchResults.
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.indexData) {
      throw new Error('Index not loaded. Call loadIndex() first.');
    }

    const opts: Required<SearchOptions> = {
      limit: options.limit ?? 1000,
      offset: options.offset ?? 0,
      ignoreCase: options.ignoreCase ?? true,
      isRegex: options.isRegex ?? false,
      context: options.context ?? 0,
      since: options.since ?? '',
      until: options.until ?? '',
      level: options.level ?? undefined as any,
      sortBy: options.sortBy ?? 'line',
      sortDir: options.sortDir ?? 'asc',
    };

    // 1. Parse query
    const parsedQuery = this.parser.parse(query, {
      ignoreCase: opts.ignoreCase,
      isRegex: opts.isRegex,
    });

    // 2. Resolve to byte offsets via index
    let matchingOffsets = this.resolveQuery(parsedQuery, opts.ignoreCase);

    // 3. Apply time-range filter if requested
    if (opts.since || opts.until) {
      matchingOffsets = await this.filterByTimeRange(matchingOffsets, opts.since, opts.until);
    }

    // 4. Apply level filter if requested
    if (opts.level) {
      matchingOffsets = await this.filterByLevel(matchingOffsets, opts.level);
    }

    if (matchingOffsets.length === 0) return [];

    // 5. Sort and paginate offsets
    const sorted =
      opts.sortBy === 'line'
        ? [...matchingOffsets].sort((a, b) => (opts.sortDir === 'asc' ? a - b : b - a))
        : [...matchingOffsets].sort((a, b) => a - b); // default sort for score pass

    const paginated = sorted.slice(opts.offset, opts.offset + opts.limit);

    // 6. Fetch line content
    await this.fetcher.open();
    const lines = await this.fetcher.fetchLines(paginated);

    // 7. Optionally fetch context lines
    let results: SearchResult[] = await Promise.all(
      lines.map(async (content, i) => {
        const offset = paginated[i];
        const lineNumber = this.findLineNumber(offset);
        const highlights = this.findHighlights(content, parsedQuery, opts.ignoreCase);

        let contextBefore: string[] | undefined;
        let contextAfter: string[] | undefined;

        if (opts.context > 0) {
          const { beforeOffsets, afterOffsets } = this.getContextOffsets(offset, opts.context);
          contextBefore = await this.fetcher.fetchLines(beforeOffsets);
          contextAfter = await this.fetcher.fetchLines(afterOffsets);
        }

        return {
          lineNumber,
          offset,
          content,
          highlights,
          matchScore: 0,
          contextBefore,
          contextAfter,
        };
      })
    );

    await this.fetcher.close();

    // 8. Score and optionally re-sort by relevance
    if (opts.sortBy === 'score') {
      results = this.rankEngine.rankResults(results, parsedQuery);
      if (opts.sortDir === 'asc') results.reverse();
    } else {
      // Just compute scores for display without re-sorting
      const terms = this.extractTermsFromQuery(parsedQuery);
      results = results.map((r) => ({
        ...r,
        matchScore: this.rankEngine.score(r.content, terms),
      }));
    }

    return results;
  }

  // ─── Query Resolution ──────────────────────────────────────────────────────

  private resolveQuery(query: ParsedQuery, ignoreCase: boolean): number[] {
    switch (query.type) {
      case 'simple':
        return this.lookupTerm(query.term, ignoreCase);

      case 'phrase':
        return this.lookupPhrase(query.terms, ignoreCase);

      case 'and':
        return this.intersect(query.operands.map((op) => this.resolveQuery(op, ignoreCase)));

      case 'or':
        return this.union(query.operands.map((op) => this.resolveQuery(op, ignoreCase)));

      case 'not':
        return this.subtract(
          this.indexData!.lineOffsets,
          this.resolveQuery(query.operand, ignoreCase)
        );

      case 'regex':
        // Regex falls back to full streaming scan (handled in CLI layer)
        // Return all offsets as candidates — will be filtered by ResultFetcher
        return [...this.indexData!.lineOffsets];

      case 'fuzzy':
        return this.lookupFuzzy(query.term, query.threshold, ignoreCase);

      case 'level':
        return this.lookupTerm(query.level, ignoreCase);

      case 'field':
        return this.lookupTerm(query.value, ignoreCase);

      default:
        return [];
    }
  }

  private lookupTerm(term: string, ignoreCase: boolean): number[] {
    const t = ignoreCase ? term.toLowerCase() : term;
    return this.indexData!.invertedIndex[t] ?? [];
  }

  private lookupPhrase(terms: string[], ignoreCase: boolean): number[] {
    if (terms.length === 0) return [];
    if (terms.length === 1) return this.lookupTerm(terms[0], ignoreCase);

    // Get candidates: lines containing ALL terms
    const candidates = this.intersect(terms.map((t) => this.lookupTerm(t, ignoreCase)));
    // Phrase order verification happens at the ResultFetcher level (content check)
    return candidates;
  }

  private lookupFuzzy(term: string, threshold: number, ignoreCase: boolean): number[] {
    const t = ignoreCase ? term.toLowerCase() : term;
    const results = new Set<number>();

    for (const [indexedTerm, offsets] of Object.entries(this.indexData!.invertedIndex)) {
      if (this.jaroWinkler(t, indexedTerm) >= threshold) {
        for (const o of offsets) results.add(o);
      }
    }

    return [...results];
  }

  // ─── Set Operations ────────────────────────────────────────────────────────

  private intersect(lists: number[][]): number[] {
    if (lists.length === 0) return [];
    if (lists.length === 1) return lists[0];

    // Start with the smallest list for efficiency
    const sorted = [...lists].sort((a, b) => a.length - b.length);
    const sets = sorted.slice(1).map((l) => new Set(l));
    return sorted[0].filter((offset) => sets.every((s) => s.has(offset)));
  }

  private union(lists: number[][]): number[] {
    const combined = new Set<number>();
    for (const list of lists) {
      for (const offset of list) combined.add(offset);
    }
    return [...combined];
  }

  private subtract(all: number[], excluded: number[]): number[] {
    const excludedSet = new Set(excluded);
    return all.filter((o) => !excludedSet.has(o));
  }

  // ─── Highlight & Line Number ───────────────────────────────────────────────

  private findHighlights(
    line: string,
    query: ParsedQuery,
    ignoreCase: boolean
  ): Array<[number, number]> {
    const terms = this.extractTermsFromQuery(query);
    const positions: Array<[number, number]> = [];
    const searchLine = ignoreCase ? line.toLowerCase() : line;

    for (const term of terms) {
      const t = ignoreCase ? term.toLowerCase() : term;
      let idx = 0;
      while ((idx = searchLine.indexOf(t, idx)) !== -1) {
        positions.push([idx, idx + t.length]);
        idx += t.length;
      }
    }

    // Sort by start position, merge overlapping ranges
    return positions.sort((a, b) => a[0] - b[0]);
  }

  private findLineNumber(offset: number): number {
    const offsets = this.indexData!.lineOffsets;
    let lo = 0;
    let hi = offsets.length - 1;

    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (offsets[mid] === offset) return mid + 1;
      if (offsets[mid] < offset) lo = mid + 1;
      else hi = mid - 1;
    }
    return Math.min(lo + 1, offsets.length);
  }

  private getContextOffsets(
    offset: number,
    contextLines: number
  ): { beforeOffsets: number[]; afterOffsets: number[] } {
    const offsets = this.indexData!.lineOffsets;
    const idx = offsets.indexOf(offset);
    if (idx === -1) return { beforeOffsets: [], afterOffsets: [] };

    const beforeOffsets = offsets.slice(Math.max(0, idx - contextLines), idx);
    const afterOffsets = offsets.slice(idx + 1, idx + 1 + contextLines);
    return { beforeOffsets, afterOffsets };
  }

  // ─── Filters ──────────────────────────────────────────────────────────────

  private async filterByTimeRange(
    offsets: number[],
    since: string,
    until: string
  ): Promise<number[]> {
    // Simple timestamp filter — fetch lines and check timestamps
    const sinceDate = since ? new Date(since).getTime() : 0;
    const untilDate = until ? new Date(until).getTime() : Infinity;

    await this.fetcher.open();
    const lines = await this.fetcher.fetchLines(offsets);
    await this.fetcher.close();

    const ISO_RE = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/;

    return offsets.filter((_, i) => {
      const match = lines[i].match(ISO_RE);
      if (!match) return true; // Can't parse timestamp — include by default
      const ts = new Date(match[0]).getTime();
      return ts >= sinceDate && ts <= untilDate;
    });
  }

  private async filterByLevel(offsets: number[], level: string): Promise<number[]> {
    await this.fetcher.open();
    const lines = await this.fetcher.fetchLines(offsets);
    await this.fetcher.close();

    const levelUpper = level.toUpperCase();
    return offsets.filter((_, i) => lines[i].toUpperCase().includes(levelUpper));
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private extractTermsFromQuery(query: ParsedQuery): string[] {
    switch (query.type) {
      case 'simple': return [query.term];
      case 'phrase': return query.terms;
      case 'and': case 'or': return query.operands.flatMap((op) => this.extractTermsFromQuery(op));
      case 'not': return this.extractTermsFromQuery(query.operand);
      case 'fuzzy': return [query.term];
      case 'level': return [query.level];
      case 'field': return [query.value];
      default: return [];
    }
  }

  /** Jaro-Winkler similarity (0–1) for fuzzy term matching */
  private jaroWinkler(s1: string, s2: string): number {
    if (s1 === s2) return 1;
    const len1 = s1.length;
    const len2 = s2.length;
    const matchDist = Math.floor(Math.max(len1, len2) / 2) - 1;
    if (matchDist < 0) return 0;

    const s1Matches = new Array(len1).fill(false);
    const s2Matches = new Array(len2).fill(false);
    let matches = 0;
    let transpositions = 0;

    for (let i = 0; i < len1; i++) {
      const start = Math.max(0, i - matchDist);
      const end = Math.min(i + matchDist + 1, len2);
      for (let j = start; j < end; j++) {
        if (s2Matches[j] || s1[i] !== s2[j]) continue;
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0;

    let k = 0;
    for (let i = 0; i < len1; i++) {
      if (!s1Matches[i]) continue;
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }

    const jaro =
      (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

    // Winkler prefix bonus
    let prefix = 0;
    for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
      if (s1[i] === s2[i]) prefix++;
      else break;
    }

    return jaro + prefix * 0.1 * (1 - jaro);
  }
}
