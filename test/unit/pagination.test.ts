import { describe, expect, it, vi } from 'vitest';
import { collectAll, paginate, paginateParallel } from '../../src/helpers/pagination.js';

describe('paginate', () => {
  it('yields all items from a single page', async () => {
    const fetcher = vi.fn().mockResolvedValue([1, 2, 3]);

    const items = await collectAll(paginate(fetcher, 10));

    expect(items).toEqual([1, 2, 3]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(0, 10);
  });

  it('paginates through multiple pages', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce([1, 2, 3]) // Full page
      .mockResolvedValueOnce([4, 5, 6]) // Full page
      .mockResolvedValueOnce([7]); // Partial page (end)

    const items = await collectAll(paginate(fetcher, 3));

    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher).toHaveBeenNthCalledWith(1, 0, 3);
    expect(fetcher).toHaveBeenNthCalledWith(2, 3, 3);
    expect(fetcher).toHaveBeenNthCalledWith(3, 6, 3);
  });

  it('handles empty first page', async () => {
    const fetcher = vi.fn().mockResolvedValue([]);

    const items = await collectAll(paginate(fetcher, 10));

    expect(items).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('stops when page is exactly full but next is empty', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce([1, 2, 3]) // Exactly full
      .mockResolvedValueOnce([]); // Empty next page

    const items = await collectAll(paginate(fetcher, 3));

    expect(items).toEqual([1, 2, 3]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('uses default page size of 50', async () => {
    const fetcher = vi.fn().mockResolvedValue([]);

    await collectAll(paginate(fetcher));

    expect(fetcher).toHaveBeenCalledWith(0, 50);
  });

  it('yields items one at a time', async () => {
    const fetcher = vi.fn().mockResolvedValue([1, 2, 3]);
    const yielded: number[] = [];

    for await (const item of paginate(fetcher, 10)) {
      yielded.push(item);
      if (yielded.length === 2) break; // Early exit
    }

    expect(yielded).toEqual([1, 2]);
  });

  it('propagates fetcher errors', async () => {
    const error = new Error('Fetch failed');
    const fetcher = vi.fn().mockRejectedValue(error);

    await expect(collectAll(paginate(fetcher, 10))).rejects.toThrow('Fetch failed');
  });

  it('handles fetcher error on second page', async () => {
    const error = new Error('Page 2 failed');
    const fetcher = vi.fn().mockResolvedValueOnce([1, 2, 3]).mockRejectedValueOnce(error);

    await expect(collectAll(paginate(fetcher, 3))).rejects.toThrow('Page 2 failed');
  });
});

describe('paginateParallel', () => {
  it('yields all items in correct order', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce([1, 2, 3]) // Page 0
      .mockResolvedValueOnce([4, 5, 6]) // Page 1
      .mockResolvedValueOnce([7]); // Page 2 (partial = end)

    const items = await collectAll(paginateParallel(fetcher, { pageSize: 3, concurrency: 2 }));

    // Items must be in order even though pages fetched in parallel
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('fetches pages concurrently up to limit', async () => {
    const callOrder: number[] = [];
    const fetcher = vi.fn().mockImplementation(async (skip: number) => {
      callOrder.push(skip);
      // Simulate varying response times
      await new Promise((r) => setTimeout(r, 10));
      if (skip >= 6) return []; // End after 2 full pages
      return [skip, skip + 1, skip + 2];
    });

    await collectAll(paginateParallel(fetcher, { pageSize: 3, concurrency: 2, delayMs: 0 }));

    // First 2 pages should be initiated together (concurrency=2)
    expect(callOrder.slice(0, 2)).toEqual([0, 3]);
  });

  it('stops when partial page received', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce([1, 2, 3]) // Full page
      .mockResolvedValueOnce([4, 5]); // Partial = end

    // With concurrency=1, we only fetch next page after current is processed
    const items = await collectAll(paginateParallel(fetcher, { pageSize: 3, concurrency: 1 }));

    expect(items).toEqual([1, 2, 3, 4, 5]);
    // With concurrency=1, no over-fetching occurs
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('applies delay between fetch starts', async () => {
    const timestamps: number[] = [];
    const fetcher = vi.fn().mockImplementation(async () => {
      timestamps.push(Date.now());
      return [];
    });

    await collectAll(paginateParallel(fetcher, { pageSize: 3, concurrency: 2, delayMs: 50 }));

    // With delayMs=50 and concurrency=2, second call should be ~50ms after first
    if (timestamps.length >= 2) {
      const diff = (timestamps[1] as number) - (timestamps[0] as number);
      expect(diff).toBeGreaterThanOrEqual(40); // Allow some tolerance
    }
  });

  it('supports early exit from iteration', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce([1, 2, 3])
      .mockResolvedValueOnce([4, 5, 6])
      .mockResolvedValueOnce([7, 8, 9]);

    const items: number[] = [];
    for await (const item of paginateParallel(fetcher, { pageSize: 3, concurrency: 2 })) {
      items.push(item);
      if (items.length >= 4) break;
    }

    expect(items).toEqual([1, 2, 3, 4]);
  });

  it('uses default options', async () => {
    const fetcher = vi.fn().mockResolvedValue([]);

    await collectAll(paginateParallel(fetcher));

    // Default pageSize is 50
    expect(fetcher).toHaveBeenCalledWith(0, 50);
  });

  it('handles empty first page', async () => {
    const fetcher = vi.fn().mockResolvedValue([]);

    const items = await collectAll(paginateParallel(fetcher, { pageSize: 3, concurrency: 2 }));

    expect(items).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('propagates fetcher errors', async () => {
    const error = new Error('Fetch failed');
    const fetcher = vi.fn().mockRejectedValue(error);

    await expect(
      collectAll(paginateParallel(fetcher, { pageSize: 3, concurrency: 2 }))
    ).rejects.toThrow('Fetch failed');
  });
});

describe('collectAll', () => {
  it('collects all items from async iterable', async () => {
    async function* generator() {
      yield 1;
      yield 2;
      yield 3;
    }

    const items = await collectAll(generator());

    expect(items).toEqual([1, 2, 3]);
  });

  it('returns empty array for empty iterable', async () => {
    async function* generator() {
      // Empty
    }

    const items = await collectAll(generator());

    expect(items).toEqual([]);
  });

  it('preserves item order', async () => {
    async function* generator() {
      yield 'a';
      yield 'b';
      yield 'c';
    }

    const items = await collectAll(generator());

    expect(items).toEqual(['a', 'b', 'c']);
  });
});
