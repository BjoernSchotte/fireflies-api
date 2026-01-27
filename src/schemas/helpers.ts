import { z } from 'zod';
import type { ActionItemsResult } from '../helpers/action-items.js';
import type { SpeakerAnalytics } from '../helpers/speaker-analytics.js';

/**
 * Zod schema for source sentence in an action item.
 */
export const ActionItemSourceSentenceSchema = z.object({
  speakerName: z.string(),
  text: z.string(),
  startTime: z.number().nonnegative(),
});

/**
 * Zod schema for ActionItem.
 * A single action item extracted from a transcript.
 */
export const ActionItemSchema = z.object({
  text: z.string(),
  assignee: z.string().optional(),
  dueDate: z.string().optional(),
  lineNumber: z.number().int().positive(),
  sourceSentence: ActionItemSourceSentenceSchema.optional(),
});

/**
 * Zod schema for ActionItemsResult.
 * Result of action item extraction from a transcript.
 */
export const ActionItemsResultSchema = z.object({
  items: z.array(ActionItemSchema),
  totalItems: z.number().int().nonnegative(),
  assignedItems: z.number().int().nonnegative(),
  datedItems: z.number().int().nonnegative(),
  assignees: z.array(z.string()),
});

/**
 * Zod schema for SpeakerStats.
 * Statistics for a single speaker in the meeting.
 */
export const SpeakerStatsSchema = z.object({
  name: z.string(),
  id: z.string(),
  talkTime: z.number().nonnegative(),
  talkTimePercentage: z.number().min(0).max(100),
  sentenceCount: z.number().int().nonnegative(),
  wordCount: z.number().int().nonnegative(),
  wordsPerMinute: z.number().nonnegative(),
  averageSentenceLength: z.number().nonnegative(),
  turnCount: z.number().int().nonnegative(),
});

/**
 * Zod schema for SpeakerAnalytics.
 * Overall meeting speaker analytics.
 */
export const SpeakerAnalyticsSchema = z.object({
  speakers: z.array(SpeakerStatsSchema),
  totalDuration: z.number().nonnegative(),
  totalTalkTime: z.number().nonnegative(),
  totalSentences: z.number().int().nonnegative(),
  totalWords: z.number().int().nonnegative(),
  dominantSpeaker: z.string(),
  dominantSpeakerPercentage: z.number().min(0).max(100),
  balance: z.enum(['balanced', 'unbalanced', 'dominated']),
});

/**
 * Parse and validate data as an ActionItemsResult.
 *
 * Throws a ZodError if validation fails.
 *
 * @param data - Unknown data to validate
 * @returns Validated ActionItemsResult
 * @throws {z.ZodError} If validation fails
 *
 * @example
 * ```typescript
 * import { parseActionItemsResult } from 'fireflies-api/schemas';
 *
 * const result = parseActionItemsResult(data);
 * console.log(result.totalItems);
 * ```
 */
export function parseActionItemsResult(data: unknown): ActionItemsResult {
  return ActionItemsResultSchema.parse(data) as ActionItemsResult;
}

/**
 * Safely parse and validate data as an ActionItemsResult.
 *
 * Returns a result object with success/error instead of throwing.
 *
 * @param data - Unknown data to validate
 * @returns SafeParseResult with data on success, error on failure
 */
export function safeParseActionItemsResult(data: unknown) {
  return ActionItemsResultSchema.safeParse(data);
}

/**
 * Parse and validate data as SpeakerAnalytics.
 *
 * Throws a ZodError if validation fails.
 *
 * @param data - Unknown data to validate
 * @returns Validated SpeakerAnalytics
 * @throws {z.ZodError} If validation fails
 *
 * @example
 * ```typescript
 * import { parseSpeakerAnalytics } from 'fireflies-api/schemas';
 *
 * const analytics = parseSpeakerAnalytics(data);
 * console.log(analytics.dominantSpeaker);
 * ```
 */
export function parseSpeakerAnalytics(data: unknown): SpeakerAnalytics {
  return SpeakerAnalyticsSchema.parse(data) as SpeakerAnalytics;
}

/**
 * Safely parse and validate data as SpeakerAnalytics.
 *
 * Returns a result object with success/error instead of throwing.
 *
 * @param data - Unknown data to validate
 * @returns SafeParseResult with data on success, error on failure
 */
export function safeParseSpeakerAnalytics(data: unknown) {
  return SpeakerAnalyticsSchema.safeParse(data);
}
