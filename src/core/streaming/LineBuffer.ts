/**
 * LineBuffer.ts
 * A buffered line reader that accumulates incoming data chunks
 * and emits complete lines. Handles multi-byte UTF-8 gracefully.
 */

export class LineBuffer {
  private buffer: string = '';
  private lineCallback: (line: string, lineNumber: number) => void;
  private lineNumber: number = 0;

  constructor(callback: (line: string, lineNumber: number) => void) {
    this.lineCallback = callback;
  }

  /**
   * Push a new data chunk into the buffer.
   * Emits complete lines via the callback.
   */
  push(chunk: string): void {
    this.buffer += chunk;

    let newlineIdx: number;
    while ((newlineIdx = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIdx).replace(/\r$/, '');
      this.buffer = this.buffer.slice(newlineIdx + 1);
      this.lineNumber++;
      this.lineCallback(line, this.lineNumber);
    }
  }

  /**
   * Flush any remaining buffered content as the last line.
   */
  flush(): void {
    if (this.buffer.length > 0) {
      this.lineNumber++;
      this.lineCallback(this.buffer.replace(/\r$/, ''), this.lineNumber);
      this.buffer = '';
    }
  }

  /**
   * Reset the buffer and line counter.
   */
  reset(): void {
    this.buffer = '';
    this.lineNumber = 0;
  }

  get currentLineNumber(): number {
    return this.lineNumber;
  }
}
