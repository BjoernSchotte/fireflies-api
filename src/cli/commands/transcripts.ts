import type { Command } from 'commander';
import { extractActionItems } from '../../helpers/action-items.js';
import { formatActionItemsMarkdown } from '../../helpers/action-items-format.js';
import { normalizeTranscript } from '../../helpers/normalize.js';
import { analyzeSpeakers } from '../../helpers/speaker-analytics.js';
import type {
  ActionItemsFilterOptions,
  ActionItemsMarkdownOptions,
} from '../../types/action-items.js';
import { getClient, getOutputFormat } from '../utils/client.js';
import { resolveDateRange } from '../utils/date.js';
import { withErrorHandling } from '../utils/error.js';
import { output, outputActionItems, outputSpeakerAnalytics, writeLine } from '../utils/output.js';
import { formatDuration } from '../utils/parse.js';

/**
 * Collect repeatable option values into an array.
 */
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

/** Build filter options from CLI opts */
function buildActionItemFilterOptions(opts: {
  assignee?: string[];
  assignedOnly?: boolean;
  datedOnly?: boolean;
}): ActionItemsFilterOptions | undefined {
  const filterOptions: ActionItemsFilterOptions = {};
  if (opts.assignee?.length) {
    filterOptions.assignees = opts.assignee;
  }
  if (opts.assignedOnly) {
    filterOptions.assignedOnly = true;
  }
  if (opts.datedOnly) {
    filterOptions.datedOnly = true;
  }
  return Object.keys(filterOptions).length > 0 ? filterOptions : undefined;
}

/** Build markdown options from CLI opts */
function buildMarkdownOptions(opts: {
  style?: string;
  groupBy?: string;
  preset?: string;
  includeAssignee?: boolean;
  includeDueDate?: boolean;
  includeMeeting?: boolean;
  includeSummary?: boolean;
}): ActionItemsMarkdownOptions {
  return {
    style: opts.style as ActionItemsMarkdownOptions['style'],
    groupBy: opts.groupBy as ActionItemsMarkdownOptions['groupBy'],
    preset: opts.preset as ActionItemsMarkdownOptions['preset'],
    includeAssignee: opts.includeAssignee,
    includeDueDate: opts.includeDueDate,
    includeMeetingTitle: opts.includeMeeting,
    includeSummary: opts.includeSummary,
  };
}

/** Write content to file and log result */
async function writeToFile(path: string, content: string, itemCount: number): Promise<void> {
  const fs = await import('node:fs/promises');
  await fs.writeFile(path, content);
  console.log(`Wrote ${itemCount} action items to ${path}`);
}

/** Get array param or undefined if empty */
function arrayOrUndefined<T>(arr: T[] | undefined): T[] | undefined {
  return arr?.length ? arr : undefined;
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
    .option('--normalize', 'Output in normalized provider-agnostic format')
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

        // Normalize requires full transcript data (list returns partial data)
        if (opts.normalize) {
          const fullTranscripts = await Promise.all(
            transcripts.map((t) => client.transcripts.get(t.id))
          );
          const normalized = fullTranscripts.map((t) => normalizeTranscript(t));
          output(normalized, format);
          return;
        }

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

  // action-items parent command with subcommands
  const actionItemsCmd = cmd
    .command('action-items')
    .description('Extract and export action items from transcripts');

  // Single transcript action items (get subcommand)
  actionItemsCmd
    .command('get <id>')
    .description('Extract action items from a single transcript')
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

  // Multi-transcript action items export
  actionItemsCmd
    .command('export')
    .description('Export action items from multiple transcripts')
    // Date filters
    .option('--from <date>', 'From date (YYYY-MM-DD or ISO 8601)')
    .option('--to <date>', 'To date (YYYY-MM-DD or ISO 8601)')
    .option('--today', 'Transcripts from today')
    .option('--yesterday', 'Transcripts from yesterday')
    .option('--last-week', 'Transcripts from last 7 days')
    .option('--last-month', 'Transcripts from last 30 days')
    .option('--days <n>', 'Transcripts from last N days')
    .option('--mine', 'Only my transcripts')
    .option('--limit <n>', 'Max transcripts to process')
    .option('--organizer <email>', 'Filter by organizer email (repeatable)', collect, [])
    .option('--participant <email>', 'Filter by participant email (repeatable)', collect, [])
    // Action item filters
    .option('--assignee <name>', 'Filter by assignee (repeatable)', collect, [])
    .option('--assigned-only', 'Only items with assignees')
    .option('--dated-only', 'Only items with due dates')
    // Markdown formatting
    .option('--style <style>', 'List style: checkbox (default), bullet, numbered')
    .option('--group-by <by>', 'Group by: none (default), assignee, transcript, date')
    .option('--preset <preset>', 'Format preset: default, notion, obsidian, github')
    .option('--include-assignee', 'Show assignee inline')
    .option('--include-due-date', 'Show due date inline')
    .option('--include-meeting', 'Show meeting title inline')
    .option('--include-summary', 'Include stats summary')
    // Output
    .option('-o, --output <file>', 'Write to file')
    .action(
      withErrorHandling(async (opts) => {
        const client = getClient(program);
        const format = getOutputFormat(program);
        const { fromDate, toDate } = resolveDateRange(opts);
        const filterOptions = buildActionItemFilterOptions(opts);

        const result = await client.transcripts.exportActionItems({
          fromDate,
          toDate,
          mine: opts.mine,
          organizers: arrayOrUndefined(opts.organizer),
          participants: arrayOrUndefined(opts.participant),
          limit: opts.limit ? Number.parseInt(opts.limit, 10) : undefined,
          filterOptions,
        });

        // Plain format outputs markdown
        if (format === 'plain') {
          const markdown = formatActionItemsMarkdown(result, buildMarkdownOptions(opts));
          return opts.output
            ? writeToFile(opts.output, markdown, result.totalItems)
            : writeLine(markdown);
        }

        // Structured formats
        const content =
          format === 'jsonl'
            ? result.items.map((i) => JSON.stringify(i)).join('\n')
            : JSON.stringify(result, null, 2);
        return opts.output
          ? writeToFile(opts.output, content, result.totalItems)
          : output(result, format);
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
