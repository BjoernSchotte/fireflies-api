import type { Transcript } from '../types/transcript.js';

/**
 * A question asked by an external participant.
 */
export interface ExternalQuestion {
  /** The question text */
  text: string;
  /** Name of the speaker who asked the question */
  speakerName: string;
  /** Email of the speaker (if available from attendees) */
  speakerEmail?: string;
  /** Index of the sentence in the transcript */
  sentenceIndex: number;
  /** Start time as decimal seconds string */
  startTime: string;
  /** End time as decimal seconds string */
  endTime: string;
}

/**
 * Result of finding external participant questions.
 */
export interface ExternalQuestionsResult {
  /** List of external participants identified */
  externalParticipants: Array<{ name: string; email?: string }>;
  /** Questions asked by external participants */
  questions: ExternalQuestion[];
  /** Total count of questions */
  totalQuestions: number;
}

/**
 * Find questions asked by external participants in a transcript.
 *
 * This function analyzes a transcript to identify questions from participants
 * whose email domains don't match the specified internal domains.
 *
 * @param transcript - The transcript to analyze
 * @param internalDomains - Internal domain(s) to identify internal participants.
 *   Can be a single domain string (e.g., '@mycompany.com' or 'mycompany.com')
 *   or an array of domains.
 * @returns Object containing external participants, their questions, and count
 *
 * @example
 * ```typescript
 * const transcript = await client.transcripts.get('id');
 * const result = findExternalParticipantQuestions(transcript, '@mycompany.com');
 *
 * console.log(`Found ${result.totalQuestions} questions from external participants`);
 * for (const q of result.questions) {
 *   console.log(`${q.speakerName}: ${q.text}`);
 * }
 * ```
 */
export function findExternalParticipantQuestions(
  transcript: Transcript,
  internalDomains: string | string[]
): ExternalQuestionsResult {
  // Normalize domains to array and ensure they start with @
  const domains = normalizeDomains(internalDomains);

  // Build speaker name -> email mapping from meeting_attendees
  const speakerEmailMap = buildSpeakerEmailMap(transcript);

  // Classify speakers as internal/external
  const { externalSpeakers } = classifySpeakers(transcript, speakerEmailMap, domains);

  // Find questions from external speakers
  const questions: ExternalQuestion[] = [];

  for (const sentence of transcript.sentences ?? []) {
    // Check if this is a question
    if (!sentence.ai_filters?.question) {
      continue;
    }

    // Check if speaker is external
    if (!externalSpeakers.has(sentence.speaker_name)) {
      continue;
    }

    questions.push({
      text: sentence.text,
      speakerName: sentence.speaker_name,
      speakerEmail: speakerEmailMap.get(sentence.speaker_name),
      sentenceIndex: sentence.index,
      startTime: sentence.start_time,
      endTime: sentence.end_time,
    });
  }

  // Build external participants list
  const externalParticipants = Array.from(externalSpeakers).map((name) => ({
    name,
    email: speakerEmailMap.get(name),
  }));

  return {
    externalParticipants,
    questions,
    totalQuestions: questions.length,
  };
}

/**
 * Normalize domain input to array of lowercase domains with @ prefix.
 */
function normalizeDomains(input: string | string[]): string[] {
  const raw = Array.isArray(input) ? input : [input];
  return raw.map((d) => {
    const domain = d.toLowerCase().trim();
    return domain.startsWith('@') ? domain : `@${domain}`;
  });
}

/**
 * Build a map of speaker names to email addresses from meeting_attendees.
 */
function buildSpeakerEmailMap(transcript: Transcript): Map<string, string> {
  const map = new Map<string, string>();

  for (const attendee of transcript.meeting_attendees ?? []) {
    // Map by display name
    if (attendee.displayName && attendee.email) {
      map.set(attendee.displayName, attendee.email.toLowerCase());
    }
    // Also map by full name
    if (attendee.name && attendee.email) {
      map.set(attendee.name, attendee.email.toLowerCase());
    }
  }

  return map;
}

/**
 * Classify speakers as internal or external based on their email domain.
 */
function classifySpeakers(
  transcript: Transcript,
  speakerEmailMap: Map<string, string>,
  internalDomains: string[]
): { internalSpeakers: Set<string>; externalSpeakers: Set<string> } {
  const internalSpeakers = new Set<string>();
  const externalSpeakers = new Set<string>();

  // Get unique speaker names from sentences
  const speakerNames = new Set((transcript.sentences ?? []).map((s) => s.speaker_name));

  for (const name of speakerNames) {
    const email = speakerEmailMap.get(name);

    if (isInternal(email, internalDomains)) {
      internalSpeakers.add(name);
    } else {
      externalSpeakers.add(name);
    }
  }

  return { internalSpeakers, externalSpeakers };
}

/**
 * Check if an email belongs to an internal domain.
 * Speakers without email are considered external (conservative default).
 */
function isInternal(email: string | undefined, internalDomains: string[]): boolean {
  if (!email) {
    return false;
  }

  const lowerEmail = email.toLowerCase();
  return internalDomains.some((domain) => lowerEmail.endsWith(domain));
}
