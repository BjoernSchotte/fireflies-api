import type {
  DigestActionItem,
  DigestActionItems,
  DigestBuildOptions,
  DigestHighlight,
  DigestMeeting,
  DigestMeetingWithActionItems,
  DigestParticipant,
  DigestStats,
  WeeklyDigest,
} from '../types/digest.js';
import type { Transcript } from '../types/transcript.js';
import { extractActionItems } from './action-items.js';

// Re-export types for convenience
export type {
  DigestActionItem,
  DigestActionItems,
  DigestBuildOptions,
  DigestHighlight,
  DigestMeeting,
  DigestMeetingWithActionItems,
  DigestParticipant,
  DigestStats,
  WeeklyDigest,
} from '../types/digest.js';

/**
 * Day names for mapping Date.getUTCDay() indices.
 */
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Calculate meeting statistics from transcripts. Pure function.
 *
 * @param transcripts - Array of transcripts to analyze
 * @returns Statistics including totals, averages, and by-day breakdown
 *
 * @example
 * ```typescript
 * const stats = calculateStats(transcripts);
 * console.log(`Busiest day: ${stats.busiestDay}`);
 * ```
 */
export function calculateStats(transcripts: Transcript[]): DigestStats {
  if (transcripts.length === 0) {
    return emptyStats();
  }

  const totalMinutes = sumDurations(transcripts);
  const meetingsByDay = calculateMeetingsByDay(transcripts);
  const busiestDay = findBusiestDay(meetingsByDay);

  return {
    totalMeetings: transcripts.length,
    totalMinutes,
    averageDuration: totalMinutes / transcripts.length,
    busiestDay,
    meetingsByDay,
  };
}

function emptyStats(): DigestStats {
  return {
    totalMeetings: 0,
    totalMinutes: 0,
    averageDuration: 0,
    busiestDay: '',
    meetingsByDay: {},
  };
}

function sumDurations(transcripts: Transcript[]): number {
  return transcripts.reduce((sum, t) => sum + (t.duration ?? 0), 0);
}

function calculateMeetingsByDay(transcripts: Transcript[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const t of transcripts) {
    const date = parseDate(t.dateString);
    if (!date) continue;

    const dayName = DAY_NAMES[date.getUTCDay()];
    if (dayName) {
      counts[dayName] = (counts[dayName] ?? 0) + 1;
    }
  }

  return counts;
}

function findBusiestDay(meetingsByDay: Record<string, number>): string {
  let busiestDay = '';
  let maxCount = 0;

  for (const [day, count] of Object.entries(meetingsByDay)) {
    if (count > maxCount) {
      maxCount = count;
      busiestDay = day;
    }
  }

  return busiestDay;
}

function parseDate(dateString: string | undefined): Date | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Maximum number of key points to extract per meeting.
 */
const MAX_KEY_POINTS_PER_MEETING = 5;

/**
 * Extract highlights from transcripts. Pure function.
 *
 * Parses summary.overview to extract key points and decisions from each meeting.
 *
 * @param transcripts - Array of transcripts to extract highlights from
 * @returns Array of highlights with key points and decisions
 *
 * @example
 * ```typescript
 * const highlights = extractHighlights(transcripts);
 * for (const h of highlights) {
 *   console.log(`${h.meetingTitle}: ${h.keyPoints.length} key points`);
 * }
 * ```
 */
export function extractHighlights(transcripts: Transcript[]): DigestHighlight[] {
  const highlights: DigestHighlight[] = [];

  for (const t of transcripts) {
    const overview = t.summary?.overview;
    if (!overview || overview.trim().length === 0) continue;

    const keyPoints = extractKeyPoints(overview);
    if (keyPoints.length === 0) continue;

    highlights.push({
      meetingId: t.id,
      meetingTitle: t.title,
      meetingDate: t.dateString,
      keyPoints,
      decisions: extractDecisions(t),
    });
  }

  return highlights;
}

/**
 * Split overview into sentences and limit to max key points.
 */
function extractKeyPoints(overview: string): string[] {
  // Split by sentence-ending punctuation
  const sentences = overview
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim().replace(/[.!?]$/, ''))
    // Strip leading "- " from bullet points (Fireflies often adds these)
    .map((s) => s.replace(/^-\s*/, ''))
    .filter((s) => s.length > 0);

  return sentences.slice(0, MAX_KEY_POINTS_PER_MEETING);
}

/**
 * Extract decisions from transcript summary.
 * Looks for decision-related keywords in overview and keywords.
 */
function extractDecisions(transcript: Transcript): string[] {
  const decisions: string[] = [];
  const overview = transcript.summary?.overview ?? '';

  // Look for sentences with "decided" or "decision" keywords
  const decisionPattern = /(?:^|[.!?]\s*)([^.!?]*(?:decided?|decision|agreed|approved)[^.!?]*)/gi;

  for (;;) {
    const match = decisionPattern.exec(overview);
    if (!match) break;
    if (match[1]) {
      decisions.push(match[1].trim());
    }
  }

  return decisions;
}

/**
 * Aggregate participants from transcripts. Pure function.
 *
 * Deduplicates by normalized email, counts meetings and total time per participant.
 *
 * @param transcripts - Array of transcripts to aggregate
 * @returns Array of participant stats sorted by meeting count descending
 *
 * @example
 * ```typescript
 * const participants = aggregateParticipants(transcripts);
 * console.log(`Top participant: ${participants[0]?.email}`);
 * ```
 */
