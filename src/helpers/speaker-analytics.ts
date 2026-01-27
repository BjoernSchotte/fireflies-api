import type { Sentence, Transcript } from '../types/transcript.js';

/**
 * Statistics for a single speaker in the meeting.
 */
export interface SpeakerStats {
  /** Speaker name from transcript */
  name: string;
  /** Speaker ID from transcript */
  id: string;
  /** Total talk time in seconds */
  talkTime: number;
  /** Percentage of total meeting talk time (0-100) */
  talkTimePercentage: number;
  /** Number of sentences spoken */
  sentenceCount: number;
  /** Total words spoken */
  wordCount: number;
  /** Words per minute (based on talk time) */
  wordsPerMinute: number;
  /** Average words per sentence */
  averageSentenceLength: number;
  /** Number of speaking turns (consecutive sentence groups) */
  turnCount: number;
}

/**
 * Overall meeting speaker analytics.
 */
export interface SpeakerAnalytics {
  /** Per-speaker statistics, sorted by talk time descending */
  speakers: SpeakerStats[];
  /** Total meeting duration from sentences (seconds) */
  totalDuration: number;
  /** Total talk time across all speakers (seconds) */
  totalTalkTime: number;
  /** Total sentences in transcript */
  totalSentences: number;
  /** Total words spoken */
  totalWords: number;
  /** Name of speaker with most talk time */
  dominantSpeaker: string;
  /** Talk time percentage of dominant speaker */
  dominantSpeakerPercentage: number;
  /** Balance indicator: balanced, unbalanced, or dominated */
  balance: 'balanced' | 'unbalanced' | 'dominated';
}

/**
 * Options for speaker analysis.
 */
export interface SpeakerAnalyticsOptions {
  /**
   * Merge speakers with identical names into a single entry (default: true).
   *
   * Fireflies' speaker diarization can incorrectly assign multiple speaker IDs
   * to the same person, especially with:
   * - Multiple audio channels/microphones
   * - Short utterances being misattributed
   * - Audio quality issues causing speaker model confusion
   *
   * This commonly manifests as rapid alternation between two IDs for the same
   * speaker name, resulting in inflated turn counts and split statistics.
   *
   * When enabled (default), speakers are grouped by name rather than ID,
   * combining their talk time, word counts, and other metrics. Turn counting
   * uses speaker names, so consecutive sentences from the same person count
   * as one turn regardless of ID changes.
   *
   * Set to `false` to preserve the raw speaker IDs from Fireflies, which may
   * be useful for debugging diarization issues or when you have confirmed that
   * multiple people share the same display name.
   */
  mergeSpeakersByName?: boolean;
  /** Round percentages to integers (default: true) */
  roundPercentages?: boolean;
  /** Threshold for 'unbalanced' classification (default: 40) */
  unbalancedThreshold?: number;
  /** Threshold for 'dominated' classification (default: 60) */
  dominatedThreshold?: number;
}

interface SpeakerData {
  id: string;
  name: string;
  sentences: Sentence[];
  talkTime: number;
  wordCount: number;
  turnCount: number;
}

/**
 * Analyze speaker participation in a transcript.
 *
 * Computes talk time percentages, word counts, and participation metrics
 * for each speaker in the meeting.
 *
 * @param transcript - The transcript to analyze
 * @param options - Analysis options
 * @returns Speaker analytics with per-speaker stats and totals
 *
 * @example
 * ```typescript
 * import { FirefliesClient, analyzeSpeakers } from 'fireflies-api';
 *
 * const client = new FirefliesClient({ apiKey: 'your-api-key' });
 * const transcript = await client.transcripts.get({ id: 'transcript-id' });
 *
 * const analytics = analyzeSpeakers(transcript);
 *
 * console.log(`${analytics.speakers.length} speakers`);
 * console.log(`Dominant: ${analytics.dominantSpeaker} (${analytics.dominantSpeakerPercentage}%)`);
 *
 * for (const speaker of analytics.speakers) {
 *   console.log(`${speaker.name}: ${speaker.talkTimePercentage}% talk time, ${speaker.wordCount} words`);
 * }
 * ```
 */
