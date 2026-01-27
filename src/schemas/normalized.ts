import { z } from 'zod';
import type { NormalizedMeeting } from '../types/normalized.js';

/**
 * Zod schema for NormalizedSpeaker.
 */
export const NormalizedSpeakerSchema = z.object({
  id: z.string(),
  name: z.string(),
});

/**
 * Zod schema for NormalizedSentence.
 */
export const NormalizedSentenceSchema = z.object({
  index: z.number().int().nonnegative(),
  speakerId: z.string(),
  speakerName: z.string(),
  text: z.string(),
  rawText: z.string(),
  startTime: z.number().nonnegative(),
  endTime: z.number().nonnegative(),
  sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
  isQuestion: z.boolean().optional(),
  isActionItem: z.boolean().optional(),
});

/**
 * Zod schema for NormalizedParticipant.
 */
export const NormalizedParticipantSchema = z.object({
  name: z.string(),
  email: z.string().optional(),
  role: z.enum(['organizer', 'attendee']).optional(),
});

/**
 * Zod schema for NormalizedSummary.
 */
export const NormalizedSummarySchema = z.object({
  overview: z.string().optional(),
  keyPoints: z.array(z.string()).optional(),
  actionItems: z.string().optional(),
  outline: z.string().optional(),
  topics: z.array(z.string()).optional(),
});

/**
 * Zod schema for NormalizedAttendee.
 */
export const NormalizedAttendeeSchema = z.object({
  name: z.string(),
  email: z.string().optional(),
  phoneNumber: z.string().optional(),
  joinTime: z.date().optional(),
  leaveTime: z.date().optional(),
});

/**
 * Zod schema for NormalizedChannel.
 */
export const NormalizedChannelSchema = z.object({
  id: z.string(),
  title: z.string(),
  isPrivate: z.boolean(),
});

/**
 * Zod schema for NormalizedAnalytics.
 */
export const NormalizedAnalyticsSchema = z.object({
  sentiments: z
    .object({
      positive: z.number().min(0).max(100),
      neutral: z.number().min(0).max(100),
      negative: z.number().min(0).max(100),
    })
    .optional(),
});

/**
 * Zod schema for NormalizedMeeting.
 *
 * Use this schema to validate unknown data against the NormalizedMeeting type.
 *
 * @example
 * ```typescript
 * import { NormalizedMeetingSchema } from 'fireflies-api/schemas';
 *
 * const result = NormalizedMeetingSchema.safeParse(data);
 * if (result.success) {
 *   const meeting = result.data; // NormalizedMeeting
 * }
 * ```
 */
export const NormalizedMeetingSchema = z.object({
  id: z.string().startsWith('fireflies:'),
  title: z.string(),
  date: z.date(),
  duration: z.number().positive(),
  url: z.string().url(),
  speakers: z.array(NormalizedSpeakerSchema),
  sentences: z.array(NormalizedSentenceSchema),
  participants: z.array(NormalizedParticipantSchema),
  summary: NormalizedSummarySchema.optional(),
  attendees: z.array(NormalizedAttendeeSchema).optional(),
  channels: z.array(NormalizedChannelSchema).optional(),
  analytics: NormalizedAnalyticsSchema.optional(),
  source: z.object({
    provider: z.literal('fireflies'),
    originalId: z.string(),
    rawData: z.unknown().optional(),
  }),
});

/**
 * Parse and validate data as a NormalizedMeeting.
 *
 * Throws a ZodError if validation fails.
 *
 * @param data - Unknown data to validate
 * @returns Validated NormalizedMeeting
 * @throws {z.ZodError} If validation fails
 *
 * @example
 * ```typescript
 * import { parseNormalizedMeeting } from 'fireflies-api/schemas';
 *
 * try {
 *   const meeting = parseNormalizedMeeting(untrustedData);
 *   console.log(meeting.id);
 * } catch (e) {
 *   console.error('Invalid data:', e);
 * }
 * ```
 */
export function parseNormalizedMeeting(data: unknown): NormalizedMeeting {
  return NormalizedMeetingSchema.parse(data) as NormalizedMeeting;
}

/**
 * Safely parse and validate data as a NormalizedMeeting.
 *
 * Returns a result object with success/error instead of throwing.
 *
 * @param data - Unknown data to validate
 * @returns SafeParseResult with data on success, error on failure
 *
 * @example
 * ```typescript
 * import { safeParseNormalizedMeeting } from 'fireflies-api/schemas';
 *
 * const result = safeParseNormalizedMeeting(untrustedData);
 * if (result.success) {
 *   console.log(result.data.id);
 * } else {
 *   console.error('Validation failed:', result.error);
 * }
 * ```
 */
export function safeParseNormalizedMeeting(data: unknown) {
  return NormalizedMeetingSchema.safeParse(data);
}
