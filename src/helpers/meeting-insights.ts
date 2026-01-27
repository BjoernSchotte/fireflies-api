import type { Sentence, Transcript } from '../types/transcript.js';

// Re-export types for convenience
export type {
  DayOfWeekStats,
  DayStats,
  MeetingInsights,
  MeetingInsightsOptions,
  ParticipantStats,
  SpeakerInsightStats,
  TimeGroupStats,
} from '../types/meeting-insights.js';

import type {
  DayOfWeekStats,
  DayStats,
  MeetingInsights,
  MeetingInsightsOptions,
  ParticipantStats,
  SpeakerInsightStats,
  TimeGroupStats,
} from '../types/meeting-insights.js';

/**
 * Analyze multiple transcripts to compute aggregate meeting statistics.
 *
 * Pure function - no API calls, fully testable. Computes duration totals,
 * day of week distribution, participant counts, speaker talk times, and
 * time-based groupings.
 *
 * @param transcripts - Array of transcripts to analyze
 * @param options - Analysis options for filtering and grouping
 * @returns Aggregate meeting insights
 *
 * @example
 * ```typescript
 * import { FirefliesClient, analyzeMeetings } from 'fireflies-api';
 *
 * const client = new FirefliesClient({ apiKey: 'your-api-key' });
 *
 * // Fetch transcripts
 * const transcripts: Transcript[] = [];
 * for await (const t of client.transcripts.listAll({ mine: true })) {
 *   transcripts.push(t);
 * }
 *
 * // Analyze
 * const insights = analyzeMeetings(transcripts, {
 *   groupBy: 'week',
 *   topSpeakersCount: 5,
 * });
 *
 * console.log(`${insights.totalMeetings} meetings, ${insights.totalDurationMinutes} minutes total`);
 * console.log(`Average: ${insights.averageDurationMinutes} minutes`);
 * ```
 */
export function analyzeMeetings(
  transcripts: Transcript[],
  options: MeetingInsightsOptions = {}
): MeetingInsights {
  const { speakers, groupBy, topSpeakersCount = 10, topParticipantsCount = 10 } = options;

  if (transcripts.length === 0) {
    return emptyInsights();
  }

  // Calculate summary stats
  const totalDurationMinutes = sumDurations(transcripts);
  const averageDurationMinutes = totalDurationMinutes / transcripts.length;

  // Calculate day of week distribution
  const byDayOfWeek = calculateDayOfWeekStats(transcripts);

  // Calculate time group stats if requested
  const byTimeGroup = groupBy ? calculateTimeGroupStats(transcripts, groupBy) : undefined;

  // Calculate participant stats
  const participantData = aggregateParticipants(transcripts);
  const totalUniqueParticipants = participantData.uniqueEmails.size;
  const averageParticipantsPerMeeting = calculateAverageParticipants(transcripts);
  const topParticipants = buildTopParticipants(participantData.stats, topParticipantsCount);

  // Calculate speaker stats
  const speakerData = aggregateSpeakers(transcripts, speakers);
  const totalUniqueSpeakers = speakerData.uniqueNames.size;
  const topSpeakers = buildTopSpeakers(speakerData.stats, topSpeakersCount);

  // Calculate date range
  const { earliestMeeting, latestMeeting } = findDateRange(transcripts);

  return {
    totalMeetings: transcripts.length,
    totalDurationMinutes,
    averageDurationMinutes,
    byDayOfWeek,
    byTimeGroup,
    totalUniqueParticipants,
    averageParticipantsPerMeeting,
    topParticipants,
    totalUniqueSpeakers,
    topSpeakers,
    earliestMeeting,
    latestMeeting,
  };
}

