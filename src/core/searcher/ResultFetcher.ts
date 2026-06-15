/**
 * ResultFetcher.ts
 * Fetches the actual line content from the log file given byte offsets.
 * Uses direct seeks (random access) for maximum speed — no full file scan.
 */

import { open, FileHandle } from 'fs/promises';

const MAX_LINE_LENGTH = 64 * 1024; // 64KB max line length safety cap

export class ResultFetcher {
  private filePath: string;
  private fileHandle: FileHandle | null = null;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Open the file for reading. Call this once before fetchLines().
   */
  async open(): Promise<void> {
    if (!this.fileHandle) {
      this.fileHandle = await open(this.filePath, 'r');
    }
  }

  /**
   * Close the file handle. Call this when done fetching.
   */
  async close(): Promise<void> {
    if (this.fileHandle) {
      await this.fileHandle.close();
      this.fileHandle = null;
    }
  }

  /**
   * Fetch line content for each given byte offset.
   * Reads from each offset until the next '\n' (or EOF).
   * Processes offsets in sorted order for optimal disk I/O.
   *
   * @param offsets  Array of byte offsets (line starts)
   * @returns        Array of line strings, same order as input offsets
   */
  async fetchLines(offsets: number[]): Promise<string[]> {
    if (offsets.length === 0) return [];

    const wasOpen = this.fileHandle !== null;
    if (!wasOpen) await this.open();

    const fh = this.fileHandle!;

    // Build a map: offset → index in original array (to preserve order)
    const indexMap = new Map<number, number[]>();
    for (let i = 0; i < offsets.length; i++) {
      const arr = indexMap.get(offsets[i]);
      if (arr) arr.push(i);
      else indexMap.set(offsets[i], [i]);
    }

    // Sort unique offsets for sequential disk reads
    const uniqueOffsets = [...new Set(offsets)].sort((a, b) => a - b);
    const lineMap = new Map<number, string>();

    // Read each line
    const buffer = Buffer.allocUnsafe(MAX_LINE_LENGTH);
    for (const offset of uniqueOffsets) {
      const line = await this.readLineAt(fh, offset, buffer);
      lineMap.set(offset, line);
    }

    if (!wasOpen) await this.close();

    // Reconstruct result in original order
    return offsets.map((o) => lineMap.get(o) ?? '');
  }

  /**
   * Fetch a single line at the given byte offset.
   */
  async fetchLine(offset: number): Promise<string> {
    const wasOpen = this.fileHandle !== null;
    if (!wasOpen) await this.open();

    const buffer = Buffer.allocUnsafe(MAX_LINE_LENGTH);
    const line = await this.readLineAt(this.fileHandle!, offset, buffer);

    if (!wasOpen) await this.close();
    return line;
  }

  /**
   * Read a line starting at `offset` using the open file handle.
   * Reads in chunks until a newline is found.
   */
  private async readLineAt(
    fh: FileHandle,
    offset: number,
    buffer: Buffer
  ): Promise<string> {
    let position = offset;
    let lineData = '';
    const chunkSize = 4096;

    while (true) {
      const { bytesRead } = await fh.read(buffer, 0, Math.min(chunkSize, MAX_LINE_LENGTH), position);
      if (bytesRead === 0) break;

      const chunk = buffer.slice(0, bytesRead).toString('utf8');
      const newlineIdx = chunk.indexOf('\n');

      if (newlineIdx !== -1) {
        lineData += chunk.slice(0, newlineIdx);
        break;
      } else {
        lineData += chunk;
        position += bytesRead;

        // Safety cap
        if (lineData.length >= MAX_LINE_LENGTH) {
          lineData = lineData.slice(0, MAX_LINE_LENGTH);
          break;
        }
      }
    }

    // Strip trailing carriage return (Windows line endings)
    return lineData.replace(/\r$/, '');
  }
}
