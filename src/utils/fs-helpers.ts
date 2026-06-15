/**
 * fs-helpers.ts
 * File system utility functions.
 */

import { stat, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import * as os from 'os';

export async function fileExists(filePath: string): Promise<boolean> {
  try { await stat(filePath); return true; } catch { return false; }
}

export async function getFileSize(filePath: string): Promise<number> {
  try { return (await stat(filePath)).size; } catch { return 0; }
}

export function getLogSearchDir(): string {
  return path.join(os.homedir(), '.log-search');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
