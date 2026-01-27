import type {
  NormalizationOptions,
  NormalizedAnalytics,
  NormalizedAttendee,
  NormalizedChannel,
  NormalizedMeeting,
  NormalizedParticipant,
  NormalizedSentence,
  NormalizedSpeaker,
  NormalizedSummary,
} from '../types/normalized.js';
import type { Sentence, Speaker, Summary, Transcript } from '../types/transcript.js';
import type { BatchResult } from './batch.js';

/**
 * Options for batch normalization, extending NormalizationOptions.
 */
export interface BatchNormalizationOptions extends NormalizationOptions {
  /**
   * Delay between items in ms.
   * Since normalization is a pure function, this is typically 0.
   * @default 0
   */
  delayMs?: number;
}

/**
 * Default options for normalization.
 */
const DEFAULT_OPTIONS: Required<NormalizationOptions> = {
  timeUnit: 'seconds',
  includeRawData: false,
  includeAIFilters: true,
  includeSummary: true,
  resolveSpeakerName: (speaker: Speaker) => speaker.name,
  enrichParticipant: () => ({}),
};

/**
 * Normalize a Fireflies transcript to a provider-agnostic format.
 *
 * This function converts Fireflies-specific transcript data to a normalized schema
 * that can be used across multiple meeting intelligence providers.
 *
 * @param transcript - The Fireflies transcript to normalize
 * @param options - Normalization options
 * @returns A normalized meeting object
 *
 * @example
 * ```typescript
 * import { FirefliesClient, normalizeTranscript } from 'fireflies-api';
 *
 * const client = new FirefliesClient({ apiKey: 'your-api-key' });
 * const transcript = await client.transcripts.get({ id: 'transcript-id' });
 *
 * const normalized = normalizeTranscript(transcript, {
 *   timeUnit: 'milliseconds',
 *   includeRawData: true,
 * });
 *
 * console.log(normalized.id); // "fireflies:transcript-id"
 * console.log(normalized.duration); // in seconds
 * ```
 */
export function normalizeTranscript(
  transcript: Transcript,
  options?: NormalizationOptions
): NormalizedMeeting {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const speakers = normalizeSpeakers(transcript.speakers ?? [], transcript, opts);
  const sentences = normalizeSentences(transcript.sentences ?? [], opts);
  const participants = normalizeParticipants(transcript, opts);
  const summary = opts.includeSummary ? normalizeSummary(transcript.summary) : undefined;
  const attendees = normalizeAttendees(transcript.meeting_attendance ?? []);
  const channels = normalizeChannels(transcript.channels ?? []);
  const analytics = normalizeAnalytics(transcript.analytics);

  return {
    id: `fireflies:${transcript.id}`,
    title: transcript.title,
    date: new Date(transcript.date),
    duration: transcript.duration * 60, // minutes → seconds
    url: transcript.transcript_url,

    speakers,
    sentences,
    participants,

    summary,
    attendees,
    channels,
    analytics,

    source: {
      provider: 'fireflies',
      originalId: transcript.id,
      rawData: opts.includeRawData ? transcript : undefined,
    },
  };
}

/**
 * Create a pre-configured normalizer function.
 *
 * Useful when normalizing multiple transcripts with the same options.
 *
 * @param options - Normalization options to apply to all transcripts
 * @returns A function that normalizes transcripts with the configured options
 *
 * @example
 * ```typescript
 * import { createNormalizer } from 'fireflies-api';
 *
 * const normalizer = createNormalizer({
 *   timeUnit: 'milliseconds',
 *   includeRawData: false,
 * });
 *
 * // Reuse with same config
 * const norm1 = normalizer(transcript1);
 * const norm2 = normalizer(transcript2);
 * ```
 */
export function createNormalizer(
  options?: NormalizationOptions
): (transcript: Transcript) => NormalizedMeeting {
  return (transcript: Transcript) => normalizeTranscript(transcript, options);
}

/**
 * Normalize speakers from the transcript.
 */
function normalizeSpeakers(
  speakers: Speaker[],
  transcript: Transcript,
  opts: Required<NormalizationOptions>
): NormalizedSpeaker[] {
  return speakers.map((speaker) => ({
    id: speaker.id,
    name: opts.resolveSpeakerName(speaker, transcript),
  }));
}

/**
 * Normalize sentences from the transcript.
 */
function normalizeSentences(
  sentences: Sentence[],
  opts: Required<NormalizationOptions>
): NormalizedSentence[] {
  const timeMultiplier = opts.timeUnit === 'milliseconds' ? 1000 : 1;

  return sentences.map((sentence) => {
    const normalized: NormalizedSentence = {
      index: sentence.index,
      speakerId: sentence.speaker_id,
      speakerName: sentence.speaker_name,
      text: sentence.text,
      rawText: sentence.raw_text,
      startTime: parseTime(sentence.start_time) * timeMultiplier,
      endTime: parseTime(sentence.end_time) * timeMultiplier,
    };

    if (opts.includeAIFilters && sentence.ai_filters) {
      const sentiment = mapSentiment(sentence.ai_filters.sentiment);
      if (sentiment) {
        normalized.sentiment = sentiment;
      }
      if (sentence.ai_filters.question) {
        normalized.isQuestion = true;
      }
      if (sentence.ai_filters.task) {
        normalized.isActionItem = true;
      }
    }

    return normalized;
  });
}

/**
 * Parse time string to number, handling invalid values.
 */
