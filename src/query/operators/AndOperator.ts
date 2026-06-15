/**
 * AndOperator.ts
 * Returns only lines that match ALL sub-queries.
 * Performs sorted-merge intersection for optimal performance.
 */

export class AndOperator {
  /**
   * Intersect multiple offset arrays.
   * All arrays must be sorted ascending.
   * Uses a merge-pointer approach — O(n) where n = sum of all list lengths.
   */
  static intersect(lists: number[][]): number[] {
    if (lists.length === 0) return [];
    if (lists.length === 1) return lists[0];

    // Sort by list length ascending (smallest first = fewest iterations)
    const sorted = [...lists].sort((a, b) => a.length - b.length);

    // Start with the smallest and progressively intersect
    let result = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      result = this.intersectTwo(result, sorted[i]);
      if (result.length === 0) return []; // Short-circuit
    }

    return result;
  }

  /**
   * Two-pointer intersection of two sorted arrays. O(n + m).
   */
  private static intersectTwo(a: number[], b: number[]): number[] {
    const result: number[] = [];
    let i = 0;
    let j = 0;

    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        result.push(a[i]);
        i++;
        j++;
      } else if (a[i] < b[j]) {
        i++;
      } else {
        j++;
      }
    }

    return result;
  }
}