export function analyzeSpeakers(
  transcript: Transcript,
  options: SpeakerAnalyticsOptions = {}
): SpeakerAnalytics {
  const {
    mergeSpeakersByName = true,
    roundPercentages = true,
    unbalancedThreshold = 40,
    dominatedThreshold = 60,
  } = options;

  const sentences = transcript.sentences ?? [];
  if (sentences.length === 0) {
    return emptyAnalytics();
  }

  // Group sentences by speaker (by name when merging, by ID otherwise)
  const speakerMap = new Map<string, SpeakerData>();
  let prevSpeakerKey: string | null = null;

  for (const sentence of sentences) {
    const groupKey = mergeSpeakersByName ? sentence.speaker_name : sentence.speaker_id;
    const data = getOrCreateSpeakerData(speakerMap, groupKey, sentence);
    data.sentences.push(sentence);
    data.talkTime += parseDuration(sentence);
    data.wordCount += countWords(sentence.text);

    // Count turns (speaker changes based on grouping key)
    if (groupKey !== prevSpeakerKey) {
      data.turnCount++;
      prevSpeakerKey = groupKey;
    }
  }

  // Calculate totals
  const totalTalkTime = sumTalkTime(speakerMap);
  const totalDuration = calculateDuration(sentences);
  const totalWords = sumWords(speakerMap);

  // Build speaker stats
  const speakers = buildSpeakerStats(speakerMap, totalTalkTime, roundPercentages);

  // Sort by talk time descending
  speakers.sort((a, b) => b.talkTime - a.talkTime);

  const dominant = speakers[0];

  return {
    speakers,
    totalDuration,
    totalTalkTime,
    totalSentences: sentences.length,
    totalWords,
    dominantSpeaker: dominant?.name ?? '',
    dominantSpeakerPercentage: dominant?.talkTimePercentage ?? 0,
    balance: classifyBalance(speakers, unbalancedThreshold, dominatedThreshold),
  };
}

function emptyAnalytics(): SpeakerAnalytics {
  return {
    speakers: [],
    totalDuration: 0,
    totalTalkTime: 0,
    totalSentences: 0,
    totalWords: 0,
    dominantSpeaker: '',
    dominantSpeakerPercentage: 0,
    balance: 'balanced',
  };
}

function getOrCreateSpeakerData(
  speakerMap: Map<string, SpeakerData>,
  groupKey: string,
  sentence: Sentence
): SpeakerData {
  let data = speakerMap.get(groupKey);
  if (!data) {
    data = {
      id: sentence.speaker_id, // Use first encountered ID
      name: sentence.speaker_name,
      sentences: [],
      talkTime: 0,
      wordCount: 0,
      turnCount: 0,
    };
    speakerMap.set(groupKey, data);
  }
  return data;
}

function parseDuration(sentence: Sentence): number {
  const start = Number.parseFloat(sentence.start_time);
  const end = Number.parseFloat(sentence.end_time);
  return Math.max(0, end - start);
}

function countWords(text: string): number {
  if (!text || text.length === 0) return 0;
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

function sumTalkTime(speakerMap: Map<string, SpeakerData>): number {
  let total = 0;
  for (const data of speakerMap.values()) {
    total += data.talkTime;
  }
  return total;
}

function sumWords(speakerMap: Map<string, SpeakerData>): number {
  let total = 0;
  for (const data of speakerMap.values()) {
    total += data.wordCount;
  }
  return total;
}

function calculateDuration(sentences: Sentence[]): number {
  if (sentences.length === 0) return 0;
  const lastSentence = sentences[sentences.length - 1];
  return Number.parseFloat(lastSentence?.end_time ?? '0');
}

function buildSpeakerStats(
  speakerMap: Map<string, SpeakerData>,
  totalTalkTime: number,
  roundPercentages: boolean
): SpeakerStats[] {
  const speakers: SpeakerStats[] = [];

  for (const data of speakerMap.values()) {
    const percentage = totalTalkTime > 0 ? (data.talkTime / totalTalkTime) * 100 : 0;
    const sentenceCount = data.sentences.length;
    const talkTimeMinutes = data.talkTime / 60;
    const wordsPerMinute = talkTimeMinutes > 0 ? data.wordCount / talkTimeMinutes : 0;
    const averageSentenceLength = sentenceCount > 0 ? data.wordCount / sentenceCount : 0;

    speakers.push({
      name: data.name,
      id: data.id,
      talkTime: data.talkTime,
      talkTimePercentage: roundPercentages ? Math.round(percentage) : percentage,
      sentenceCount,
      wordCount: data.wordCount,
      wordsPerMinute: roundPercentages ? Math.round(wordsPerMinute) : wordsPerMinute,
      averageSentenceLength,
      turnCount: data.turnCount,
    });
  }

  return speakers;
}

function classifyBalance(
  speakers: SpeakerStats[],
  unbalancedThreshold: number,
  dominatedThreshold: number
): 'balanced' | 'unbalanced' | 'dominated' {
  if (speakers.length <= 2) return 'balanced';
  const top = speakers[0]?.talkTimePercentage ?? 0;
  if (top > dominatedThreshold) return 'dominated';
  if (top > unbalancedThreshold) return 'unbalanced';
  return 'balanced';
}
