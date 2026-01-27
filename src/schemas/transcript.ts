import { z } from 'zod';
import type { Transcript } from '../types/transcript.js';

/**
 * Zod schema for Speaker.
 */
export const SpeakerSchema = z.object({
  id: z.string(),
  name: z.string(),
});

/**
 * Zod schema for AIFilter.
 * All fields are optional AI-detected content filters for a sentence.
 */
export const AIFilterSchema = z.object({
  task: z.string().optional(),
  pricing: z.string().optional(),
  metric: z.string().optional(),
  question: z.string().optional(),
  date_and_time: z.string().optional(),
  text_cleanup: z.string().optional(),
  sentiment: z.string().optional(),
});

/**
 * Zod schema for Sentence.
 */
export const SentenceSchema = z.object({
  index: z.number().int().nonnegative(),
  text: z.string(),
  raw_text: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  speaker_id: z.string(),
  speaker_name: z.string(),
  ai_filters: AIFilterSchema.optional(),
});

/**
 * Zod schema for SummarySection.
 */
export const SummarySectionSchema = z.object({
  title: z.string(),
  content: z.string(),
});

/**
 * Zod schema for Summary.
 * AI-generated meeting summary sections.
 */
export const SummarySchema = z.object({
  action_items: z.string().optional(),
  keywords: z.string().optional(),
  outline: z.string().optional(),
  overview: z.string().optional(),
  shorthand_bullet: z.string().optional(),
  notes: z.string().optional(),
  gist: z.string().optional(),
  bullet_gist: z.string().optional(),
  short_summary: z.string().optional(),
  short_overview: z.string().optional(),
  meeting_type: z.string().optional(),
  topics_discussed: z.array(z.string()).optional(),
  transcript_chapters: z.array(z.string()).optional(),
  extended_sections: z.array(SummarySectionSchema).optional(),
});

/**
 * Zod schema for MeetingAttendee.
 * Attendee information from calendar invite.
 */
export const MeetingAttendeeSchema = z.object({
  displayName: z.string(),
  email: z.string(),
  phoneNumber: z.string().optional(),
  name: z.string(),
  location: z.string().optional(),
});

/**
 * Zod schema for MeetingAttendance.
 * Attendance tracking with join/leave times.
 */
export const MeetingAttendanceSchema = z.object({
  name: z.string(),
  join_time: z.string(),
  leave_time: z.string().optional(),
});

/**
 * Summary processing status enum.
 */
export const SummaryStatusSchema = z.enum(['processing', 'processed', 'failed', 'skipped']);

/**
 * Zod schema for MeetingInfo.
 * Meeting metadata and processing status.
 */
export const MeetingInfoSchema = z.object({
  fred_joined: z.boolean(),
  silent_meeting: z.boolean(),
  summary_status: SummaryStatusSchema,
});

/**
 * Zod schema for ChannelMember.
 */
export const ChannelMemberSchema = z.object({
  user_id: z.string(),
  email: z.string(),
  name: z.string(),
});

/**
 * Zod schema for Channel.
 */
export const ChannelSchema = z.object({
  id: z.string(),
  title: z.string(),
  is_private: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  created_by: z.string().optional(),
  members: z.array(ChannelMemberSchema).optional(),
});

/**
 * Zod schema for AIAppOutput.
 */
export const AIAppOutputSchema = z.object({
  transcript_id: z.string().optional(),
  user_id: z.string().optional(),
  app_id: z.string().optional(),
  created_at: z.number().optional(),
  title: z.string().optional(),
  prompt: z.string().optional(),
  response: z.string().optional(),
});

/**
 * Zod schema for AppsPreview.
 */
export const AppsPreviewSchema = z.object({
  outputs: z.array(AIAppOutputSchema),
});

/**
 * Zod schema for Sentiments.
 * Sentiment percentages for a meeting (0-100).
 */
export const SentimentsSchema = z.object({
  negative_pct: z.number().min(0).max(100).optional(),
  neutral_pct: z.number().min(0).max(100).optional(),
  positive_pct: z.number().min(0).max(100).optional(),
});

/**
 * Zod schema for MeetingAnalytics.
 */
export const MeetingAnalyticsSchema = z.object({
  sentiments: SentimentsSchema.optional(),
});

/**
 * Zod schema for User.
 */
export const UserSchema = z.object({
  user_id: z.string(),
  email: z.string(),
  name: z.string().optional(),
  num_transcripts: z.number().int().nonnegative().optional(),
  is_admin: z.boolean().optional(),
});

/**
 * Zod schema for Transcript.
 *
 * Use this schema to validate unknown data against the Transcript type.
 *
 * @example
 * ```typescript
 * import { TranscriptSchema } from 'fireflies-api/schemas';
 *
 * const result = TranscriptSchema.safeParse(apiResponse);
 * if (result.success) {
 *   const transcript = result.data;
 * }
 * ```
 */
export const TranscriptSchema = z.object({
  id: z.string(),
  title: z.string(),
  organizer_email: z.string(),
  host_email: z.string().optional(),
  user: UserSchema.optional(),
  speakers: z.array(SpeakerSchema),
  transcript_url: z.string(),
  participants: z.array(z.string()),
  meeting_attendees: z.array(MeetingAttendeeSchema),
  meeting_attendance: z.array(MeetingAttendanceSchema),
  fireflies_users: z.array(z.string()),
  workspace_users: z.array(z.string()),
  duration: z.number(),
  dateString: z.string(),
  date: z.number(),
  audio_url: z.string().optional(),
  video_url: z.string().optional(),
  sentences: z.array(SentenceSchema),
  calendar_id: z.string().optional(),
  summary: SummarySchema.optional(),
  meeting_info: MeetingInfoSchema.optional(),
  cal_id: z.string().optional(),
  calendar_type: z.string().optional(),
  apps_preview: AppsPreviewSchema.optional(),
  meeting_link: z.string().optional(),
  analytics: MeetingAnalyticsSchema.optional(),
  channels: z.array(ChannelSchema),
});

/**
 * Parse and validate data as a Transcript.
 *
 * Throws a ZodError if validation fails.
 *
 * @param data - Unknown data to validate
 * @returns Validated Transcript
 * @throws {z.ZodError} If validation fails
 *
 * @example
 * ```typescript
 * import { parseTranscript } from 'fireflies-api/schemas';
 *
 * try {
 *   const transcript = parseTranscript(apiResponse);
 *   console.log(transcript.title);
 * } catch (e) {
 *   console.error('Invalid data:', e);
 * }
 * ```
 */
export function parseTranscript(data: unknown): Transcript {
  return TranscriptSchema.parse(data) as Transcript;
}

/**
 * Safely parse and validate data as a Transcript.
 *
 * Returns a result object with success/error instead of throwing.
 *
 * @param data - Unknown data to validate
 * @returns SafeParseResult with data on success, error on failure
 *
 * @example
 * ```typescript
 * import { safeParseTranscript } from 'fireflies-api/schemas';
 *
 * const result = safeParseTranscript(apiResponse);
 * if (result.success) {
 *   console.log(result.data.title);
 * } else {
 *   console.error('Validation failed:', result.error);
 * }
 * ```
 */
export function safeParseTranscript(data: unknown) {
  return TranscriptSchema.safeParse(data);
}
