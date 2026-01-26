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
    const graphql = new GraphQLClient(config);

    // Combine queries and mutations for each resource
    const transcriptsQueries = createTranscriptsAPI(graphql);
    const transcriptsMutations = createTranscriptsMutationsAPI(graphql);
    this.transcripts = { ...transcriptsQueries, ...transcriptsMutations };

    const usersQueries = createUsersAPI(graphql);
    const usersMutations = createUsersMutationsAPI(graphql);
    this.users = { ...usersQueries, ...usersMutations };

    this.bites = createBitesAPI(graphql);
    this.meetings = createMeetingsAPI(graphql);
    this.audio = createAudioAPI(graphql);
    this.aiApps = createAIAppsAPI(graphql);
    this.realtime = createRealtimeAPI(config.apiKey);
  }
}