function emptyInsights(): MeetingInsights {
  return {
    totalMeetings: 0,
    totalDurationMinutes: 0,
    averageDurationMinutes: 0,
    byDayOfWeek: emptyDayOfWeekStats(),
    byTimeGroup: undefined,
    totalUniqueParticipants: 0,
    averageParticipantsPerMeeting: 0,
    topParticipants: [],
    totalUniqueSpeakers: 0,
    topSpeakers: [],
    earliestMeeting: '',
    latestMeeting: '',
  };
}

function emptyDayOfWeekStats(): DayOfWeekStats {
  const emptyDay = (): DayStats => ({ count: 0, totalMinutes: 0 });
  return {
    monday: emptyDay(),
    tuesday: emptyDay(),
    wednesday: emptyDay(),
    thursday: emptyDay(),
    friday: emptyDay(),
    saturday: emptyDay(),
    sunday: emptyDay(),
  };
}

function sumDurations(transcripts: Transcript[]): number {
  return transcripts.reduce((sum, t) => sum + (t.duration ?? 0), 0);
}

function calculateDayOfWeekStats(transcripts: Transcript[]): DayOfWeekStats {
  const stats = emptyDayOfWeekStats();
  const dayNames: (keyof DayOfWeekStats)[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];

  for (const t of transcripts) {
    const date = parseDate(t.dateString);
    if (!date) continue;

    const dayIndex = date.getUTCDay();
    const dayName = dayNames[dayIndex];
    if (dayName) {
      stats[dayName].count++;
      stats[dayName].totalMinutes += t.duration ?? 0;
    }
  }

  return stats;
}

function calculateTimeGroupStats(
  transcripts: Transcript[],
  groupBy: 'day' | 'week' | 'month'
): TimeGroupStats[] {
  const groups = new Map<string, { count: number; totalMinutes: number }>();

  for (const t of transcripts) {
    const date = parseDate(t.dateString);
    if (!date) continue;

    const period = formatPeriod(date, groupBy);
    const existing = groups.get(period) ?? { count: 0, totalMinutes: 0 };
    existing.count++;
    existing.totalMinutes += t.duration ?? 0;
    groups.set(period, existing);
  }

  // Convert to array and sort chronologically
  const result: TimeGroupStats[] = [];
  for (const [period, data] of groups) {
    result.push({
      period,
      count: data.count,
      totalMinutes: data.totalMinutes,
      averageMinutes: data.totalMinutes / data.count,
    });
  }

  result.sort((a, b) => a.period.localeCompare(b.period));
  return result;
}

function formatPeriod(date: Date, groupBy: 'day' | 'week' | 'month'): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  switch (groupBy) {
    case 'day':
      return `${year}-${month}-${day}`;
    case 'week':
      return getISOWeek(date);
    case 'month':
      return `${year}-${month}`;
  }
}

