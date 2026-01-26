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
