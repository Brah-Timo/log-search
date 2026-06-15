/**
 * CacheManager.ts
 * LRU in-memory cache for loaded InvertedIndex objects.
 * Prevents reloading the same index from disk repeatedly.
 */

import type { InvertedIndex } from '../types/IndexTypes';

interface CacheEntry {
  index: InvertedIndex;
  indexPath: string;
  loadedAt: number;
  accessCount: number;
  lastAccessed: number;
}

export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;

  constructor(maxSize: number = 10) {
    this.maxSize = maxSize;
  }

  /**
   * Get a cached index by its index file path.
   */
  get(indexPath: string): InvertedIndex | null {
    const entry = this.cache.get(indexPath);
    if (!entry) return null;

    // Update LRU metadata
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    // Move to end (most recently used)
    this.cache.delete(indexPath);
    this.cache.set(indexPath, entry);

    return entry.index;
  }

  /**
   * Store an index in the cache.
   * Evicts the least recently used entry if at capacity.
   */
  set(indexPath: string, index: InvertedIndex): void {
    // Evict LRU if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(indexPath)) {
      const lruKey = this.cache.keys().next().value;
      if (lruKey) this.cache.delete(lruKey);
    }

    const entry: CacheEntry = {
      index,
      indexPath,
      loadedAt: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
    };

    this.cache.set(indexPath, entry);
  }

  /**
   * Remove a specific index from the cache.
   */
  evict(indexPath: string): boolean {
    return this.cache.delete(indexPath);
  }

  /**
   * Clear all cached indexes.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Check if an index is cached.
   */
  has(indexPath: string): boolean {
    return this.cache.has(indexPath);
  }

  /**
   * Get cache statistics.
   */
  stats(): {
    size: number;
    maxSize: number;
    entries: Array<{ indexPath: string; accessCount: number; loadedAt: string }>;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      entries: [...this.cache.values()].map((e) => ({
        indexPath: e.indexPath,
        accessCount: e.accessCount,
        loadedAt: new Date(e.loadedAt).toISOString(),
      })),
    };
  }
}
