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
  WebhookParseError,
  WebhookVerificationError,
} from './errors.js';

// API interfaces
export type { AudioAPI } from './graphql/mutations/audio.js';
export type { TranscriptsMutationsAPI } from './graphql/mutations/transcripts.js';
export type { UsersMutationsAPI } from './graphql/mutations/users.js';
export type { AIAppsAPI } from './graphql/queries/ai-apps.js';
export type { BitesAPI } from './graphql/queries/bites.js';
export type { MeetingsAPI } from './graphql/queries/meetings.js';
export type { TranscriptsAPI } from './graphql/queries/transcripts.js';
export type { UsersAPI } from './graphql/queries/users.js';
export {
  type AccumulatedTranscript,
  type SpeakerTurn,
  TranscriptAccumulator,
} from './helpers/accumulator.js';
export {
  type ActionItem,
  type ActionItemOptions,
  type ActionItemsResult,
  extractActionItems,
} from './helpers/action-items.js';
// Helpers
export { type BatchOptions, type BatchResult, batch, batchAll } from './helpers/batch.js';
export {
  type ExternalQuestion,
  type ExternalQuestionsResult,
  findExternalParticipantQuestions,
} from './helpers/external-questions.js';
export {
  type ChunksExportOptions,
  chunksToMarkdown,
  type MarkdownExportOptions,
  transcriptToMarkdown,
} from './helpers/markdown.js';
export {
  analyzeMeetings,
  type DayOfWeekStats,
  type DayStats,
  type MeetingInsights,
  type MeetingInsightsOptions,
  type ParticipantStats,
  type SpeakerInsightStats,
  type TimeGroupStats,
} from './helpers/meeting-insights.js';
export {
  getMeetingsForMultipleUsers,
  type MultiUserOptions,
  type MultiUserTranscript,
} from './helpers/multi-user.js';
export { collectAll, paginate } from './helpers/pagination.js';
export { searchTranscript } from './helpers/search.js';
export {
  analyzeSpeakers,
  type SpeakerAnalytics,
  type SpeakerAnalyticsOptions,
  type SpeakerStats,
} from './helpers/speaker-analytics.js';
export { getMeetingVideos, hasVideo, type TranscriptWithVideo } from './helpers/videos.js';
// Realtime
export type { RealtimeAPI } from './realtime/api.js';
export { RealtimeStream } from './realtime/stream.js';
export type {
  RealtimeConfig,
  RealtimeEvents,
  TranscriptionChunk,
} from './realtime/types.js';
// AI App types
export type { AIApp } from './types/ai-app.js';
// Bite types
export type {
  Bite,
  BiteCaption,
  BiteCreatedFrom,
  BiteSource,
  BiteUser,
} from './types/bite.js';
// Configuration
export type {
  FirefliesConfig,
  RateLimitConfig,
  RateLimitState,
  RetryConfig,
  ThrottleConfig,
} from './types/config.js';
// Meeting types
export type {
  ActiveMeeting,
  MeetingPrivacy,
  MeetingState,
} from './types/meeting.js';
// Parameter types
export type {
  ActiveMeetingsParams,
  AddBotParams,
  AIAppsListParams,
  BitesListParams,
  CreateBiteParams,
  TranscriptGetParams,
  TranscriptsInsightsParams,
  TranscriptsListParams,
  TranscriptsQueryScope,
  UploadAudioAttendee,
  UploadAudioParams,
} from './types/params.js';
// Search types
export type {
  SearchMatch,
  SearchParams,
  SearchResults,
  SearchTranscriptOptions,
} from './types/search.js';

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

// User types
export type {
  UserGroup,
  UserGroupMember,
  UserProfile,
  UserRole,
} from './types/user.js';

// Utilities
export { Deduplicator } from './utils/dedup.js';

// Webhooks
export {
  isValidWebhookPayload,
  type ParseOptions,
  parseWebhookPayload,
  type VerifyOptions,
  verifyWebhookSignature,
  type WebhookEventType,
  type WebhookPayload,
} from './webhooks/index.js';
