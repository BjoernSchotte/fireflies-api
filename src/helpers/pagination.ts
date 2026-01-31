/**
 * Options for parallel pagination.
 */
export interface ParallelPaginationOptions {
  /** Pages to fetch concurrently. @default 3 */
  concurrency?: number;
  /** Items per page. @default 50 */
  pageSize?: number;
  /** Delay between fetch starts (ms). @default 100 */
  delayMs?: number;
}

/**
 * Create an async iterable that paginates through results with concurrent page fetching.
 *
 * Fetches multiple pages in parallel while maintaining item order.
 * Stops when a partial page (< pageSize items) is received.
 *
 * @param fetcher - Function that fetches a page of results
 * @param options - Pagination options
 * @returns Async iterable yielding items one at a time
 *
 * @example
 * ```typescript
 * const items = paginateParallel(
 *   (skip, limit) => client.transcripts.list({ skip, limit }),
 *   { concurrency: 3, pageSize: 50 }
 * );
 *
 * for await (const item of items) {
 *   console.log(item.title);
 * }
 * ```
 */
export async function* paginateParallel<T>(
  fetcher: (skip: number, limit: number) => Promise<T[]>,
  options: ParallelPaginationOptions = {}
): AsyncIterable<T> {
  const { concurrency = 3, pageSize = 50, delayMs = 100 } = options;

  // Track pending page fetches: Map<pageIndex, Promise<T[]>>
  const pending = new Map<number, Promise<T[]>>();
  let nextPageToFetch = 0;
  let nextPageToYield = 0;
  let foundEnd = false;

  // Helper to delay between fetch starts
  const delay = (ms: number) =>
    ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

  // Start fetching a page
  const startFetch = (pageIndex: number): Promise<T[]> => {
    const skip = pageIndex * pageSize;
    return fetcher(skip, pageSize);
  };

  // Schedule additional page fetches up to concurrency limit
  // Only schedules if we haven't found the end yet
  const scheduleFetches = async () => {
    while (!foundEnd && pending.size < concurrency) {
      const pageIndex = nextPageToFetch++;
      // Add delay between starting fetches (except first)
      if (pageIndex > 0 && delayMs > 0) {
        await delay(delayMs);
      }
      // Don't schedule if we found end during delay
      if (foundEnd) break;
      pending.set(pageIndex, startFetch(pageIndex));
    }
  };

  // Fetch first page synchronously to determine if there's data
  pending.set(0, startFetch(0));
  nextPageToFetch = 1;

  // Yield pages in order
  while (pending.has(nextPageToYield)) {
    const pagePromise = pending.get(nextPageToYield);
    if (!pagePromise) break;

    const page = await pagePromise;
    pending.delete(nextPageToYield);

    // Check if this was the last page (partial or empty)
    if (page.length < pageSize) {
      foundEnd = true;
      // Yield items from this final page
      for (const item of page) {
        yield item;
      }
      break;
    }

    // Page was full, schedule more fetches before yielding
    // This allows concurrent fetching while we yield items
    await scheduleFetches();

    // Yield items from this page
    for (const item of page) {
      yield item;
    }

    nextPageToYield++;
  }
}

/**
 * Create an async iterable that automatically paginates through results.
 *
 * @param fetcher - Function that fetches a page of results
 * @param pageSize - Number of items per page
 * @returns Async iterable yielding items one at a time
 *
 * @example
 * ```typescript
 * const items = paginate(
 *   (skip, limit) => client.transcripts.list({ skip, limit }),
 *   50
 * );
 *
 * for await (const item of items) {
 *   console.log(item.title);
 * }
 * ```
 */
export async function* paginate<T>(
  fetcher: (skip: number, limit: number) => Promise<T[]>,
  pageSize = 50
): AsyncIterable<T> {
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const page = await fetcher(skip, pageSize);

    for (const item of page) {
      yield item;
    }

    // If we got fewer items than requested, we've reached the end
    if (page.length < pageSize) {
      hasMore = false;
    } else {
      skip += pageSize;
    }
  }
}

/**
 * Collect all items from an async iterable into an array.
 *
 * @param iterable - Async iterable to collect
 * @returns Array of all items
 */
export async function collectAll<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) {
    items.push(item);
  }
  return items;
}
