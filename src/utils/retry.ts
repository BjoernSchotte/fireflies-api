import { NetworkError, RateLimitError, TimeoutError } from '../errors.js';

/**
 * Options for retry behavior.
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts.
   * @default 3
   */
  maxRetries?: number;

  /**
   * Base delay between retries in milliseconds.
   * @default 1000
   */
  baseDelay?: number;

  /**
   * Maximum delay between retries in milliseconds.
   * @default 30000
   */
  maxDelay?: number;

  /**
   * Custom predicate to determine if error is retryable.
   * By default, retries network errors, timeouts, and rate limits.
   */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry'>> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
};

/**
 * Execute a function with exponential backoff retry logic.
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration
 * @returns The result of the function
 * @throws The last error if all retries are exhausted
 */
export async function retry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const maxRetries = options?.maxRetries ?? DEFAULT_OPTIONS.maxRetries;
  const baseDelay = options?.baseDelay ?? DEFAULT_OPTIONS.baseDelay;
  const maxDelay = options?.maxDelay ?? DEFAULT_OPTIONS.maxDelay;
  const shouldRetry = options?.shouldRetry ?? isRetryableError;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= maxRetries || !shouldRetry(error, attempt)) {
        throw error;
      }

      const delay = calculateDelay(error, attempt, baseDelay, maxDelay);
      await sleep(delay);
    }
  }

  // This should never be reached due to the throw in the loop
  throw lastError;
}

/**
 * Default predicate for determining if an error is retryable.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof RateLimitError) {
    return true;
  }
  if (error instanceof TimeoutError) {
    return true;
  }
  if (error instanceof NetworkError) {
    return true;
  }
  // Retry on server errors (5xx)
  if (error instanceof Error && 'status' in error && typeof error.status === 'number') {
    return error.status >= 500 && error.status < 600;
  }
  return false;
}

/**
 * Calculate delay for the next retry attempt using exponential backoff.
 * Respects rate limit retryAfter if present.
 */
export function calculateDelay(
  error: unknown,
  attempt: number,
  baseDelay: number,
  maxDelay: number
): number {
  // Use rate limit's retryAfter if available (already in milliseconds)
  if (error instanceof RateLimitError && error.retryAfter !== undefined) {
    return Math.min(error.retryAfter, maxDelay);
  }

  // Exponential backoff with jitter
  const exponentialDelay = baseDelay * 2 ** attempt;
  const jitter = Math.random() * 0.1 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, maxDelay);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
