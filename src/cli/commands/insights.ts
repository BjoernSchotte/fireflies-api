import type { Command } from 'commander';
import type {
  DayOfWeekStats,
  MeetingInsights,
  ParticipantStats,
  SpeakerInsightStats,
} from '../../types/meeting-insights.js';
import { getClient, getOutputFormat, isProgressEnabled } from '../utils/client.js';
import { resolveDateRange } from '../utils/date.js';
import { withErrorHandling } from '../utils/error.js';
import { output, writeLine } from '../utils/output.js';
import { formatDuration } from '../utils/parse.js';
import { withProgress } from '../utils/progress.js';

/**
 * Collect repeatable option values into an array.
 */
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

export function registerInsightsCommand(program: Command): void {
  program
    .command('insights')
    .description('Get aggregate meeting insights')
    // Date filtering
    .option('--from <date>', 'From date (YYYY-MM-DD or ISO 8601)')
    .option('--to <date>', 'To date (YYYY-MM-DD or ISO 8601)')
    .option('--today', 'Meetings from today')
    .option('--yesterday', 'Meetings from yesterday')
    .option('--last-week', 'Meetings from last 7 days')
    .option('--last-month', 'Meetings from last 30 days')
    .option('--days <n>', 'Meetings from last N days')
    // Transcript filtering
    .option('--mine', 'Only my transcripts')
    .option('--organizer <email>', 'Filter by organizer email (repeatable)', collect, [])
    .option('--participant <email>', 'Filter by participant email (repeatable)', collect, [])
    .option('--user-id <id>', 'Filter by user ID')
    .option('--channel <id>', 'Filter by channel ID')
    .option('--limit <n>', 'Max transcripts to analyze')
    .option('--external', 'Only meetings with external (non-company) participants')
    // Analysis options
    .option('--speaker <name>', 'Only stats for specific speaker(s) (repeatable)', collect, [])
    .option('--group-by <period>', 'Group by: day, week, month')
    .option('--top <n>', 'Top N speakers/participants (default: 10)')
    .action(
      withErrorHandling(async (opts) => {
        const client = getClient(program);
        const format = getOutputFormat(program);
        const showProgress = isProgressEnabled(program);
        const { fromDate, toDate } = resolveDateRange(opts);

        const insights = await withProgress(
          { enabled: showProgress, text: 'Analyzing meetings...' },
          async () => client.transcripts.insights(buildInsightsParams(opts, fromDate, toDate))
        );

        outputInsights(insights, format);
      })
    );
}

interface CommandOptions {
  mine?: boolean;
  organizer: string[];
  participant: string[];
  userId?: string;
  channel?: string;
  limit?: string;
  external?: boolean;
  speaker: string[];
  groupBy?: string;
  top?: string;
}

function buildInsightsParams(opts: CommandOptions, fromDate?: string, toDate?: string) {
  const topCount = opts.top ? Number.parseInt(opts.top, 10) : undefined;
  return {
    fromDate,
    toDate,
    mine: opts.mine,
    organizers: opts.organizer.length > 0 ? opts.organizer : undefined,
    participants: opts.participant.length > 0 ? opts.participant : undefined,
    user_id: opts.userId,
    channel_id: opts.channel,
    limit: opts.limit ? Number.parseInt(opts.limit, 10) : undefined,
    external: opts.external,
    speakers: opts.speaker.length > 0 ? opts.speaker : undefined,
    groupBy: opts.groupBy as 'day' | 'week' | 'month' | undefined,
    topSpeakersCount: topCount,
    topParticipantsCount: topCount,
  };
}

function outputInsights(insights: MeetingInsights, format: string): void {
  if (format === 'plain') {
    outputInsightsPlain(insights);
    return;
  }

  if (format === 'table') {
    outputInsightsTable(insights);
    return;
  }

  // json, jsonl, tsv: full object
  output(insights, format as 'json' | 'jsonl' | 'tsv');
}

function outputInsightsPlain(insights: MeetingInsights): void {
  outputHeader(insights);
  outputSummaryStats(insights);
  outputDayOfWeekStats(insights.byDayOfWeek);
  outputTimeGroupStats(insights.byTimeGroup);
  outputParticipantStats(insights);
  outputSpeakerStats(insights);
}

