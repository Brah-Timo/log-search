/**
 * OrOperator.ts
 * Returns lines that match ANY of the sub-queries.
 * Performs a sorted merge union.
 */

export class OrOperator {
  /**
   * Union multiple sorted offset arrays into a single sorted, deduplicated array.
   * Uses a k-way merge — O(n log k) where n = total elements.
   */
  static union(lists: number[][]): number[] {
    if (lists.length === 0) return [];
    if (lists.length === 1) return [...lists[0]];

    const result = new Set<number>();
    for (const list of lists) {
      for (const offset of list) result.add(offset);
    }

    return [...result].sort((a, b) => a - b);
  }

  /**
   * Merge two sorted arrays into a sorted, deduplicated array. O(n + m).
   */
  static mergeTwo(a: number[], b: number[]): number[] {
    const result: number[] = [];
    let i = 0;
    let j = 0;

    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        result.push(a[i]);
        i++;
        j++;
      } else if (a[i] < b[j]) {
        result.push(a[i++]);
      } else {
        result.push(b[j++]);
      }
    }

    while (i < a.length) result.push(a[i++]);
    while (j < b.length) result.push(b[j++]);

    return result;
  }
}
