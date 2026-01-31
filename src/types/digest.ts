import type { ActionItem } from '../helpers/action-items.js';

/**
 * Statistics about meetings for a digest period.
 */
export interface DigestStats {
  /** Total number of meetings */
  totalMeetings: number;
  /** Total duration in minutes */
  totalMinutes: number;
  /** Average meeting duration in minutes */
  averageDuration: number;
  /** Day with most meetings (e.g., "monday") */
  busiestDay: string;
  /** Meeting count by day of week */
  meetingsByDay: Record<string, number>;
}

/**
 * A highlight extracted from a meeting summary.
 */
export interface DigestHighlight {
  /** ID of the source transcript */
  meetingId: string;
  /** Title of the meeting */
  meetingTitle: string;
  /** Date of the meeting (ISO 8601) */
  meetingDate: string;
  /** Key points extracted from the summary */
  keyPoints: string[];
  /** Decisions made in the meeting */
  decisions: string[];
}

/**
 * Participant statistics across the digest period.
 */
export interface DigestParticipant {
  /** Normalized email address */
  email: string;
  /** Display name (if available) */
  name: string;
  /** Number of meetings attended */
  meetingCount: number;
  /** Total time in meetings (minutes) */
  totalMinutes: number;
}

/**
 * Action item with source meeting context.
 */
export interface DigestActionItem extends ActionItem {
  /** ID of the source transcript */
  transcriptId: string;
  /** Title of the source meeting */
  transcriptTitle: string;
  /** Date of the source meeting (ISO 8601) */
  transcriptDate: string;
}

/**
 * Participant info with email and resolved name.
 */
export interface DigestParticipantInfo {
  /** Email address */
  email: string;
  /** Display name (from meeting_attendees or extracted from email) */
  name: string;
}

/**
 * Action items grouped by meeting with meeting context.
 */
export interface DigestMeetingWithActionItems {
  /** Transcript ID */
  id: string;
  /** Meeting title */
  title: string;
  /** Meeting date (ISO 8601) */
  date: string;
  /** Duration in minutes */
  duration: number;
  /** List of participants with name and email */
  participants: DigestParticipantInfo[];
  /** Action items from this meeting */
  items: DigestActionItem[];
}

/**
 * Aggregated action items organized for digest display.
 */
export interface DigestActionItems {
  /** Total count of action items */
  total: number;
  /** Action items grouped by assignee */
  byAssignee: Record<string, DigestActionItem[]>;
  /** Action items grouped by meeting */
  byMeeting: DigestMeetingWithActionItems[];
  /** Action items without an assignee */
  unassigned: DigestActionItem[];
  /** Action items with due dates */
  withDueDates: DigestActionItem[];
}

/**
 * Summary of a single meeting for digest listing.
 */
export interface DigestMeeting {
  /** Transcript ID */
  id: string;
  /** Meeting title */
  title: string;
  /** Meeting date (ISO 8601) */
  date: string;
  /** Duration in minutes */
  duration: number;
  /** Number of participants */
  participants: number;
}

/**
 * Options for building a digest from transcripts.
 */
export interface DigestBuildOptions {
  /** Include action items section (default: true) */
  includeActionItems?: boolean;
  /** Include highlights section (default: true) */
  includeHighlights?: boolean;
  /** Include statistics section (default: true) */
  includeStats?: boolean;
  /** Include sentiment analysis (default: false) */
  includeSentiment?: boolean;
  /** Group meetings by category (default: 'none') */
  groupBy?: 'day' | 'category' | 'participant' | 'none';
}

/**
 * Options for rendering a digest to output.
 */
export interface RenderOptions {
  /**
   * Template to use for rendering.
   * Can be a built-in name ('default', 'compact', 'executive')
   * or a path to a custom .md template file.
   */
  template?: 'default' | 'compact' | 'executive' | string;
}

/**
 * Weekly digest aggregating meeting insights.
 */
export interface WeeklyDigest {
  /** Date range covered by the digest */
  period: {
    /** Start date (ISO 8601 date string) */
    from: string;
    /** End date (ISO 8601 date string) */
    to: string;
  };
  /** Total number of meetings */
  totalMeetings: number;
  /** Total duration across all meetings (minutes) */
  totalDuration: number;
  /** Meeting statistics */
  stats: DigestStats;
  /** Aggregated action items */
  actionItems: DigestActionItems;
  /** Highlights from meetings */
  highlights: DigestHighlight[];
  /** Participant statistics */
  participants: DigestParticipant[];
  /** List of meetings in the period */
  meetings: DigestMeeting[];
  /** Overall sentiment (if enabled) */
  sentiment?: {
    /** Average sentiment score (0-100) */
    overall: number;
    /** Trend compared to previous period */
    trend: 'improving' | 'stable' | 'declining';
  };
}
