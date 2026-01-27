/**
 * Search helper functions for searching transcript content.
 */

import type { SearchMatch, SearchTranscriptOptions } from '../types/search.js';
import type { Sentence, Transcript } from '../types/transcript.js';

/**
 * Escape special regex characters in a string for literal matching.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if a sentence passes the speaker filter.
 */
function matchesSpeaker(sentence: Sentence, speakerSet: Set<string> | null): boolean {
  if (!speakerSet) return true;
  return speakerSet.has(sentence.speaker_name.toLowerCase());
}

/**
 * Check if a sentence passes the AI filter requirements.
 */
function matchesAIFilters(
  sentence: Sentence,
  filterQuestions: boolean,
  filterTasks: boolean
): boolean {
  if (!filterQuestions && !filterTasks) return true;

  const hasQuestion = Boolean(sentence.ai_filters?.question);
  const hasTask = Boolean(sentence.ai_filters?.task);

  // If both filters are set, match either (OR logic)
  if (filterQuestions && filterTasks) {
    return hasQuestion || hasTask;
  }

  if (filterQuestions) return hasQuestion;
  if (filterTasks) return hasTask;

  return true;
}

/**
 * Extract context sentences before and after a given index.
 */
function extractContext(
  sentences: Sentence[],
  index: number,
  contextLines: number
): SearchMatch['context'] {
  const beforeStart = Math.max(0, index - contextLines);
  const afterEnd = Math.min(sentences.length, index + contextLines + 1);

  return {
    before: sentences.slice(beforeStart, index).map((s) => ({
      speakerName: s.speaker_name,
      text: s.text,
    })),
    after: sentences.slice(index + 1, afterEnd).map((s) => ({
      speakerName: s.speaker_name,
      text: s.text,
    })),
  };
}

/**
 * Convert a Sentence to the match result format.
 */
function sentenceToMatch(
  sentence: Sentence,
  transcript: Transcript,
  context: SearchMatch['context']
): SearchMatch {
  return {
    transcriptId: transcript.id,
    transcriptTitle: transcript.title,
    transcriptDate: transcript.dateString,
    transcriptUrl: transcript.transcript_url,
    sentence: {
      index: sentence.index,
      text: sentence.text,
      speakerName: sentence.speaker_name,
      startTime: Number.parseFloat(sentence.start_time),
      endTime: Number.parseFloat(sentence.end_time),
      isQuestion: Boolean(sentence.ai_filters?.question),
      isTask: Boolean(sentence.ai_filters?.task),
    },
    context,
  };
}

/**
 * Search a single transcript for matching sentences.
 *
 * This is a pure function with no API calls, making it fully testable.
 * It searches the transcript's sentences for text matching the query,
 * optionally filtering by speaker, questions, or tasks.
 *
 * @param transcript - The transcript to search
 * @param options - Search options including query, filters, and context settings
 * @returns Array of matches with context
 *
 * @example
 * ```typescript
 * import { searchTranscript } from 'fireflies-api';
 *
 * const matches = searchTranscript(transcript, {
 *   query: 'budget',
 *   speakers: ['Alice'],
 *   filterQuestions: true,
 *   contextLines: 2,
 * });
 *
 * for (const match of matches) {
 *   console.log(`${match.sentence.speakerName}: ${match.sentence.text}`);
 * }
 * ```
 */
export function searchTranscript(
  transcript: Transcript,
  options: SearchTranscriptOptions
): SearchMatch[] {
  const {
    query,
    caseSensitive = false,
    speakers,
    filterQuestions = false,
    filterTasks = false,
    contextLines = 1,
  } = options;

  // Empty query matches nothing
  if (!query || query.trim() === '') {
    return [];
  }

  const sentences = transcript.sentences ?? [];
  if (sentences.length === 0) {
    return [];
  }

  // Build regex for query matching
  const escapedQuery = escapeRegex(query);
  const regex = new RegExp(escapedQuery, caseSensitive ? '' : 'i');

  // Normalize speakers list for case-insensitive comparison
  const speakerSet = speakers ? new Set(speakers.map((s) => s.toLowerCase())) : null;

  const matches: SearchMatch[] = [];

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    if (!sentence) continue;

    // Check text match
    if (!regex.test(sentence.text)) continue;

    // Check speaker filter
    if (!matchesSpeaker(sentence, speakerSet)) continue;

    // Check AI filter requirements
    if (!matchesAIFilters(sentence, filterQuestions, filterTasks)) continue;

    // Build match result
    const context = extractContext(sentences, i, contextLines);
    matches.push(sentenceToMatch(sentence, transcript, context));
  }

  return matches;
}
