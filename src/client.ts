import { GraphQLClient } from './graphql/client.js';
import { createTranscriptsAPI, type TranscriptsAPI } from './graphql/queries/transcripts.js';
import type { FirefliesConfig } from './types/config.js';

/**
 * Main client for the Fireflies API.
 *
 * @example
 * ```typescript
 * import { FirefliesClient } from 'fireflies-api';
 *
 * const client = new FirefliesClient({
 *   apiKey: process.env.FIREFLIES_API_KEY!,
 * });
 *
 * // List recent transcripts
 * const transcripts = await client.transcripts.list({ limit: 10 });
 *
 * // Get a specific transcript
 * const transcript = await client.transcripts.get('transcript-id');
 *
 * // Iterate through all transcripts
 * for await (const t of client.transcripts.listAll({ mine: true })) {
 *   console.log(t.title);
 * }
 * ```
 */
export class FirefliesClient {
  /**
   * Transcript operations: list, get, search.
   */
  readonly transcripts: TranscriptsAPI;

  /**
   * Create a new Fireflies client.
   *
   * @param config - Client configuration
   * @throws FirefliesError if API key is missing
   */
  constructor(config: FirefliesConfig) {
    const graphql = new GraphQLClient(config);
    this.transcripts = createTranscriptsAPI(graphql);
  }
}