function outputHeader(insights: MeetingInsights): void {
  const dateRange = formatDateRangeHeader(insights.earliestMeeting, insights.latestMeeting);
  writeLine(`Meeting Insights (${dateRange})`);
  writeLine('='.repeat(50));
  writeLine('');
}

function outputSummaryStats(insights: MeetingInsights): void {
  writeLine(`Total meetings: ${insights.totalMeetings}`);
  writeLine(`Total duration: ${formatDuration(insights.totalDurationMinutes * 60)}`);
  writeLine(`Average duration: ${Math.round(insights.averageDurationMinutes)} min`);
  writeLine('');
}

function outputDayOfWeekStats(byDayOfWeek: DayOfWeekStats): void {
  writeLine('Meetings by Day:');
  const sortedDays = getSortedDays(byDayOfWeek);
  for (const { day, stats } of sortedDays) {
    if (stats.count > 0) {
      const duration = formatDuration(stats.totalMinutes * 60);
      writeLine(`  ${capitalize(day)}: ${stats.count} meetings (${duration})`);
    }
  }
  writeLine('');
}

function outputTimeGroupStats(byTimeGroup?: MeetingInsights['byTimeGroup']): void {
  if (!byTimeGroup || byTimeGroup.length === 0) return;

  writeLine('By Period:');
  for (const group of byTimeGroup) {
    const duration = formatDuration(group.totalMinutes * 60);
    const avg = Math.round(group.averageMinutes);
    writeLine(`  ${group.period}: ${group.count} meetings (${duration}, avg ${avg} min)`);
  }
  writeLine('');
}

function outputParticipantStats(insights: MeetingInsights): void {
  const avgPart = insights.averageParticipantsPerMeeting.toFixed(1);
  writeLine(
    `Participants: ${insights.totalUniqueParticipants} unique (avg ${avgPart} per meeting)`
  );

  if (insights.topParticipants.length > 0) {
    writeLine('Top Participants:');
    outputTopParticipants(insights.topParticipants.slice(0, 5));
  }
  writeLine('');
}

function outputTopParticipants(participants: ParticipantStats[]): void {
  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    if (p) {
      writeLine(`  ${i + 1}. ${p.email} (${p.meetingCount} meetings)`);
    }
  }
}

function outputSpeakerStats(insights: MeetingInsights): void {
  writeLine(`Speakers: ${insights.totalUniqueSpeakers} unique`);
  if (insights.topSpeakers.length > 0) {
    writeLine('Top Speakers:');
    outputTopSpeakers(insights.topSpeakers.slice(0, 5));
  }
}

function outputTopSpeakers(speakers: SpeakerInsightStats[]): void {
  for (let i = 0; i < speakers.length; i++) {
    const s = speakers[i];
    if (s) {
      const talkTime = formatDuration(s.totalTalkTimeSeconds);
      writeLine(`  ${i + 1}. ${s.name} (${s.meetingCount} meetings, ${talkTime} talk time)`);
    }
  }
}

function outputInsightsTable(insights: MeetingInsights): void {
  const summary = {
    totalMeetings: insights.totalMeetings,
    totalDuration: formatDuration(insights.totalDurationMinutes * 60),
    avgDuration: `${Math.round(insights.averageDurationMinutes)} min`,
    dateRange: `${insights.earliestMeeting} to ${insights.latestMeeting}`,
    uniqueParticipants: insights.totalUniqueParticipants,
    avgParticipants: insights.averageParticipantsPerMeeting.toFixed(1),
    uniqueSpeakers: insights.totalUniqueSpeakers,
  };

  output(summary, 'table');
}

function formatDateRangeHeader(earliest: string, latest: string): string {
  if (!earliest && !latest) return 'All time';
  if (earliest === latest) return formatReadableDate(earliest);
  return `${formatReadableDate(earliest)} - ${formatReadableDate(latest)}`;
}

function formatReadableDate(dateStr: string): string {
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type DayName = keyof DayOfWeekStats;

function getSortedDays(
  byDayOfWeek: DayOfWeekStats
): Array<{ day: DayName; stats: DayOfWeekStats[DayName] }> {
  const dayOrder: DayName[] = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];

  return dayOrder
    .map((day) => ({ day, stats: byDayOfWeek[day] }))
    .sort((a, b) => b.stats.count - a.stats.count);
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
