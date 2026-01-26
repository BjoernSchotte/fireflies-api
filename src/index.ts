// Client
export { FirefliesClient } from './client.js';
// Errors
export {
  AuthenticationError,
  FirefliesError,
  GraphQLError,
  type GraphQLErrorDetail,
  NetworkError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
  ValidationError,
} from './errors.js';
// API interfaces
export type { TranscriptsAPI } from './graphql/queries/transcripts.js';
// Helpers
export { collectAll, paginate } from './helpers/pagination.js';
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
