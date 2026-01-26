import { describe, expect, it, vi } from 'vitest';
import {
  FirefliesError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
} from '../../src/errors.js';
import { calculateDelay, isRetryableError, retry } from '../../src/utils/retry.js';

describe('retry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await retry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable error and succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new NetworkError('Connection failed'))
      .mockResolvedValue('success');

    const result = await retry(fn, { baseDelay: 1 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('exhausts retries and throws last error', async () => {
    const error = new NetworkError('Connection failed');
    const fn = vi.fn().mockRejectedValue(error);

    await expect(retry(fn, { maxRetries: 2, baseDelay: 1 })).rejects.toThrow('Connection failed');
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('does not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new NotFoundError('Not found'));

    await expect(retry(fn, { maxRetries: 3, baseDelay: 1 })).rejects.toThrow('Not found');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('respects custom shouldRetry predicate', async () => {
    const error = new NotFoundError('Custom retryable');
    const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('success');

    const result = await retry(fn, {
      baseDelay: 1,
      shouldRetry: (err) => err instanceof NotFoundError,
    });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries rate limit errors', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RateLimitError('Too many requests'))
      .mockResolvedValue('success');

    const result = await retry(fn, { baseDelay: 1 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries timeout errors', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TimeoutError('Request timed out'))
      .mockResolvedValue('success');

    const result = await retry(fn, { baseDelay: 1 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries server errors (5xx)', async () => {
    const error = new FirefliesError('Server error', { status: 503 });
    const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('success');

    const result = await retry(fn, { baseDelay: 1 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('isRetryableError', () => {
  it('returns true for RateLimitError', () => {
    expect(isRetryableError(new RateLimitError())).toBe(true);
  });

  it('returns true for TimeoutError', () => {
    expect(isRetryableError(new TimeoutError())).toBe(true);
  });

  it('returns true for NetworkError', () => {
    expect(isRetryableError(new NetworkError('Failed'))).toBe(true);
  });

  it('returns true for 5xx status errors', () => {
    expect(isRetryableError(new FirefliesError('Error', { status: 500 }))).toBe(true);
    expect(isRetryableError(new FirefliesError('Error', { status: 503 }))).toBe(true);
  });

  it('returns false for 4xx status errors', () => {
    expect(isRetryableError(new FirefliesError('Error', { status: 400 }))).toBe(false);
    expect(isRetryableError(new FirefliesError('Error', { status: 404 }))).toBe(false);
  });

  it('returns false for NotFoundError', () => {
    expect(isRetryableError(new NotFoundError())).toBe(false);
  });

  it('returns false for generic errors', () => {
    expect(isRetryableError(new Error('Generic'))).toBe(false);
  });
});

describe('calculateDelay', () => {
  it('uses retryAfter from RateLimitError when available', () => {
    const error = new RateLimitError('Rate limited', 5000); // 5000ms

    const delay = calculateDelay(error, 0, 1000, 30000);

    expect(delay).toBe(5000); // uses retryAfter directly (already in ms)
  });

  it('caps retryAfter at maxDelay', () => {
    const error = new RateLimitError('Rate limited', 60000); // 60000ms

    const delay = calculateDelay(error, 0, 1000, 30000);

    expect(delay).toBe(30000); // capped at maxDelay
  });

  it('uses exponential backoff for other errors', () => {
    const error = new NetworkError('Connection failed');

    // First attempt (attempt 0): baseDelay * 2^0 = 1000 (+ jitter)
    const delay0 = calculateDelay(error, 0, 1000, 30000);
    expect(delay0).toBeGreaterThanOrEqual(1000);
    expect(delay0).toBeLessThanOrEqual(1100); // max 10% jitter

    // Second attempt (attempt 1): baseDelay * 2^1 = 2000 (+ jitter)
    const delay1 = calculateDelay(error, 1, 1000, 30000);
    expect(delay1).toBeGreaterThanOrEqual(2000);
    expect(delay1).toBeLessThanOrEqual(2200);
  });

  it('caps exponential backoff at maxDelay', () => {
    const error = new NetworkError('Connection failed');

    // Attempt 10: baseDelay * 2^10 = 1,024,000ms, should be capped
    const delay = calculateDelay(error, 10, 1000, 30000);

    expect(delay).toBe(30000);
  });
});
