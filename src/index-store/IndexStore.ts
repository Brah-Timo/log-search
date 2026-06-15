/**
 * IndexStore.ts
 * Manages the registry of built indexes.
 * Maps source file paths to their corresponding .lsi index paths.
 * Persists the registry to ~/.log-search/registry.json.
 */

import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { stat, mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { IndexSerializer } from '../core/indexer/IndexSerializer';
import { CacheManager } from './CacheManager';
import type { IndexInfo, InvertedIndex } from '../types/IndexTypes';

interface RegistryEntry {
  filePath: string;
  indexPath: string;
  builtAt: string;
  fileSize: number;
  totalLines: number;
}

interface Registry {
  version: number;
  entries: Record<string, RegistryEntry>; // key = hash of filePath
}

export class IndexStore {
  private registryPath: string;
  private registry: Registry | null = null;
  private serializer: IndexSerializer;
  private cache: CacheManager;

  constructor(cacheSize: number = 10) {
    const baseDir = path.join(os.homedir(), '.log-search');
    this.registryPath = path.join(baseDir, 'registry.json');
    this.serializer = new IndexSerializer();
    this.cache = new CacheManager(cacheSize);
  }

  // ─── Registry Operations ──────────────────────────────────────────────────

  /**
   * Load the registry from disk. Creates it if it doesn't exist.
   */
  async loadRegistry(): Promise<void> {
    try {
      const raw = await readFile(this.registryPath, 'utf8');
      this.registry = JSON.parse(raw) as Registry;
    } catch {
      this.registry = { version: 1, entries: {} };
    }
  }

  private async saveRegistry(): Promise<void> {
    const dir = path.dirname(this.registryPath);
    await mkdir(dir, { recursive: true });
    await writeFile(this.registryPath, JSON.stringify(this.registry, null, 2), 'utf8');
  }

  private fileKey(filePath: string): string {
    return crypto.createHash('md5').update(path.resolve(filePath)).digest('hex');
  }

  /**
   * Get the index path for a source file, or null if not indexed.
   */
  async getIndexPath(filePath: string): Promise<string | null> {
    await this.ensureRegistryLoaded();
    const key = this.fileKey(filePath);
    const entry = this.registry!.entries[key];
    if (!entry) return null;

    // Verify the index file still exists
    const exists = await this.serializer.exists(entry.indexPath);
    if (!exists) {
      delete this.registry!.entries[key];
      await this.saveRegistry();
      return null;
    }

    return entry.indexPath;
  }

  /**
   * Register a new index for a source file.
   */
  async saveIndexPath(
    filePath: string,
    indexPath: string,
    meta?: { totalLines: number; fileSize: number }
  ): Promise<void> {
    await this.ensureRegistryLoaded();
    const key = this.fileKey(filePath);
    const fileStats = await stat(filePath);

    this.registry!.entries[key] = {
      filePath: path.resolve(filePath),
      indexPath,
      builtAt: new Date().toISOString(),
      fileSize: meta?.fileSize ?? fileStats.size,
      totalLines: meta?.totalLines ?? 0,
    };

    await this.saveRegistry();
  }

  /**
   * Remove an index entry from the registry.
   */
  async removeEntry(filePath: string): Promise<void> {
    await this.ensureRegistryLoaded();
    const key = this.fileKey(filePath);
    delete this.registry!.entries[key];
    this.cache.evict(filePath);
    await this.saveRegistry();
  }

  /**
   * List all registered indexes.
   */
  async listAll(): Promise<RegistryEntry[]> {
    await this.ensureRegistryLoaded();
    return Object.values(this.registry!.entries);
  }

  // ─── Index Loading with Cache ─────────────────────────────────────────────

  /**
   * Load an InvertedIndex, using the in-memory cache when available.
   */
  async loadIndex(indexPath: string): Promise<InvertedIndex> {
    // Check cache first
    const cached = this.cache.get(indexPath);
    if (cached) return cached;

    // Load from disk
    const index = await this.serializer.load(indexPath);
    this.cache.set(indexPath, index);
    return index;
  }

  // ─── Index Info ───────────────────────────────────────────────────────────

  /**
   * Get detailed info about a file's index.
   */
  async getIndexInfo(filePath: string): Promise<IndexInfo | null> {
    const indexPath = await this.getIndexPath(filePath);
    if (!indexPath) return null;

    const [fileStats, indexSizeBytes] = await Promise.all([
      stat(filePath).catch(() => null),
      this.serializer.getSize(indexPath),
    ]);

    const index = await this.loadIndex(indexPath);

    const fileSize = fileStats?.size ?? 0;
    const isStale = fileSize !== index.metadata.fileSize;

    return {
      indexPath,
      filePath: path.resolve(filePath),
      fileSize,
      indexSize: indexSizeBytes,
      totalLines: index.metadata.totalLines,
      uniqueTerms: index.metadata.uniqueTerms,
      builtAt: index.metadata.builtAt,
      compressionRatio: index.metadata.compressionRatio,
      isStale,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async ensureRegistryLoaded(): Promise<void> {
    if (!this.registry) await this.loadRegistry();
  }

  getCacheStats() {
    return this.cache.stats();
  }
}
