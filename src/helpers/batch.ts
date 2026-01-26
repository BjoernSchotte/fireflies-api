import { RateLimitError } from '../errors.js';

/**
 * Options for batch processing.
 */
export interface BatchOptions {
  /**
   * Number of concurrent operations.
   * Currently only sequential (1) is supported.
   * @default 1
   */
  concurrency?: number;
  /**
   * Delay in milliseconds between operations.
   * @default 100
   */
  delayMs?: number;
  /**
   * Whether to automatically handle rate limit errors.
   * When true, waits for retryAfter and retries.
   * @default true
   */
  handleRateLimit?: boolean;
  /**
   * Maximum number of rate limit retries per item.
   * @default 3
   */
  maxRateLimitRetries?: number;
}

/**
 * Result of a batch operation on a single item.
 */
export type BatchResult<T, R> =
  | { item: T; result: R; error?: never }
  | { item: T; result?: never; error: Error };

/**
 * Process items in batch with rate limiting and error handling.
 *
 * Yields results as they complete, allowing streaming processing.
 * On rate limit errors, automatically waits and retries if handleRateLimit is true.
 *
 * @param items - Items to process (sync or async iterable)
 * @param processor - Function to process each item
 * @param options - Batch processing options
 * @returns AsyncIterable yielding results (success or error) for each item
 *
 * @example
 * ```typescript
 * import { batch, FirefliesClient } from 'fireflies-api';
 *
 * const client = new FirefliesClient({ apiKey: 'your-api-key' });
 * const ids = ['id1', 'id2', 'id3'];
 *
 * for await (const result of batch(ids, id => client.transcripts.get(id))) {
 *   if (result.error) {
 *     console.error(`Failed to fetch ${result.item}: ${result.error.message}`);
 *   } else {
 *     console.log(`Got ${result.result.title}`);
 *   }
 * }
 * ```
 */
export async function* batch<T, R>(
  items: Iterable<T> | AsyncIterable<T>,
  processor: (item: T) => Promise<R>,
  options: BatchOptions = {}
): AsyncIterable<BatchResult<T, R>> {
  const { delayMs = 100, handleRateLimit = true, maxRateLimitRetries = 3 } = options;

  let isFirst = true;

  for await (const item of items) {
    // Add delay between items (not before first)
    if (!isFirst && delayMs > 0) {
      await delay(delayMs);
    }
    isFirst = false;

    yield await processWithRetry(item, processor, {
      handleRateLimit,
      maxRateLimitRetries,
    });
  }
}

/**
 * Process all items in batch and collect results.
 *
 * Unlike the streaming `batch()`, this waits for all items to complete
 * and returns results as an array.
 *
 * @param items - Array of items to process
 * @param processor - Function to process each item
 * @param options - Batch processing options plus continueOnError
 * @returns Array of successful results. When continueOnError is false, results
 *   match input order. When true, failed items are omitted (array may be shorter).
 * @throws First error encountered if continueOnError is false (default)
 *
 * @example
 * ```typescript
 * import { batchAll, FirefliesClient } from 'fireflies-api';
 *
 * const client = new FirefliesClient({ apiKey: 'your-api-key' });
 * const ids = ['id1', 'id2', 'id3'];
 *
 * // Throws on first error
 * const transcripts = await batchAll(ids, id => client.transcripts.get(id));
 *
 * // Continues on error, collects successful results
 * const results = await batchAll(
 *   ids,
 *   id => client.transcripts.get(id),
 *   { continueOnError: true }
 * );
 * ```
 */
export async function batchAll<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: BatchOptions & { continueOnError?: boolean } = {}
): Promise<R[]> {
  const { continueOnError = false, ...batchOptions } = options;
  const results: R[] = [];
  const errors: Error[] = [];

  for await (const batchResult of batch(items, processor, batchOptions)) {
    if (batchResult.error) {
      if (!continueOnError) {
        throw batchResult.error;
      }
      errors.push(batchResult.error);
    } else {
      results.push(batchResult.result);
    }
  }

  return results;
}

/**
 * Process a single item with rate limit retry logic.
 */
async function processWithRetry<T, R>(
  item: T,
  processor: (item: T) => Promise<R>,
  options: { handleRateLimit: boolean; maxRateLimitRetries: number }
): Promise<BatchResult<T, R>> {
  const { handleRateLimit, maxRateLimitRetries } = options;
  let retries = 0;

  while (true) {
    try {
      const result = await processor(item);
      return { item, result };
    } catch (err) {
      // Handle rate limit with retry
      if (handleRateLimit && err instanceof RateLimitError && retries < maxRateLimitRetries) {
        const waitTime = err.retryAfter ?? 1000;
        await delay(waitTime);
        retries++;
        continue;
      }

      // Return error for this item
      return {
        item,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }
}

/**
 * Delay execution for a specified time.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
