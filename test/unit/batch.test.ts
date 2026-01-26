import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RateLimitError } from '../../src/errors.js';
import { type BatchResult, batch, batchAll } from '../../src/helpers/batch.js';

describe('batch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('processes all items in sequence', async () => {
    const items = [1, 2, 3];
    const processor = vi.fn().mockImplementation(async (n: number) => n * 2);

    const results: Array<BatchResult<number, number>> = [];

    // Use real timers for this test since we're not testing delays
    vi.useRealTimers();

    for await (const result of batch(items, processor, { delayMs: 0 })) {
      results.push(result);
    }

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ item: 1, result: 2 });
    expect(results[1]).toEqual({ item: 2, result: 4 });
    expect(results[2]).toEqual({ item: 3, result: 6 });
    expect(processor).toHaveBeenCalledTimes(3);
  });

  it('applies delay between items', async () => {
    const items = ['a', 'b'];
    const processor = vi.fn().mockResolvedValue('ok');

    const generator = batch(items, processor, { delayMs: 100 });
    const iterator = generator[Symbol.asyncIterator]();

    // First item - no delay
    const first = iterator.next();
    await vi.advanceTimersByTimeAsync(0);
    await first;

    // Second item - should have 100ms delay
    const secondPromise = iterator.next();

    // Advance past the delay
    await vi.advanceTimersByTimeAsync(100);
    await secondPromise;

    expect(processor).toHaveBeenCalledTimes(2);
  });

  it('captures errors without stopping iteration', async () => {
    const items = [1, 2, 3];
    const error = new Error('Processing failed');
    const processor = vi
      .fn()
      .mockResolvedValueOnce('ok')
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('ok');

    vi.useRealTimers();

    const results: Array<BatchResult<number, string>> = [];
    for await (const result of batch(items, processor, { delayMs: 0 })) {
      results.push(result);
    }

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ item: 1, result: 'ok' });
    expect(results[1]).toEqual({ item: 2, error });
    expect(results[2]).toEqual({ item: 3, result: 'ok' });
  });

  it('handles rate limit errors with retry', async () => {
    const items = [1];
    const rateLimitError = new RateLimitError('Too many requests', 500);
    const processor = vi
      .fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce('success');

    const generator = batch(items, processor, { delayMs: 0, handleRateLimit: true });
    const iterator = generator[Symbol.asyncIterator]();

    const resultPromise = iterator.next();

    // Advance past the retry wait time
    await vi.advanceTimersByTimeAsync(500);
    const { value: result } = await resultPromise;

    expect(result).toEqual({ item: 1, result: 'success' });
    expect(processor).toHaveBeenCalledTimes(2);
  });

  it('respects maxRateLimitRetries', async () => {
    const items = [1];
    const rateLimitError = new RateLimitError('Too many requests', 100);
    const processor = vi.fn().mockRejectedValue(rateLimitError);

    const generator = batch(items, processor, {
      delayMs: 0,
      handleRateLimit: true,
      maxRateLimitRetries: 2,
    });
    const iterator = generator[Symbol.asyncIterator]();

    const resultPromise = iterator.next();

    // Advance through all retries (2 retries = 2 * 100ms)
    await vi.advanceTimersByTimeAsync(200);
    const { value: result } = await resultPromise;

    // Should have tried 3 times (initial + 2 retries) then returned error
    expect(processor).toHaveBeenCalledTimes(3);
    expect(result.error).toBe(rateLimitError);
  });

  it('uses default retryAfter when not provided', async () => {
    const items = [1];
    const rateLimitError = new RateLimitError('Too many requests'); // No retryAfter
    const processor = vi
      .fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce('success');

    const generator = batch(items, processor, { delayMs: 0, handleRateLimit: true });
    const iterator = generator[Symbol.asyncIterator]();

    const resultPromise = iterator.next();

    // Default is 1000ms
    await vi.advanceTimersByTimeAsync(1000);
    const { value: result } = await resultPromise;

    expect(result).toEqual({ item: 1, result: 'success' });
  });

  it('does not retry rate limits when handleRateLimit is false', async () => {
    const items = [1];
    const rateLimitError = new RateLimitError('Too many requests', 100);
    const processor = vi.fn().mockRejectedValue(rateLimitError);

    vi.useRealTimers();

    const results: Array<BatchResult<number, string>> = [];
    for await (const result of batch(items, processor, { delayMs: 0, handleRateLimit: false })) {
      results.push(result);
    }

    expect(processor).toHaveBeenCalledTimes(1);
    expect(results[0].error).toBe(rateLimitError);
  });

  it('accepts async iterables as input', async () => {
    async function* asyncItems() {
      yield 1;
      yield 2;
    }

    const processor = vi.fn().mockImplementation(async (n: number) => n * 10);

    vi.useRealTimers();

    const results: Array<BatchResult<number, number>> = [];
    for await (const result of batch(asyncItems(), processor, { delayMs: 0 })) {
      results.push(result);
    }

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ item: 1, result: 10 });
    expect(results[1]).toEqual({ item: 2, result: 20 });
  });

  it('converts non-Error throws to Error objects', async () => {
    const items = [1];
    const processor = vi.fn().mockRejectedValue('string error');

    vi.useRealTimers();

    const results: Array<BatchResult<number, string>> = [];
    for await (const result of batch(items, processor, { delayMs: 0 })) {
      results.push(result);
    }

    expect(results[0].error).toBeInstanceOf(Error);
    expect(results[0].error?.message).toBe('string error');
  });
});

describe('batchAll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('collects all successful results', async () => {
    const items = [1, 2, 3];
    const processor = vi.fn().mockImplementation(async (n: number) => n * 2);

    vi.useRealTimers();
    const results = await batchAll(items, processor, { delayMs: 0 });

    expect(results).toEqual([2, 4, 6]);
  });

  it('throws on first error by default', async () => {
    const items = [1, 2, 3];
    const error = new Error('Failed on 2');
    const processor = vi
      .fn()
      .mockResolvedValueOnce('ok')
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('ok');

    vi.useRealTimers();

    await expect(batchAll(items, processor, { delayMs: 0 })).rejects.toThrow('Failed on 2');
  });

  it('continues on error when continueOnError is true', async () => {
    const items = [1, 2, 3];
    const error = new Error('Failed on 2');
    const processor = vi
      .fn()
      .mockResolvedValueOnce('result1')
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('result3');

    vi.useRealTimers();

    const results = await batchAll(items, processor, { delayMs: 0, continueOnError: true });

    // Only successful results are collected
    expect(results).toEqual(['result1', 'result3']);
  });

  it('handles empty array', async () => {
    const processor = vi.fn();

    vi.useRealTimers();
    const results = await batchAll([], processor, { delayMs: 0 });

    expect(results).toEqual([]);
    expect(processor).not.toHaveBeenCalled();
  });

  it('passes options to batch', async () => {
    const items = [1];
    const rateLimitError = new RateLimitError('Rate limited', 100);
    const processor = vi
      .fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce('success');

    const resultPromise = batchAll(items, processor, {
      delayMs: 0,
      handleRateLimit: true,
    });

    // Advance past rate limit wait
    await vi.advanceTimersByTimeAsync(100);
    const results = await resultPromise;

    expect(results).toEqual(['success']);
    expect(processor).toHaveBeenCalledTimes(2);
  });
});
