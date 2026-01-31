import type {
  DigestActionItem,
  DigestActionItems,
  DigestBuildOptions,
  DigestHighlight,
  DigestMeeting,
  DigestMeetingWithActionItems,
  DigestParticipant,
  DigestParticipantInfo,
  DigestStats,
  WeeklyDigest,
} from '../types/digest.js';
import type { MeetingAttendee, Transcript } from '../types/transcript.js';
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
  DigestParticipantInfo,
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
 * Build a lookup map of participant names from meeting_attendees across all transcripts.
 */
function buildNameLookup(transcripts: Transcript[]): Map<string, string> {
  const namesByEmail = new Map<string, string>();

  for (const t of transcripts) {
    for (const attendee of t.meeting_attendees ?? []) {
      if (!attendee.email) continue;

      const normalizedEmail = attendee.email.toLowerCase();
      const name = attendee.displayName || attendee.name;

      if (name && !namesByEmail.has(normalizedEmail)) {
        namesByEmail.set(normalizedEmail, name);
      }
    }
  }

  return namesByEmail;
}

/**
 * Count meeting participation for each email across transcripts.
 */
function countParticipation(
  transcripts: Transcript[],
  namesByEmail: Map<string, string>
): Map<string, { name: string; meetingCount: number; totalMinutes: number }> {
  const stats = new Map<string, { name: string; meetingCount: number; totalMinutes: number }>();

  for (const t of transcripts) {
    const seenInMeeting = new Set<string>();

    for (const email of t.participants ?? []) {
      const normalizedEmail = email.toLowerCase();
      if (seenInMeeting.has(normalizedEmail)) continue;
      seenInMeeting.add(normalizedEmail);

      const existing = stats.get(normalizedEmail) ?? {
        name: namesByEmail.get(normalizedEmail) || extractNameFromEmail(email),
        meetingCount: 0,
        totalMinutes: 0,
      };

      existing.meetingCount++;
      existing.totalMinutes += t.duration ?? 0;
      stats.set(normalizedEmail, existing);
    }
  }

  return stats;
}

/**
 * Aggregate participants from transcripts. Pure function.
 *
 * Deduplicates by normalized email, counts meetings and total time per participant.
 * Looks up participant names from meeting_attendees data.
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
  const namesByEmail = buildNameLookup(transcripts);
  const stats = countParticipation(transcripts, namesByEmail);

  // Convert to array sorted by meeting count descending
  return Array.from(stats, ([email, data]) => ({
    email,
    name: data.name,
    meetingCount: data.meetingCount,
    totalMinutes: data.totalMinutes,
  })).sort((a, b) => b.meetingCount - a.meetingCount);
}

/**
 * Extract display name from email address.
 */
function extractNameFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? email;
  return localPart;
}

/**
 * Build participant info list by looking up names from meeting_attendees.
 * Falls back to extracting name from email local part if not found.
 */
function buildParticipantInfoList(
  emails: string[],
  attendees: MeetingAttendee[]
): DigestParticipantInfo[] {
  // Build a lookup map (case-insensitive)
  const attendeeMap = new Map<string, MeetingAttendee>();
  for (const attendee of attendees) {
    if (attendee.email) {
      attendeeMap.set(attendee.email.toLowerCase(), attendee);
    }
  }

  return emails.map((email) => {
    const normalizedEmail = email.toLowerCase();
    const attendee = attendeeMap.get(normalizedEmail);

    return {
      email: normalizedEmail,
      name: attendee?.displayName || attendee?.name || extractNameFromEmail(normalizedEmail),
    };
  });
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
        participants: buildParticipantInfoList(t.participants ?? [], t.meeting_attendees ?? []),
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
