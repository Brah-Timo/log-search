/**
 * RangeOperator.ts
 * Filters a list of line contents by a value range (timestamps, HTTP status codes, etc.).
 */

export interface RangeFilter {
  field: 'timestamp' | 'status' | 'size' | 'custom';
  from?: string | number;
  to?: string | number;
}

export class RangeOperator {
  /**
   * Filter lines to those where the extracted field value falls within [from, to].
   * Returns the indices (into `lines`) that pass the filter.
   */
  static filterLines(
    lines: string[],
    offsets: number[],
    filter: RangeFilter
  ): number[] {
    const result: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      const value = this.extractField(lines[i], filter.field);
      if (value !== null && this.inRange(value, filter.from, filter.to)) {
        result.push(offsets[i]);
      }
    }

    return result;
  }

  /**
   * Filter by timestamp range (ISO date strings).
   */
  static filterByTimestamp(
    offsets: number[],
    lines: string[],
    since?: string,
    until?: string
  ): number[] {
    const sinceMs = since ? new Date(since).getTime() : 0;
    const untilMs = until ? new Date(until).getTime() : Infinity;

    const ISO_TS = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/;

    return offsets.filter((_, i) => {
      const match = lines[i].match(ISO_TS);
      if (!match) return true; // include if no timestamp found
      const ts = new Date(match[0]).getTime();
      return ts >= sinceMs && ts <= untilMs;
    });
  }

  private static extractField(line: string, field: string): number | null {
    switch (field) {
      case 'timestamp': {
        const m = line.match(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/);
        return m ? new Date(m[0]).getTime() : null;
      }
      case 'status': {
        const m = line.match(/"\s+(\d{3})\s+/);
        return m ? parseInt(m[1], 10) : null;
      }
      case 'size': {
        const m = line.match(/\s(\d+)$/);
        return m ? parseInt(m[1], 10) : null;
      }
      default:
        return null;
    }
  }

  private static inRange(
    value: number,
    from?: string | number,
    to?: string | number
  ): boolean {
    const lo = from !== undefined ? Number(from) : -Infinity;
    const hi = to !== undefined ? Number(to) : Infinity;
    return value >= lo && value <= hi;
  }
}