export function aggregateParticipants(transcripts: Transcript[]): DigestParticipant[] {
  const stats = new Map<string, { name: string; meetingCount: number; totalMinutes: number }>();

  for (const t of transcripts) {
    const participants = t.participants ?? [];
    const seenInMeeting = new Set<string>();

    for (const email of participants) {
      const normalizedEmail = email.toLowerCase();

      // Skip duplicate within same meeting
      if (seenInMeeting.has(normalizedEmail)) continue;
      seenInMeeting.add(normalizedEmail);

      const existing = stats.get(normalizedEmail) ?? {
        name: extractNameFromEmail(email),
        meetingCount: 0,
        totalMinutes: 0,
      };

      existing.meetingCount++;
      existing.totalMinutes += t.duration ?? 0;
      stats.set(normalizedEmail, existing);
    }
  }

  // Convert to array and sort by meeting count descending
  const result: DigestParticipant[] = [];
  for (const [email, data] of stats) {
    result.push({
      email,
      name: data.name,
      meetingCount: data.meetingCount,
      totalMinutes: data.totalMinutes,
    });
  }

  result.sort((a, b) => b.meetingCount - a.meetingCount);
  return result;
}

/**
 * Extract display name from email address.
 */
function extractNameFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? email;
  return localPart;
}

/**
 * Aggregate action items from transcripts for digest display. Pure function.
 *
 * Reuses existing extractActionItems() and groups by assignee, with
 * separate collections for unassigned and items with due dates.
 *
 * @param transcripts - Array of transcripts to aggregate
 * @returns Aggregated action items organized for digest
 *
 * @example
 * ```typescript
 * const actionItems = aggregateActionItemsForDigest(transcripts);
 * console.log(`${actionItems.total} total items`);
 * console.log(`Unassigned: ${actionItems.unassigned.length}`);
 * ```
 */
export function aggregateActionItemsForDigest(transcripts: Transcript[]): DigestActionItems {
  if (transcripts.length === 0) {
    return emptyActionItems();
  }

  const byAssignee: Record<string, DigestActionItem[]> = {};
  const byMeeting: DigestMeetingWithActionItems[] = [];
  const unassigned: DigestActionItem[] = [];
  const withDueDates: DigestActionItem[] = [];
  let total = 0;

  for (const t of transcripts) {
    const result = extractActionItems(t);
    const meetingItems: DigestActionItem[] = [];

    for (const item of result.items) {
      const digestItem: DigestActionItem = {
        ...item,
        transcriptId: t.id,
        transcriptTitle: t.title,
        transcriptDate: t.dateString,
      };

      total++;
      meetingItems.push(digestItem);

      // Group by assignee
      if (item.assignee) {
        const existing = byAssignee[item.assignee] ?? [];
        existing.push(digestItem);
        byAssignee[item.assignee] = existing;
      } else {
        unassigned.push(digestItem);
      }

      // Track items with due dates
      if (item.dueDate) {
        withDueDates.push(digestItem);
      }
    }

    // Add meeting with its action items (even if empty, for completeness)
    if (meetingItems.length > 0) {
      byMeeting.push({
        id: t.id,
        title: t.title,
        date: t.dateString,
        duration: t.duration ?? 0,
        participantEmails: t.participants ?? [],
        items: meetingItems,
      });
    }
  }

  return { total, byAssignee, byMeeting, unassigned, withDueDates };
}

function emptyActionItems(): DigestActionItems {
  return {
    total: 0,
    byAssignee: {},
    byMeeting: [],
    unassigned: [],
    withDueDates: [],
  };
}

/**
 * Build a digest from transcripts. Pure function - no API calls.
 *
 * Combines all aggregation helpers to produce a complete weekly digest.
 *
 * @param transcripts - Array of transcripts to aggregate
 * @param options - Build options for filtering sections
 * @returns Weekly digest with stats, action items, highlights, and participants
 *
 * @example
 * ```typescript
 * const transcripts = await client.transcripts.list({ period: 'last-week' });
 * const digest = buildDigest(transcripts, {
 *   includeActionItems: true,
 *   includeHighlights: true,
 * });
 * console.log(`${digest.totalMeetings} meetings`);
 * ```
 */
export function buildDigest(
  transcripts: Transcript[],
  options: DigestBuildOptions = {}
): WeeklyDigest {
  const { includeActionItems = true, includeHighlights = true, includeStats = true } = options;

  if (transcripts.length === 0) {
    return emptyDigest();
  }

  const stats = includeStats ? calculateStats(transcripts) : emptyStats();
  const actionItems = includeActionItems
    ? aggregateActionItemsForDigest(transcripts)
    : emptyActionItems();
  const highlights = includeHighlights ? extractHighlights(transcripts) : [];
  const participants = aggregateParticipants(transcripts);
  const meetings = transcripts.map(toMeetingSummary);
  const period = calculatePeriod(transcripts);

  const totalDuration = sumDurations(transcripts);

  return {
    period,
    totalMeetings: transcripts.length,
    totalDuration,
    stats,
    actionItems,
    highlights,
    participants,
    meetings,
  };
}

function emptyDigest(): WeeklyDigest {
  return {
    period: { from: '', to: '' },
    totalMeetings: 0,
    totalDuration: 0,
    stats: emptyStats(),
    actionItems: emptyActionItems(),
    highlights: [],
    participants: [],
    meetings: [],
  };
}

function toMeetingSummary(transcript: Transcript): DigestMeeting {
  return {
    id: transcript.id,
    title: transcript.title,
    date: transcript.dateString,
    duration: transcript.duration ?? 0,
    participants: (transcript.participants ?? []).length,
  };
}

function calculatePeriod(transcripts: Transcript[]): { from: string; to: string } {
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
    from: earliest ? formatDateOnly(earliest) : '',
    to: latest ? formatDateOnly(latest) : '',
  };
}

function formatDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
