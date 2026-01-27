import type { Command } from 'commander';
import { getClient, getOutputFormat } from '../utils/client.js';
import { resolveDateRange } from '../utils/date.js';
import { withErrorHandling } from '../utils/error.js';
import { output } from '../utils/output.js';

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
    .option('--user-id <id>', 'Filter by user ID')
    .option('--channel <id>', 'Filter by channel ID')
    .action(
      withErrorHandling(async (opts) => {
        const client = getClient(program);
        const format = getOutputFormat(program);
        const { fromDate, toDate } = resolveDateRange(opts);

        const transcripts = await client.transcripts.list({
          limit: Number.parseInt(opts.limit, 10),
          fromDate,
          toDate,
          mine: opts.mine,
          keyword: opts.keyword,
          scope: opts.scope,
          organizers: opts.organizer.length > 0 ? opts.organizer : undefined,
          participants: opts.participant.length > 0 ? opts.participant : undefined,
          user_id: opts.userId,
          channel_id: opts.channel,
        });

        const formatted = transcripts.map((t) => ({
          id: t.id,
          title: t.title,
          date: t.dateString,
          duration: t.duration,
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
    .action(
      withErrorHandling(async (id: string, opts) => {
        const client = getClient(program);
        const format = getOutputFormat(program);

        const transcript = await client.transcripts.get(id, {
          includeSentences: opts.sentences,
          includeSummary: opts.summary,
        });

        output(transcript, format);
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
