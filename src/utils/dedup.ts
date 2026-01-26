/**
 * Deduplicates items by a key.
 * Uses a sliding window to avoid unbounded memory growth.
 */
export class Deduplicator {
  private seen = new Set<string>();
  private queue: string[] = [];
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Check if item is a duplicate and mark as seen.
   * @param key - Unique key to check
   * @returns true if duplicate, false if new
   */
  isDuplicate(key: string): boolean {
    if (this.seen.has(key)) {
      return true;
    }

    this.seen.add(key);
    this.queue.push(key);

    // Evict oldest entries if over capacity
    while (this.queue.length > this.maxSize) {
      const oldest = this.queue.shift();
      if (oldest) this.seen.delete(oldest);
    }

    return false;
  }

  /**
   * Clear all tracked keys.
   */
  clear(): void {
    this.seen.clear();
    this.queue = [];
  }

  /**
   * Get current number of tracked keys.
   */
  get size(): number {
    return this.seen.size;
  }
}
