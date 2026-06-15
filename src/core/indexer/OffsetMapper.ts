/**
 * OffsetMapper.ts
 * Maintains the mapping between line numbers and their byte offsets in the file.
 * This is the core structure that enables O(1) line retrieval by position.
 */

export class OffsetMapper {
  /** Sorted array of byte offsets, index = lineNumber - 1 */
  private lineOffsets: number[] = [];

  constructor(initialOffsets: number[] = []) {
    this.lineOffsets = [...initialOffsets];
  }

  /**
   * Record the byte offset of a new line.
   */
  addOffset(byteOffset: number): void {
    this.lineOffsets.push(byteOffset);
  }

  /**
   * Bulk add offsets (more efficient than individual adds).
   */
  addOffsets(offsets: number[]): void {
    for (const o of offsets) {
      this.lineOffsets.push(o);
    }
  }

  /**
   * Get the byte offset of a specific line (1-based).
   */
  getOffset(lineNumber: number): number | undefined {
    return this.lineOffsets[lineNumber - 1];
  }

  /**
   * Find the 1-based line number for a given byte offset using binary search.
   * Returns the line number, or -1 if not found.
   */
  findLineNumber(byteOffset: number): number {
    const arr = this.lineOffsets;
    let lo = 0;
    let hi = arr.length - 1;

    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (arr[mid] === byteOffset) return mid + 1;
      if (arr[mid] < byteOffset) lo = mid + 1;
      else hi = mid - 1;
    }

    // Return the closest line (lo is the insertion point)
    return Math.min(lo + 1, arr.length);
  }

  /**
   * Get the total number of lines tracked.
   */
  get totalLines(): number {
    return this.lineOffsets.length;
  }

  /**
   * Get the raw offsets array (for serialization).
   */
  toArray(): number[] {
    return [...this.lineOffsets];
  }

  /**
   * Merge another OffsetMapper into this one (for combining chunk results).
   * The other mapper's offsets are appended (assumed to come after current ones).
   */
  merge(other: OffsetMapper): void {
    this.addOffsets(other.toArray());
  }

  /**
   * Sort offsets (needed after merging multiple chunks).
   */
  sort(): void {
    this.lineOffsets.sort((a, b) => a - b);
  }

  /**
   * Get a slice of offsets around a given byte offset (for context lines).
   * @param byteOffset  The central line's byte offset
   * @param before      Number of lines to include before
   * @param after       Number of lines to include after
   */
  getContext(
    byteOffset: number,
    before: number,
    after: number
  ): { beforeOffsets: number[]; afterOffsets: number[] } {
    const lineIdx = this.findLineNumber(byteOffset) - 1; // 0-based index
    const beforeOffsets = this.lineOffsets.slice(
      Math.max(0, lineIdx - before),
      lineIdx
    );
    const afterOffsets = this.lineOffsets.slice(
      lineIdx + 1,
      lineIdx + 1 + after
    );
    return { beforeOffsets, afterOffsets };
  }
}