function parseTime(timeStr: string): number {
  const parsed = Number.parseFloat(timeStr);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Map Fireflies sentiment string to normalized sentiment.
 */
function mapSentiment(
  sentiment: string | undefined
): 'positive' | 'negative' | 'neutral' | undefined {
  if (!sentiment) return undefined;
  const lower = sentiment.toLowerCase();
  if (lower === 'positive') return 'positive';
  if (lower === 'negative') return 'negative';
  if (lower === 'neutral') return 'neutral';
  return undefined;
}

/**
 * Normalize participants from the transcript.
 */
function normalizeParticipants(
  transcript: Transcript,
  opts: Required<NormalizationOptions>
): NormalizedParticipant[] {
  const participants = transcript.participants ?? [];
  const attendeeMap = new Map<string, string>();

  // Build email → name mapping from meeting_attendees
  for (const attendee of transcript.meeting_attendees ?? []) {
    if (attendee.email && attendee.name) {
      attendeeMap.set(attendee.email.toLowerCase(), attendee.name);
    }
  }

  return participants.map((email) => {
    const isOrganizer = email.toLowerCase() === transcript.organizer_email.toLowerCase();
    const attendeeName = attendeeMap.get(email.toLowerCase());
    const enrichment = opts.enrichParticipant(email, transcript);

    return {
      name: enrichment.name ?? attendeeName ?? '',
      email,
      role: enrichment.role ?? (isOrganizer ? 'organizer' : 'attendee'),
    };
  });
}

/**
 * Normalize summary from the transcript.
 */
function normalizeSummary(summary: Summary | undefined): NormalizedSummary | undefined {
  if (!summary) return undefined;

  const keyPoints = parseKeyPoints(summary.shorthand_bullet);

  return {
    overview: summary.overview,
    keyPoints: keyPoints.length > 0 ? keyPoints : undefined,
    actionItems: summary.action_items,
    outline: summary.outline,
    topics: summary.topics_discussed,
  };
}

/**
 * Parse shorthand bullet points into array.
 */
function parseKeyPoints(shorthandBullet: string | undefined): string[] {
  if (!shorthandBullet) return [];

  return shorthandBullet
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter((line) => line.length > 0);
}

/**
 * Normalize meeting attendance to attendees.
 */
function normalizeAttendees(attendance: Transcript['meeting_attendance']): NormalizedAttendee[] {
  return attendance.map((a) => ({
    name: a.name,
    joinTime: a.join_time ? new Date(a.join_time) : undefined,
    leaveTime: a.leave_time ? new Date(a.leave_time) : undefined,
  }));
}

/**
 * Normalize channels.
 */
function normalizeChannels(channels: Transcript['channels']): NormalizedChannel[] {
  return channels.map((ch) => ({
    id: ch.id,
    title: ch.title,
    isPrivate: ch.is_private ?? false,
  }));
}

/**
 * Normalize analytics.
 */
function normalizeAnalytics(analytics: Transcript['analytics']): NormalizedAnalytics | undefined {
  if (!analytics?.sentiments) return undefined;

  return {
    sentiments: {
      positive: analytics.sentiments.positive_pct ?? 0,
      neutral: analytics.sentiments.neutral_pct ?? 0,
      negative: analytics.sentiments.negative_pct ?? 0,
    },
  };
}

/**
 * Delay execution for a specified time.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalize multiple transcripts with streaming and error handling.
 *
 * Yields a BatchResult for each transcript, capturing any errors
 * without stopping iteration.
 *
 * @param transcripts - Array or async iterable of transcripts to normalize
 * @param options - Batch normalization options
 * @returns AsyncIterable yielding BatchResult for each transcript
 *
 * @example
 * ```typescript
 * import { normalizeTranscripts } from 'fireflies-api';
 *
 * for await (const result of normalizeTranscripts(transcripts)) {
 *   if (result.error) {
 *     console.error(`Failed: ${result.item.id}`, result.error);
 *   } else {
 *     console.log(result.result.id); // "fireflies:..."
 *   }
 * }
 * ```
 */
export async function* normalizeTranscripts(
  transcripts: Transcript[] | AsyncIterable<Transcript>,
  options?: BatchNormalizationOptions
): AsyncIterable<BatchResult<Transcript, NormalizedMeeting>> {
  const { delayMs = 0, ...normalizationOptions } = options ?? {};
  let isFirst = true;

  for await (const transcript of transcripts) {
    // Add delay between items (not before first)
    if (!isFirst && delayMs > 0) {
      await delay(delayMs);
    }
    isFirst = false;

    try {
      const result = normalizeTranscript(transcript, normalizationOptions);
      yield { item: transcript, result };
    } catch (err) {
      yield {
        item: transcript,
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }
}

/**
 * Normalize multiple transcripts and collect all results.
 *
 * Unlike the streaming `normalizeTranscripts()`, this waits for all items
 * to complete and returns results as an array.
 *
 * @param transcripts - Array or async iterable of transcripts to normalize
 * @param options - Batch normalization options
 * @returns Array of BatchResult for each transcript
 *
 * @example
 * ```typescript
 * import { normalizeTranscriptsAll } from 'fireflies-api';
 *
 * const results = await normalizeTranscriptsAll(transcripts, {
 *   timeUnit: 'milliseconds',
 *   includeRawData: false,
 * });
 *
 * const successful = results.filter(r => !r.error).map(r => r.result);
 * const failed = results.filter(r => r.error);
 * ```
 */
export async function normalizeTranscriptsAll(
  transcripts: Transcript[] | AsyncIterable<Transcript>,
  options?: BatchNormalizationOptions
): Promise<BatchResult<Transcript, NormalizedMeeting>[]> {
  const results: BatchResult<Transcript, NormalizedMeeting>[] = [];

  for await (const result of normalizeTranscripts(transcripts, options)) {
    results.push(result);
  }

  return results;
}
