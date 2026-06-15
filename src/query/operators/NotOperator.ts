/**
 * NotOperator.ts
 * Returns lines from `all` that are NOT in `excluded`.
 * Uses a sorted set-difference approach.
 */

export class NotOperator {
  /**
   * Set-difference: all offsets in `universe` that are NOT in `excluded`.
   * Both arrays must be sorted ascending.
   * O(n + m) time, O(n) space.
   */
  static subtract(universe: number[], excluded: number[]): number[] {
    if (excluded.length === 0) return [...universe];
    if (universe.length === 0) return [];

    const excludedSet = new Set(excluded);
    return universe.filter((o) => !excludedSet.has(o));
  }

  /**
   * Faster version when both arrays are sorted: two-pointer approach.
   * O(n + m) time, O(1) extra space (beyond output).
   */
  static subtractSorted(universe: number[], excluded: number[]): number[] {
    const result: number[] = [];
    let i = 0;
    let j = 0;

    while (i < universe.length) {
      while (j < excluded.length && excluded[j] < universe[i]) j++;

      if (j >= excluded.length || excluded[j] !== universe[i]) {
        result.push(universe[i]);
      }
      i++;
    }

    return result;
  }
}
