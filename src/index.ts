// Client
export { FirefliesClient } from './client.js';

// Errors
export {
  AuthenticationError,
  ChunkTimeoutError,
  ConnectionError,
  FirefliesError,
  GraphQLError,
  type GraphQLErrorDetail,
  NetworkError,
  NotFoundError,
  RateLimitError,
  RealtimeError,
  StreamClosedError,
  TimeoutError,
  ValidationError,
} from './errors.js';

// API interfaces
export type { TranscriptsAPI } from './graphql/queries/transcripts.js';
// Helpers
export { collectAll, paginate } from './helpers/pagination.js';
export type { RealtimeAPI } from './realtime/api.js';
// Realtime
export { RealtimeStream } from './realtime/stream.js';
export type {
  RealtimeConfig,
  RealtimeEvents,
  TranscriptionChunk,
} from './realtime/types.js';
// Configuration
export type { FirefliesConfig, RetryConfig } from './types/config.js';
// Parameter types
export type {
  TranscriptGetParams,
  TranscriptsListParams,
  TranscriptsQueryScope,
} from './types/params.js';
// Transcript types
export type {
  AIAppOutput,
  AIFilter,
  AppsPreview,
  Channel,
  ChannelMember,
  MeetingAnalytics,
  MeetingAttendance,
  MeetingAttendee,
  MeetingInfo,
  Sentence,
  Sentiments,
  Speaker,
  Summary,
  SummarySection,
  SummaryStatus,
  Transcript,
  User,
} from './types/transcript.js';
// Utilities
export { Deduplicator } from './utils/dedup.js';
