import type { Speaker, Transcript } from './transcript.js';

/**
 * Options for normalizing a Fireflies transcript to provider-agnostic format.
 */
export interface NormalizationOptions {
  /**
   * Time unit for timestamps in sentences.
   * @default 'seconds'
   */
  timeUnit?: 'seconds' | 'milliseconds';

  /**
   * Include original Fireflies data in source.rawData.
   * @default false
   */
  includeRawData?: boolean;

  /**
   * Include AI-detected filters (sentiment, questions, tasks) in sentences.
   * @default true
   */
  includeAIFilters?: boolean;

  /**
   * Include summary data if available.
   * @default true
   */
  includeSummary?: boolean;

  /**
   * Custom speaker name resolver (e.g., map "Speaker 1" to real name).
   */
  resolveSpeakerName?: (speaker: Speaker, transcript: Transcript) => string;

  /**
   * Custom participant enrichment (e.g., add roles from external source).
   */
  enrichParticipant?: (email: string, transcript: Transcript) => Partial<NormalizedParticipant>;
}

/**
 * A provider-agnostic normalized meeting transcript.
 */
export interface NormalizedMeeting {
  /** Prefixed ID: "fireflies:abc123" */
  id: string;
  /** Meeting title */
  title: string;
  /** Meeting date */
  date: Date;
  /** Duration in seconds */
  duration: number;
  /** URL to view the transcript */
  url: string;

  /** Speakers identified in the transcript */
  speakers: NormalizedSpeaker[];
  /** Transcribed sentences */
  sentences: NormalizedSentence[];
  /** Meeting participants */
  participants: NormalizedParticipant[];

  /** AI-generated summary (if available and enabled) */
  summary?: NormalizedSummary;

  /** Meeting attendees with join/leave times */
  attendees?: NormalizedAttendee[];
  /** Channels the transcript is shared to */
  channels?: NormalizedChannel[];
  /** Meeting analytics */
  analytics?: NormalizedAnalytics;

  /** Source provider information */
  source: {
    provider: 'fireflies';
    originalId: string;
    rawData?: Transcript;
  };
}

/**
 * A normalized speaker in the transcript.
 */
export interface NormalizedSpeaker {
  /** Speaker ID */
  id: string;
  /** Speaker name */
  name: string;
}

/**
 * A normalized sentence in the transcript.
 */
export interface NormalizedSentence {
  /** Zero-based index */
  index: number;
  /** Speaker ID */
  speakerId: string;
  /** Speaker name */
  speakerName: string;
  /** Processed text */
  text: string;
  /** Original unprocessed text */
  rawText: string;
  /** Start time (in timeUnit) */
  startTime: number;
  /** End time (in timeUnit) */
  endTime: number;

  /** AI-detected sentiment */
  sentiment?: 'positive' | 'negative' | 'neutral';
  /** Whether this sentence is a question */
  isQuestion?: boolean;
  /** Whether this sentence is an action item */
  isActionItem?: boolean;
}

/**
 * A normalized meeting participant.
 */
export interface NormalizedParticipant {
  /** Participant name */
  name: string;
  /** Email address */
  email?: string;
  /** Role in the meeting */
  role?: 'organizer' | 'attendee';
}

/**
 * A normalized meeting summary.
 */
export interface NormalizedSummary {
  /** High-level overview */
  overview?: string;
  /** Key points or bullet summary */
  keyPoints?: string[];
  /** Action items text */
  actionItems?: string;
  /** Structured outline */
  outline?: string;
  /** Topics discussed */
  topics?: string[];
}

/**
 * A normalized meeting attendee with join/leave times.
 */
export interface NormalizedAttendee {
  /** Attendee name */
  name: string;
  /** Email address */
  email?: string;
  /** Phone number */
  phoneNumber?: string;
  /** Time they joined */
  joinTime?: Date;
  /** Time they left */
  leaveTime?: Date;
}

/**
 * A normalized channel.
 */
export interface NormalizedChannel {
  /** Channel ID */
  id: string;
  /** Channel title */
  title: string;
  /** Whether the channel is private */
  isPrivate: boolean;
}

/**
 * Normalized meeting analytics.
 */
export interface NormalizedAnalytics {
  /** Sentiment breakdown (percentages 0-100) */
  sentiments?: {
    positive: number;
    neutral: number;
    negative: number;
  };
}
