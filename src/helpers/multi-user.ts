import { FirefliesClient } from '../client.js';
import type { TranscriptsListParams } from '../types/params.js';
import type { Transcript } from '../types/transcript.js';
import { Deduplicator } from '../utils/dedup.js';

/**
 * Options for fetching transcripts from multiple users.
 */
export interface MultiUserOptions {
  /**
   * Whether to deduplicate transcripts by ID across accounts.
   * Useful when multiple users have access to the same transcripts.
   * @default true
   */
  deduplicate?: boolean;
  /**
   * Filter parameters to apply to each account's transcript listing.
   * Pagination (skip/limit) is handled automatically.
   */
  filter?: Omit<TranscriptsListParams, 'skip' | 'limit'>;
  /**
   * Delay in milliseconds between yielded transcripts.
   * Helps throttle processing and reduce memory pressure.
   * Note: API rate limiting is handled by the underlying client.
   * @default 100
   */
  delayMs?: number;
}

/**
 * A transcript with source tracking information.
 */
export interface MultiUserTranscript {
  /** The transcript object */
  transcript: Transcript;
  /** API key used to fetch this transcript (for attribution) */
  sourceApiKey: string;
  /** Index of the API key in the input array */
  sourceIndex: number;
}

/**
 * Fetch transcripts from multiple Fireflies accounts with deduplication.
 *
 * This function creates a client for each API key and iterates through
 * all transcripts, optionally deduplicating across accounts.
 *
 * @param apiKeys - Array of Fireflies API keys
 * @param options - Configuration options
 * @returns AsyncIterable yielding transcripts with source tracking
 *
 * @example
 * ```typescript
 * import { getMeetingsForMultipleUsers } from 'fireflies-api';
 *
 * const apiKeys = [
 *   process.env.FIREFLIES_API_KEY_USER1!,
 *   process.env.FIREFLIES_API_KEY_USER2!,
 * ];
 *
 * for await (const { transcript, sourceIndex } of getMeetingsForMultipleUsers(apiKeys)) {
 *   console.log(`[User ${sourceIndex}] ${transcript.title}`);
 * }
 *
 * // With filtering
 * for await (const item of getMeetingsForMultipleUsers(apiKeys, {
 *   filter: { fromDate: '2024-01-01' },
 *   deduplicate: true,
 * })) {
 *   console.log(item.transcript.title);
 * }
 * ```
 */
export async function* getMeetingsForMultipleUsers(
  apiKeys: string[],
  options: MultiUserOptions = {}
): AsyncIterable<MultiUserTranscript> {
  const { deduplicate = true, filter, delayMs = 100 } = options;

  // Create deduplicator if enabled
  const dedup = deduplicate ? new Deduplicator() : null;

  // Track if we need delay (not before first API call)
  let needsDelay = false;

  // Iterate through each API key sequentially
  for (const [sourceIndex, apiKey] of apiKeys.entries()) {
    const client = new FirefliesClient({ apiKey });

    // Iterate through all transcripts for this user
    for await (const transcript of client.transcripts.listAll(filter)) {
      // Add delay between API calls
      if (needsDelay && delayMs > 0) {
        await delay(delayMs);
      }
      needsDelay = true;

      // Skip duplicates if deduplication is enabled
      if (dedup?.isDuplicate(transcript.id)) {
        continue;
      }

      yield {
        transcript,
        sourceApiKey: apiKey,
        sourceIndex,
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
