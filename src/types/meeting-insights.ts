/**
 * Options for the analyzeMeetings helper function.
 */
export interface MeetingInsightsOptions {
  /**
   * Only include stats for these speakers.
   * Speaker names must match exactly (case-sensitive).
   */
  speakers?: string[];

  /**
   * Group results by time period.
   * - 'day': Group by calendar day (YYYY-MM-DD)
   * - 'week': Group by ISO week (YYYY-Www)
   * - 'month': Group by month (YYYY-MM)
   */
  groupBy?: 'day' | 'week' | 'month';

  /**
   * Number of top speakers to include in results.
   * @default 10
   */
  topSpeakersCount?: number;

  /**
   * Number of top participants to include in results.
   * @default 10
   */
  topParticipantsCount?: number;
}

/**
 * Aggregate meeting statistics across multiple transcripts.
 */
export interface MeetingInsights {
  /** Total number of meetings analyzed */
  totalMeetings: number;

  /** Sum of all meeting durations in minutes */
  totalDurationMinutes: number;

  /** Average meeting duration in minutes */
  averageDurationMinutes: number;

  /** Meeting distribution by day of week */
  byDayOfWeek: DayOfWeekStats;

  /** Meeting distribution by time period (if groupBy specified) */
  byTimeGroup?: TimeGroupStats[];

  /** Number of unique participants across all meetings */
  totalUniqueParticipants: number;

  /** Average number of participants per meeting */
  averageParticipantsPerMeeting: number;

  /** Top participants by meeting count */
  topParticipants: ParticipantStats[];

  /** Number of unique speakers across all meetings */
  totalUniqueSpeakers: number;

  /** Top speakers by talk time */
  topSpeakers: SpeakerInsightStats[];

  /** ISO date of the earliest meeting */
  earliestMeeting: string;

  /** ISO date of the latest meeting */
  latestMeeting: string;
}

/**
 * Meeting statistics grouped by day of week.
 */
export interface DayOfWeekStats {
  monday: DayStats;
  tuesday: DayStats;
  wednesday: DayStats;
  thursday: DayStats;
  friday: DayStats;
  saturday: DayStats;
  sunday: DayStats;
}

/**
 * Statistics for a single day of week.
 */
export interface DayStats {
  /** Number of meetings on this day */
  count: number;
  /** Total duration of meetings on this day in minutes */
  totalMinutes: number;
}

/**
 * Meeting statistics grouped by time period.
 */
export interface TimeGroupStats {
  /**
   * Period identifier:
   * - For 'day': "YYYY-MM-DD" (e.g., "2024-01-15")
   * - For 'week': "YYYY-Www" (e.g., "2024-W03")
   * - For 'month': "YYYY-MM" (e.g., "2024-01")
   */
  period: string;

  /** Number of meetings in this period */
  count: number;

  /** Total duration of meetings in this period in minutes */
  totalMinutes: number;

  /** Average meeting duration in this period in minutes */
  averageMinutes: number;
}

/**
 * Statistics for a single participant.
 */
export interface ParticipantStats {
  /** Participant email address */
  email: string;

  /** Number of meetings this participant attended */
  meetingCount: number;

  /** Total time spent in meetings in minutes */
  totalMinutes: number;
}

/**
 * Statistics for a single speaker.
 */
export interface SpeakerInsightStats {
  /** Speaker name from transcript */
  name: string;

  /** Number of meetings where this speaker spoke */
  meetingCount: number;

  /** Total talk time in seconds */
  totalTalkTimeSeconds: number;

  /** Average talk time per meeting in seconds */
  averageTalkTimeSeconds: number;
}
