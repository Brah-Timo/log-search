/**
 * RankEngine.ts
 * Scores and ranks search results using BM25-simplified scoring.
 * Higher score = more relevant result.
 */

import type { SearchResult, ParsedQuery } from '../../types/SearchTypes';

// BM25 tuning constants
const K1 = 1.5;  // term frequency saturation
const B = 0.75;  // length normalization

export class RankEngine {
  private avgLineLength: number;

  constructor(avgLineLength: number = 200) {
    this.avgLineLength = avgLineLength;
  }

  /**
   * Score a single line for BM25 relevance.
   * @param line     The line content
   * @param terms    The search terms
   */
  score(line: string, terms: string[]): number {
    if (terms.length === 0) return 0;

    const lower = line.toLowerCase();
    const lineLength = line.length;
    let totalScore = 0;

    for (const term of terms) {
      const tf = this.countOccurrences(lower, term.toLowerCase());
      if (tf === 0) continue;

      // BM25 term frequency component
      const tfNorm =
        (tf * (K1 + 1)) /
        (tf + K1 * (1 - B + B * (lineLength / this.avgLineLength)));

      totalScore += tfNorm;
    }

    return totalScore;
  }

  /**
   * Re-score and sort a list of SearchResults by relevance.
   */
  rankResults(results: SearchResult[], query: ParsedQuery): SearchResult[] {
    const terms = this.extractTerms(query);
    if (terms.length === 0) return results;

    return results
      .map((r) => ({ ...r, matchScore: this.score(r.content, terms) }))
      .sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Count non-overlapping occurrences of `term` in `text`.
   */
  private countOccurrences(text: string, term: string): number {
    if (!term) return 0;
    let count = 0;
    let idx = 0;
    while ((idx = text.indexOf(term, idx)) !== -1) {
      count++;
      idx += term.length;
    }
    return count;
  }

  /**
   * Extract all search terms from a parsed query tree.
   */
  private extractTerms(query: ParsedQuery): string[] {
    switch (query.type) {
      case 'simple':
        return [query.term];
      case 'phrase':
        return query.terms;
      case 'and':
      case 'or':
        return query.operands.flatMap((op) => this.extractTerms(op));
      case 'not':
        return this.extractTerms(query.operand);
      case 'fuzzy':
        return [query.term];
      case 'level':
        return [query.level];
      case 'field':
        return [query.value];
      default:
        return [];
    }
  }
}