function getISOWeek(date: Date): string {
  // ISO week calculation
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Set to nearest Thursday: current date + 4 - current day number (Sunday = 0, Thursday = 4)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calculate full weeks to nearest Thursday
  const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

interface ParticipantData {
  uniqueEmails: Set<string>;
  stats: Map<string, { meetingCount: number; totalMinutes: number }>;
}

function aggregateParticipants(transcripts: Transcript[]): ParticipantData {
  const uniqueEmails = new Set<string>();
  const stats = new Map<string, { meetingCount: number; totalMinutes: number }>();

  for (const t of transcripts) {
    const participants = t.participants ?? [];
    const seenInMeeting = new Set<string>();

    for (const email of participants) {
      const normalizedEmail = email.toLowerCase();

      // Track unique participants
      uniqueEmails.add(normalizedEmail);

      // Avoid counting same participant twice in one meeting
      if (seenInMeeting.has(normalizedEmail)) continue;
      seenInMeeting.add(normalizedEmail);

      // Update stats
      const existing = stats.get(normalizedEmail) ?? { meetingCount: 0, totalMinutes: 0 };
      existing.meetingCount++;
      existing.totalMinutes += t.duration ?? 0;
      stats.set(normalizedEmail, existing);
    }
  }

  return { uniqueEmails, stats };
}

function calculateAverageParticipants(transcripts: Transcript[]): number {
  if (transcripts.length === 0) return 0;

  let totalParticipants = 0;
  for (const t of transcripts) {
    // Deduplicate within each meeting
    const unique = new Set((t.participants ?? []).map((p) => p.toLowerCase()));
    totalParticipants += unique.size;
  }

  return totalParticipants / transcripts.length;
}

function buildTopParticipants(
  stats: Map<string, { meetingCount: number; totalMinutes: number }>,
  limit: number
): ParticipantStats[] {
  const result: ParticipantStats[] = [];

  for (const [email, data] of stats) {
    result.push({
      email,
      meetingCount: data.meetingCount,
      totalMinutes: data.totalMinutes,
    });
  }

  // Sort by meeting count descending
  result.sort((a, b) => b.meetingCount - a.meetingCount);

  return result.slice(0, limit);
}

interface SpeakerData {
  uniqueNames: Set<string>;
  stats: Map<string, { meetingCount: number; totalTalkTimeSeconds: number; meetings: Set<string> }>;
}

function aggregateSpeakers(transcripts: Transcript[], filterSpeakers?: string[]): SpeakerData {
  const uniqueNames = new Set<string>();
  const stats = new Map<
    string,
    { meetingCount: number; totalTalkTimeSeconds: number; meetings: Set<string> }
  >();

  const filterSet = filterSpeakers ? new Set(filterSpeakers) : null;

  for (const t of transcripts) {
    const sentences = t.sentences ?? [];

    for (const sentence of sentences) {
      const speakerName = sentence.speaker_name;

      // Skip if filtering and speaker not in filter list
      if (filterSet && !filterSet.has(speakerName)) continue;

      uniqueNames.add(speakerName);

      const existing = stats.get(speakerName) ?? {
        meetingCount: 0,
        totalTalkTimeSeconds: 0,
        meetings: new Set<string>(),
      };

      // Add talk time
      const duration = parseSentenceDuration(sentence);
      existing.totalTalkTimeSeconds += duration;

      // Track unique meetings
      if (!existing.meetings.has(t.id)) {
        existing.meetings.add(t.id);
        existing.meetingCount++;
      }

      stats.set(speakerName, existing);
    }
  }

  return { uniqueNames, stats };
}

function parseSentenceDuration(sentence: Sentence): number {
  const start = Number.parseFloat(sentence.start_time);
  const end = Number.parseFloat(sentence.end_time);
  return Math.max(0, end - start);
}

function buildTopSpeakers(
  stats: Map<string, { meetingCount: number; totalTalkTimeSeconds: number; meetings: Set<string> }>,
  limit: number
): SpeakerInsightStats[] {
  const result: SpeakerInsightStats[] = [];

  for (const [name, data] of stats) {
    result.push({
      name,
      meetingCount: data.meetingCount,
      totalTalkTimeSeconds: data.totalTalkTimeSeconds,
      averageTalkTimeSeconds:
        data.meetingCount > 0 ? data.totalTalkTimeSeconds / data.meetingCount : 0,
    });
  }

  // Sort by total talk time descending
  result.sort((a, b) => b.totalTalkTimeSeconds - a.totalTalkTimeSeconds);

  return result.slice(0, limit);
}

function findDateRange(transcripts: Transcript[]): {
  earliestMeeting: string;
  latestMeeting: string;
} {
  let earliest: Date | null = null;
  let latest: Date | null = null;

  for (const t of transcripts) {
    const date = parseDate(t.dateString);
    if (!date) continue;

    if (!earliest || date < earliest) {
      earliest = date;
    }
    if (!latest || date > latest) {
      latest = date;
    }
  }

  return {
    earliestMeeting: earliest ? formatDateOnly(earliest) : '',
    latestMeeting: latest ? formatDateOnly(latest) : '',
  };
}

function parseDate(dateString: string | undefined): Date | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
