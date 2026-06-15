/**
 * RegexMatcher.ts
 * Applies a compiled regex against a collection of lines.
 * Used as a post-filter after index lookup or for full regex scans.
 */

export class RegexMatcher {
  private regex: RegExp;

  constructor(pattern: string | RegExp, ignoreCase: boolean = true) {
    if (pattern instanceof RegExp) {
      this.regex = pattern;
    } else {
      const flags = ignoreCase ? 'gi' : 'g';
      this.regex = new RegExp(pattern, flags);
    }
  }

  /**
   * Test if a single line matches.
   */
  test(line: string): boolean {
    this.regex.lastIndex = 0;
    return this.regex.test(line);
  }

  /**
   * Find all match positions in a line.
   * Returns array of [start, end] pairs.
   */
  findAll(line: string): Array<[number, number]> {
    this.regex.lastIndex = 0;
    const positions: Array<[number, number]> = [];
    let match: RegExpExecArray | null;

    while ((match = this.regex.exec(line)) !== null) {
      positions.push([match.index, match.index + match[0].length]);
      if (!this.regex.global) break;
    }

    return positions;
  }

  /**
   * Filter a list of lines, returning indices (into `lines`) that match.
   */
  filterLines(lines: string[]): number[] {
    const indices: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (this.test(lines[i])) indices.push(i);
    }
    return indices;
  }

  /**
   * Filter offsets based on corresponding line content.
   */
  filterOffsets(offsets: number[], lines: string[]): number[] {
    return offsets.filter((_, i) => this.test(lines[i]));
  }

  /**
   * Validate a regex pattern string without throwing.
   */
  static isValid(pattern: string): boolean {
    try {
      new RegExp(pattern);
      return true;
    } catch {
      return false;
    }
  }
}
