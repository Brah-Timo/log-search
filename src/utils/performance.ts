/**
 * performance.ts
 * Timing and performance measurement utilities.
 */

export class PerfTimer {
  private start: number;
  private marks: Map<string, number> = new Map();

  constructor() {
    this.start = performance.now();
  }

  mark(name: string): void {
    this.marks.set(name, performance.now() - this.start);
  }

  elapsed(): number {
    return performance.now() - this.start;
  }

  elapsedMs(): string {
    const ms = this.elapsed();
    return ms < 1 ? `${(ms * 1000).toFixed(0)}μs` : `${ms.toFixed(1)}ms`;
  }

  report(): Record<string, number> {
    const result: Record<string, number> = { total: this.elapsed() };
    for (const [name, time] of this.marks) result[name] = time;
    return result;
  }
}
