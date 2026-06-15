/**
 * QueryEngine.ts
 * Full-featured query parser that converts query strings into ParsedQuery trees.
 *
 * Supported syntax:
 *   Simple:   "error"
 *   Phrase:   "\"connection refused\""
 *   AND:      "error AND timeout"
 *   OR:       "error OR warning"
 *   NOT:      "error NOT 404"
 *   Regex:    "/error [45]\d{2}/"  or  --regex flag
 *   Fuzzy:    "~eror"  (threshold default 0.85)
 *   Level:    "level:ERROR"
 *   Field:    "status:500"
 */

import type {
  ParsedQuery,
  SimpleQuery,
  PhraseQuery,
  AndQuery,
  OrQuery,
  NotQuery,
  RegexQuery,
  FuzzyQuery,
  LevelQuery,
  FieldQuery,
} from '../types/SearchTypes';

export interface ParseOptions {
  ignoreCase?: boolean;
  isRegex?: boolean;
}

export class QueryParser {
  /**
   * Parse a query string into a ParsedQuery tree.
   */
  parse(query: string, options: ParseOptions = {}): ParsedQuery {
    const raw = query.trim();

    // ── Explicit regex flag ─────────────────────────────────────────────────
    if (options.isRegex) {
      return this.buildRegex(raw, options.ignoreCase ?? true);
    }

    // ── Regex literal: /pattern/flags ───────────────────────────────────────
    const regexLiteral = raw.match(/^\/(.+)\/([gimsuy]*)$/);
    if (regexLiteral) {
      try {
        const flags = (options.ignoreCase ? 'i' : '') + regexLiteral[2].replace(/i/g, '');
        return {
          type: 'regex',
          raw,
          pattern: new RegExp(regexLiteral[1], flags),
        } as RegexQuery;
      } catch {
        // Fall through to simple parse
      }
    }

    // ── Tokenize ─────────────────────────────────────────────────────────────
    return this.parseExpression(raw);
  }

  // ─── Recursive Descent Parser ─────────────────────────────────────────────

  private parseExpression(input: string): ParsedQuery {
    const raw = input.trim();

    // Split on top-level AND / OR (not inside quotes)
    const orParts = this.splitTopLevel(raw, ' OR ');
    if (orParts.length > 1) {
      return {
        type: 'or',
        raw,
        operands: orParts.map((p) => this.parseExpression(p)),
      } as OrQuery;
    }

    const andParts = this.splitTopLevel(raw, ' AND ');
    if (andParts.length > 1) {
      return {
        type: 'and',
        raw,
        operands: andParts.map((p) => this.parseExpression(p)),
      } as AndQuery;
    }

    // Split on top-level NOT
    const notParts = this.splitTopLevel(raw, ' NOT ');
    if (notParts.length === 2) {
      return {
        type: 'and',
        raw,
        operands: [
          this.parseExpression(notParts[0]),
          {
            type: 'not',
            raw: notParts[1],
            operand: this.parseExpression(notParts[1]),
          } as NotQuery,
        ],
      } as AndQuery;
    }

    return this.parseAtom(raw);
  }

  private parseAtom(raw: string): ParsedQuery {
    const trimmed = raw.trim();

    // Phrase query: "exact phrase"
    if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length > 2) {
      const phrase = trimmed.slice(1, -1);
      const terms = phrase.split(/\s+/).filter(Boolean);
      if (terms.length === 1) {
        return { type: 'simple', raw, term: terms[0].toLowerCase() } as SimpleQuery;
      }
      return {
        type: 'phrase',
        raw,
        phrase,
        terms: terms.map((t) => t.toLowerCase()),
      } as PhraseQuery;
    }

    // Fuzzy: ~term
    if (trimmed.startsWith('~') && trimmed.length > 1) {
      const fuzzyPart = trimmed.slice(1);
      const colonIdx = fuzzyPart.lastIndexOf(':');
      let term = fuzzyPart;
      let threshold = 0.85;

      if (colonIdx !== -1) {
        const t = parseFloat(fuzzyPart.slice(colonIdx + 1));
        if (!isNaN(t) && t >= 0 && t <= 1) {
          term = fuzzyPart.slice(0, colonIdx);
          threshold = t;
        }
      }

      return { type: 'fuzzy', raw, term: term.toLowerCase(), threshold } as FuzzyQuery;
    }

    // Field query: field:value  (e.g., level:ERROR, status:500)
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0 && colonIdx < trimmed.length - 1) {
      const field = trimmed.slice(0, colonIdx).toLowerCase().trim();
      const value = trimmed.slice(colonIdx + 1).trim().replace(/^"|"$/g, '');

      if (field === 'level' || field === 'severity') {
        return {
          type: 'level',
          raw,
          level: value.toUpperCase() as any,
        } as LevelQuery;
      }

      return { type: 'field', raw, field, value } as FieldQuery;
    }

    // Parenthesized expression
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      return this.parseExpression(trimmed.slice(1, -1));
    }

    // Simple term
    return { type: 'simple', raw, term: trimmed.toLowerCase() } as SimpleQuery;
  }

  /**
   * Split a string by `separator` at the top level (not inside quotes or parens).
   */
  private splitTopLevel(input: string, separator: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let inQuote = false;
    let current = '';
    let i = 0;

    while (i < input.length) {
      const char = input[i];

      if (char === '"') {
        inQuote = !inQuote;
        current += char;
        i++;
        continue;
      }

      if (!inQuote) {
        if (char === '(') depth++;
        if (char === ')') depth--;

        if (depth === 0 && input.slice(i).startsWith(separator)) {
          parts.push(current.trim());
          current = '';
          i += separator.length;
          continue;
        }
      }

      current += char;
      i++;
    }

    if (current.trim()) parts.push(current.trim());
    return parts;
  }

  private buildRegex(pattern: string, ignoreCase: boolean): RegexQuery {
    const flags = ignoreCase ? 'gi' : 'g';
    let regex: RegExp;
    try {
      regex = new RegExp(pattern, flags);
    } catch {
      // Escape and retry as literal
      regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    }
    return { type: 'regex', raw: pattern, pattern: regex };
  }
}
