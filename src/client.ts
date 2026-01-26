import { GraphQLClient } from './graphql/client.js';
import { type AudioAPI, createAudioAPI } from './graphql/mutations/audio.js';
import {
  createTranscriptsMutationsAPI,
  type TranscriptsMutationsAPI,
} from './graphql/mutations/transcripts.js';
import { createUsersMutationsAPI, type UsersMutationsAPI } from './graphql/mutations/users.js';
import { type AIAppsAPI, createAIAppsAPI } from './graphql/queries/ai-apps.js';
import { type BitesAPI, createBitesAPI } from './graphql/queries/bites.js';
import { createMeetingsAPI, type MeetingsAPI } from './graphql/queries/meetings.js';
import { createTranscriptsAPI, type TranscriptsAPI } from './graphql/queries/transcripts.js';
import { createUsersAPI, type UsersAPI } from './graphql/queries/users.js';
import { createRealtimeAPI, type RealtimeAPI } from './realtime/api.js';
import type { FirefliesConfig, RateLimitState } from './types/config.js';

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
 * // Get current user
 * const me = await client.users.me();
 *
 * // List team members
 * const team = await client.users.list();
 *
 * // List bites
 * const bites = await client.bites.list({ mine: true });
 *
 * // Check active meetings
 * const meetings = await client.meetings.active();
 *
 * // List AI App outputs
 * const apps = await client.aiApps.list({ transcript_id: 'abc123' });
 * ```
 */
export class FirefliesClient {
  private readonly graphql: GraphQLClient;

  /**
   * Transcript operations: list, get, search, delete.
   */
  readonly transcripts: TranscriptsAPI & TranscriptsMutationsAPI;

  /**
   * User operations: me, get, list, setRole.
   */
  readonly users: UsersAPI & UsersMutationsAPI;

  /**
   * Bite operations: get, list, create.
   */
  readonly bites: BitesAPI;

  /**
   * Meeting operations: active meetings, add bot.
   */
  readonly meetings: MeetingsAPI;

  /**
   * Audio operations: upload audio for transcription.
   */
  readonly audio: AudioAPI;

  /**
   * AI Apps operations: list outputs.
   */
  readonly aiApps: AIAppsAPI;

  /**
   * Realtime transcription streaming.
   */
  readonly realtime: RealtimeAPI;

  /**
   * Create a new Fireflies client.
   *
   * @param config - Client configuration
   * @throws FirefliesError if API key is missing
   */
  constructor(config: FirefliesConfig) {
    this.graphql = new GraphQLClient(config);

    // Combine queries and mutations for each resource
    const transcriptsQueries = createTranscriptsAPI(this.graphql);
    const transcriptsMutations = createTranscriptsMutationsAPI(this.graphql);
    this.transcripts = { ...transcriptsQueries, ...transcriptsMutations };

    const usersQueries = createUsersAPI(this.graphql);
    const usersMutations = createUsersMutationsAPI(this.graphql);
    this.users = { ...usersQueries, ...usersMutations };

    this.bites = createBitesAPI(this.graphql);
    this.meetings = createMeetingsAPI(this.graphql);
    this.audio = createAudioAPI(this.graphql);
    this.aiApps = createAIAppsAPI(this.graphql);
    this.realtime = createRealtimeAPI(config.apiKey);
  }

  /**
   * Get the current rate limit state.
   * Returns undefined if rate limit tracking is not configured.
   *
   * @example
   * ```typescript
   * const client = new FirefliesClient({
   *   apiKey: '...',
   *   rateLimit: { warningThreshold: 10 }
   * });
   *
   * await client.users.me();
   * console.log(client.rateLimits);
   * // { remaining: 59, limit: 60, resetInSeconds: 60, updatedAt: 1706299500000 }
   * ```
   */
  get rateLimits(): RateLimitState | undefined {
    return this.graphql.rateLimitState;
  }
}
