/**
 * Zod schemas for runtime validation of normalized meeting types.
 *
 * This module provides Zod schemas for validating data against the
 * NormalizedMeeting type and related types. Requires zod as a peer dependency.
 *
 * @example
 * ```typescript
 * import { NormalizedMeetingSchema, parseNormalizedMeeting } from 'fireflies-api/schemas';
 *
 * // Validate unknown data
 * const result = NormalizedMeetingSchema.safeParse(data);
 * if (result.success) {
 *   const meeting = result.data;
 * }
 *
 * // Or throw on invalid
 * const meeting = parseNormalizedMeeting(data);
 * ```
 *
 * @packageDocumentation
 */

export {
  NormalizedAnalyticsSchema,
  NormalizedAttendeeSchema,
  NormalizedChannelSchema,
  NormalizedMeetingSchema,
  NormalizedParticipantSchema,
  NormalizedSentenceSchema,
  NormalizedSpeakerSchema,
  NormalizedSummarySchema,
  parseNormalizedMeeting,
  safeParseNormalizedMeeting,
} from './normalized.js';
