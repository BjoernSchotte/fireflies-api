import { describe, expect, it, vi } from 'vitest';
import { collectAll, paginate } from '../../src/helpers/pagination.js';

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
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce([1, 2, 3])
      .mockRejectedValueOnce(error);

    await expect(collectAll(paginate(fetcher, 3))).rejects.toThrow('Page 2 failed');
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
