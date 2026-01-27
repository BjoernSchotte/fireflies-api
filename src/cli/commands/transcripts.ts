import type { Command } from 'commander';
import { extractActionItems } from '../../helpers/action-items.js';
import { analyzeSpeakers } from '../../helpers/speaker-analytics.js';
import { getClient, getOutputFormat } from '../utils/client.js';
import { resolveDateRange } from '../utils/date.js';
import { withErrorHandling } from '../utils/error.js';
import { output, outputActionItems, outputSpeakerAnalytics } from '../utils/output.js';
import { formatDuration } from '../utils/parse.js';

/**
 * Collect repeatable option values into an array.
 */
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

export function registerTranscriptsCommand(program: Command): void {
  const cmd = program.command('transcripts').description('Manage transcripts');

  cmd
    .command('list')
    .description('List transcripts')
    .option('--limit <n>', 'Max results (default: 20)', '20')
    .option('--from <date>', 'From date (YYYY-MM-DD or ISO 8601)')
    .option('--to <date>', 'To date (YYYY-MM-DD or ISO 8601)')
    .option('--today', 'Transcripts from today')
    .option('--yesterday', 'Transcripts from yesterday')
    .option('--last-week', 'Transcripts from last 7 days')
    .option('--last-month', 'Transcripts from last 30 days')
    .option('--days <n>', 'Transcripts from last N days')
    .option('--mine', 'Only my transcripts')
    .option('--keyword <text>', 'Search keyword')
    .option('--scope <scope>', 'Search scope: title, sentences, all (default: all)')
    .option('--organizer <email>', 'Filter by organizer email (repeatable)', collect, [])
    .option('--participant <email>', 'Filter by participant email (repeatable)', collect, [])
    .option('--participant-me', 'Only meetings where I am a participant')
    .option('--user-id <id>', 'Filter by user ID')
    .option('--channel <id>', 'Filter by channel ID')
    .action(
      withErrorHandling(async (opts) => {
        const client = getClient(program);
        const format = getOutputFormat(program);
        const { fromDate, toDate } = resolveDateRange(opts);

        // If --participant-me, fetch current user's email and add to participants filter
        const participants: string[] = [...opts.participant];
        if (opts.participantMe) {
          const me = await client.users.me();
          participants.push(me.email);
        }

        const transcripts = await client.transcripts.list({
          limit: Number.parseInt(opts.limit, 10),
          fromDate,
          toDate,
          mine: opts.mine,
          keyword: opts.keyword,
          scope: opts.scope,
          organizers: opts.organizer.length > 0 ? opts.organizer : undefined,
          participants: participants.length > 0 ? participants : undefined,
          user_id: opts.userId,
          channel_id: opts.channel,
        });

        // Use human-readable duration for table/plain, rounded minutes for data formats
        // API returns duration in minutes, convert to seconds for formatDuration
        const useHumanDuration = format === 'table' || format === 'plain';
        const formatted = transcripts.map((t) => ({
          id: t.id,
          title: t.title,
          date: t.dateString,
          duration: useHumanDuration ? formatDuration(t.duration * 60) : Math.round(t.duration),
          organizer: t.organizer_email,
        }));

        output(formatted, format);
      })
    );

  cmd
    .command('get <id>')
    .description('Get transcript details')
    .option('--sentences', 'Include sentences', true)
    .option('--no-sentences', 'Exclude sentences')
    .option('--summary', 'Include summary', true)
    .option('--no-summary', 'Exclude summary')
    .option('--speakers', 'Include speaker analytics')
    .option('--no-merge', 'Disable speaker merging (with --speakers)')
    .option('--action-items', 'Include extracted action items')
    .action(
      withErrorHandling(async (id: string, opts) => {
        const client = getClient(program);
        const format = getOutputFormat(program);

        const transcript = await client.transcripts.get(id, {
          includeSentences: opts.sentences,
          includeSummary: opts.summary || opts.actionItems,
        });

        let result: Record<string, unknown> = { ...transcript };

        if (opts.speakers) {
          const analytics = analyzeSpeakers(transcript, {
            mergeSpeakersByName: opts.merge !== false,
          });
          result = { ...result, speakerAnalytics: analytics };
        }

        if (opts.actionItems) {
          const actionItems = extractActionItems(transcript);
          result = { ...result, actionItems };
        }

        output(result, format);
      })
    );

  cmd
    .command('speakers <id>')
    .description('Analyze speaker participation in a transcript')
    .option('--no-merge', 'Show separate entries for speakers with same name')
    .option('--raw-percentages', 'Show decimal percentages')
    .action(
      withErrorHandling(async (id: string, opts) => {
        const client = getClient(program);
        const format = getOutputFormat(program);

        const transcript = await client.transcripts.get(id);
        const analytics = analyzeSpeakers(transcript, {
          mergeSpeakersByName: opts.merge !== false,
          roundPercentages: !opts.rawPercentages,
        });

        outputSpeakerAnalytics(analytics, format);
      })
    );

  cmd
    .command('action-items <id>')
    .description('Extract action items from a transcript')
    .option('--no-assignees', 'Skip assignee detection')
    .option('--no-due-dates', 'Skip due date detection')
    .option('--include-source', 'Include source sentences from transcript')
    .action(
      withErrorHandling(async (id: string, opts) => {
        const client = getClient(program);
        const format = getOutputFormat(program);

        const transcript = await client.transcripts.get(id, {
          includeSummary: true,
          includeSentences: opts.includeSource,
        });

        const result = extractActionItems(transcript, {
          detectAssignees: opts.assignees !== false,
          detectDueDates: opts.dueDates !== false,
          includeSourceSentences: opts.includeSource,
        });

        outputActionItems(result, format);
      })
    );

  cmd
    .command('delete <id>')
    .description('Delete a transcript')
    .option('--confirm', 'Skip confirmation (required for non-interactive)')
    .action(
      withErrorHandling(async (id: string, opts) => {
        if (!opts.confirm) {
          console.error('Error: --confirm flag required for delete operations');
          process.exit(1);
        }

        const client = getClient(program);
        const format = getOutputFormat(program);

        const result = await client.transcripts.delete(id);
        output({ success: result, id }, format);
      })
    );
}
