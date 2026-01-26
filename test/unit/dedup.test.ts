import { describe, expect, it } from 'vitest';
import { Deduplicator } from '../../src/utils/dedup.js';

describe('Deduplicator', () => {
  it('detects duplicate keys', () => {
    const dedup = new Deduplicator();

    expect(dedup.isDuplicate('a')).toBe(false);
    expect(dedup.isDuplicate('a')).toBe(true);
    expect(dedup.isDuplicate('b')).toBe(false);
    expect(dedup.isDuplicate('b')).toBe(true);
  });

  it('reports correct size', () => {
    const dedup = new Deduplicator();

    expect(dedup.size).toBe(0);
    dedup.isDuplicate('a');
    expect(dedup.size).toBe(1);
    dedup.isDuplicate('b');
    expect(dedup.size).toBe(2);
    dedup.isDuplicate('a'); // Duplicate, size unchanged
    expect(dedup.size).toBe(2);
  });

  it('clears all tracked keys', () => {
    const dedup = new Deduplicator();

    dedup.isDuplicate('a');
    dedup.isDuplicate('b');
    expect(dedup.size).toBe(2);

    dedup.clear();
    expect(dedup.size).toBe(0);

    // Keys should be fresh after clear
    expect(dedup.isDuplicate('a')).toBe(false);
    expect(dedup.isDuplicate('b')).toBe(false);
  });

  it('evicts oldest entries when over capacity', () => {
    const dedup = new Deduplicator(3);

    // Fill to capacity
    dedup.isDuplicate('a');
    dedup.isDuplicate('b');
    dedup.isDuplicate('c');
    expect(dedup.size).toBe(3);

    // Add one more, oldest ('a') should be evicted
    dedup.isDuplicate('d');
    expect(dedup.size).toBe(3);

    // 'b', 'c', 'd' should still be tracked (calling isDuplicate on them doesn't change the set)
    expect(dedup.isDuplicate('b')).toBe(true);
    expect(dedup.isDuplicate('c')).toBe(true);
    expect(dedup.isDuplicate('d')).toBe(true);

    // 'a' should have been evicted, so it's treated as new
    // Note: calling this will add 'a' back and evict 'b'
    expect(dedup.isDuplicate('a')).toBe(false);
  });

  it('maintains FIFO eviction order', () => {
    const dedup = new Deduplicator(3);

    dedup.isDuplicate('a');
    dedup.isDuplicate('b');
    dedup.isDuplicate('c');

    // Add new entries, evicting in FIFO order
    dedup.isDuplicate('d'); // evicts 'a', now: b, c, d
    dedup.isDuplicate('e'); // evicts 'b', now: c, d, e
    dedup.isDuplicate('f'); // evicts 'c', now: d, e, f

    // New entries should be duplicates (check these first before adding old ones back)
    expect(dedup.isDuplicate('d')).toBe(true);
    expect(dedup.isDuplicate('e')).toBe(true);
    expect(dedup.isDuplicate('f')).toBe(true);

    // Old entries should be gone (note: checking them will add them back)
    expect(dedup.isDuplicate('a')).toBe(false); // adds 'a', evicts 'd'
    expect(dedup.isDuplicate('b')).toBe(false); // adds 'b', evicts 'e'
    expect(dedup.isDuplicate('c')).toBe(false); // adds 'c', evicts 'f'
  });

  it('uses default max size of 1000', () => {
    const dedup = new Deduplicator();

    // Add 1001 items
    for (let i = 0; i < 1001; i++) {
      dedup.isDuplicate(`key-${i}`);
    }

    expect(dedup.size).toBe(1000);

    // First key should be evicted
    expect(dedup.isDuplicate('key-0')).toBe(false);

    // Key 1001 should be tracked (it was last added)
    expect(dedup.isDuplicate('key-1000')).toBe(true);
  });
});
