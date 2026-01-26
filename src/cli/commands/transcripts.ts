import type { Command } from 'commander';
import { getClient, getOutputFormat } from '../utils/client.js';
import { withErrorHandling } from '../utils/error.js';
import { output } from '../utils/output.js';

/**
 * Calculate a date relative to today.
 */
function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

/**
 * Get start of today.
 */
function startOfToday(): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

interface DateRange {
  fromDate?: string;
  toDate?: string;
}

/**
 * Resolve date range from options, preferring relative dates over explicit ones.
 */
function resolveDateRange(opts: {
  from?: string;
  to?: string;
  today?: boolean;
  yesterday?: boolean;
  lastWeek?: boolean;
  lastMonth?: boolean;
  days?: string;
}): DateRange {
  // Relative date shortcuts take precedence
  if (opts.today) {
    return { fromDate: startOfToday() };
  }
  if (opts.yesterday) {
    return { fromDate: daysAgo(1), toDate: startOfToday() };
  }
  if (opts.lastWeek) {
    return { fromDate: daysAgo(7) };
  }
  if (opts.lastMonth) {
    return { fromDate: daysAgo(30) };
  }
  if (opts.days) {
    const numDays = Number.parseInt(opts.days, 10);
    if (!Number.isNaN(numDays) && numDays > 0) {
      return { fromDate: daysAgo(numDays) };
    }
  }

  // Fall back to explicit dates
  return { fromDate: opts.from, toDate: opts.to };
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
