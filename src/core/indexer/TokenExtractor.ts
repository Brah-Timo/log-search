/**
 * TokenExtractor.ts
 * Extracts normalized tokens (terms) from a log line for indexing.
 * Handles deduplication, normalization, and stop-word filtering.
 */

const DEFAULT_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'can', 'it', 'its', 'that', 'this',
]);

// Matches tokens: words, IP-like segments, version numbers, HTTP codes, etc.
const TOKEN_REGEX = /[\w.\-/]+/g;

export class TokenExtractor {
  private minLength: number;
  private stopWords: Set<string>;
  private includeTimestamps: boolean;

  constructor(options: {
    minLength?: number;
    stopWords?: string[];
    includeTimestamps?: boolean;
  } = {}) {
    this.minLength = options.minLength ?? 2;
    this.stopWords = new Set([
      ...DEFAULT_STOP_WORDS,
      ...(options.stopWords ?? []),
    ]);
    this.includeTimestamps = options.includeTimestamps ?? true;
  }

  /**
   * Extract all unique tokens from a single line.
   * Returns a Set of normalized lowercase tokens.
   */
  extract(line: string): Set<string> {
    const tokens = new Set<string>();
    const matches = line.matchAll(TOKEN_REGEX);

    for (const match of matches) {
      const raw = match[0];

      // Skip very short tokens
      if (raw.length < this.minLength) continue;

      const token = raw.toLowerCase();

      // Skip stop words (for non-technical tokens only)
      if (this.stopWords.has(token)) continue;

      // Skip pure punctuation / single chars
      if (/^[.\-/\\]+$/.test(token)) continue;

      tokens.add(token);

      // Also index sub-tokens split by common delimiters for partial matching
      // e.g. "GET /api/users" → also indexes "api", "users"
      this.addSubTokens(raw, tokens);
    }

    return tokens;
  }

  /**
   * Break compound tokens into sub-tokens for better searchability.
   * e.g. "192.168.1.1" → "192", "168"
   *      "/api/v2/users" → "api", "v2", "users"
   */
  private addSubTokens(raw: string, tokens: Set<string>): void {
    // Split on / for URLs and paths
    if (raw.includes('/')) {
      for (const part of raw.split('/')) {
        if (part.length >= this.minLength) {
          tokens.add(part.toLowerCase());
        }
      }
    }

    // Split on . for IPs and dotted names (but not file extensions)
    if (raw.includes('.') && !raw.startsWith('.')) {
      const parts = raw.split('.');
      // Only index sub-tokens if it looks like an IP or dotted path (not filename)
      if (parts.length >= 3 && parts.every((p) => p.length >= 1)) {
        for (const part of parts) {
          if (part.length >= this.minLength && !/^\d+$/.test(part)) {
            tokens.add(part.toLowerCase());
          }
        }
      }
    }

    // Split on - for kebab-case identifiers
    if (raw.includes('-') && raw.length > 4) {
      for (const part of raw.split('-')) {
        if (part.length >= this.minLength && !this.stopWords.has(part.toLowerCase())) {
          tokens.add(part.toLowerCase());
        }
      }
    }
  }
}
