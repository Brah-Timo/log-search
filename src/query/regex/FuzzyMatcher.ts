/**
 * FuzzyMatcher.ts
 * Performs approximate string matching using Jaro-Winkler similarity.
 * Used for fuzzy search queries (e.g., ~"eror" finds "error").
 */

export class FuzzyMatcher {
  private term: string;
  private threshold: number;

  constructor(term: string, threshold: number = 0.85) {
    this.term = term.toLowerCase();
    this.threshold = threshold;
  }

  /**
   * Check if a line contains a token similar to the search term.
   */
  test(line: string): boolean {
    const tokens = line.toLowerCase().split(/\s+/);
    return tokens.some((token) => this.similarity(this.term, token) >= this.threshold);
  }

  /**
   * Find approximate matches in a line and return their positions.
   */
  findMatches(line: string): Array<{ token: string; score: number; start: number; end: number }> {
    const results: Array<{ token: string; score: number; start: number; end: number }> = [];
    const lower = line.toLowerCase();
    let idx = 0;

    for (const token of line.split(/(\s+)/)) {
      const score = this.similarity(this.term, token.toLowerCase().replace(/\W/g, ''));
      if (score >= this.threshold) {
        results.push({ token, score, start: idx, end: idx + token.length });
      }
      idx += token.length;
    }

    return results;
  }

  /**
   * Jaro-Winkler similarity between two strings.
   * Returns a value in [0, 1].
   */
  similarity(s1: string, s2: string): number {
    if (s1 === s2) return 1;
    if (!s1 || !s2) return 0;

    const len1 = s1.length;
    const len2 = s2.length;
    const matchDist = Math.max(Math.floor(Math.max(len1, len2) / 2) - 1, 0);

    const s1Matched = new Array(len1).fill(false);
    const s2Matched = new Array(len2).fill(false);
    let matches = 0;
    let transpositions = 0;

    for (let i = 0; i < len1; i++) {
      const start = Math.max(0, i - matchDist);
      const end = Math.min(i + matchDist + 1, len2);
      for (let j = start; j < end; j++) {
        if (s2Matched[j] || s1[i] !== s2[j]) continue;
        s1Matched[i] = true;
        s2Matched[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0;

    let k = 0;
    for (let i = 0; i < len1; i++) {
      if (!s1Matched[i]) continue;
      while (!s2Matched[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }

    const jaro =
      (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

    // Winkler prefix bonus (max 4 chars, 0.1 scale)
    let prefix = 0;
    const maxPrefix = Math.min(4, Math.min(len1, len2));
    for (let i = 0; i < maxPrefix && s1[i] === s2[i]; i++) prefix++;

    return jaro + prefix * 0.1 * (1 - jaro);
  }
}
