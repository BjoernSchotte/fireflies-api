import type { Command } from 'commander';
import type { SearchMatch, SearchResults } from '../../types/search.js';
import { getClient, getOutputFormat, type OutputFormat } from '../utils/client.js';
import { resolveDateRange } from '../utils/date.js';
import { withErrorHandling } from '../utils/error.js';
import { output, writeLine } from '../utils/output.js';

/**
 * Collect repeatable option values into an array.
 */
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

/**
 * Format time in seconds to MM:SS format.
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Build flags string for a match (Q for question, T for task).
 */
function buildFlags(match: SearchMatch): string {
  const flags: string[] = [];
  if (match.sentence.isQuestion) flags.push('Q');
  if (match.sentence.isTask) flags.push('T');
  return flags.length > 0 ? ` [${flags.join(',')}]` : '';
}

/**
 * Output a single match in plain format.
 */
function outputMatchPlain(match: SearchMatch): void {
  // Print context before
  for (const ctx of match.context.before) {
    writeLine(`  [${ctx.speakerName}] ${ctx.text}`);
  }

  // Print matched sentence (highlighted)
  const time = formatTime(match.sentence.startTime);
  const flagStr = buildFlags(match);
  writeLine(`> [${time}] [${match.sentence.speakerName}]${flagStr} ${match.sentence.text}`);

  // Print context after
  for (const ctx of match.context.after) {
    writeLine(`  [${ctx.speakerName}] ${ctx.text}`);
  }
  writeLine('');
}

/**
 * Output results in plain text format.
 */
function outputPlain(results: SearchResults): void {
  writeLine(
    `Found ${results.totalMatches} matches in ${results.transcriptsWithMatches}/${results.transcriptsSearched} transcripts`
  );
  writeLine('');

  let currentTranscript = '';
  for (const match of results.matches) {
    // Print transcript header when it changes
    if (match.transcriptId !== currentTranscript) {
      currentTranscript = match.transcriptId;
      writeLine(`--- ${match.transcriptTitle} (${match.transcriptDate.split('T')[0]}) ---`);
      writeLine(`    ${match.transcriptUrl}`);
      writeLine('');
    }
    outputMatchPlain(match);
  }
}

/**
 * Output results in table/TSV format.
 */
function outputTabular(results: SearchResults, format: OutputFormat): void {
  const rows = results.matches.map((match) => ({
    transcript: match.transcriptTitle.slice(0, 40),
    date: match.transcriptDate.split('T')[0],
    time: formatTime(match.sentence.startTime),
    speaker: match.sentence.speakerName,
    text: match.sentence.text.slice(0, 80),
    isQuestion: match.sentence.isQuestion ? 'Y' : '',
    isTask: match.sentence.isTask ? 'Y' : '',
  }));
  output(rows, format);
}

/**
 * Output search results in the specified format.
 *
 * - plain: Human-readable matches with context
 * - table/tsv: Flat rows with transcript info, speaker, text
 * - json/jsonl: Full SearchResults object
 */
export function outputSearchResults(results: SearchResults, format: OutputFormat): void {
  if (format === 'plain') {
    outputPlain(results);
    return;
  }

  if (format === 'table' || format === 'tsv') {
    outputTabular(results, format);
    return;
  }

  // json, jsonl: full results object
  output(results, format);
}

export function registerSearchCommand(program: Command): void {
  program
    .command('search <query>')
    .description('Search across transcripts for matching sentences')
    .option('--speaker <name>', 'Filter results by speaker name (repeatable)', collect, [])
    .option('--questions', 'Only show sentences marked as questions')
    .option('--tasks', 'Only show sentences marked as tasks/action items')
    .option('--context <n>', 'Number of context sentences (default: 1)', '1')
    .option('--case-sensitive', 'Match case when searching')
    .option(
      '--scope <scope>',
      'Search scope: title, sentences, all (default: sentences)',
      'sentences'
    )
    .option('--from <date>', 'From date (YYYY-MM-DD or ISO 8601)')
    .option('--to <date>', 'To date (YYYY-MM-DD or ISO 8601)')
    .option('--today', 'Search transcripts from today')
    .option('--yesterday', 'Search transcripts from yesterday')
    .option('--last-week', 'Search transcripts from last 7 days')
    .option('--last-month', 'Search transcripts from last 30 days')
    .option('--days <n>', 'Search transcripts from last N days')
    .option('--mine', 'Only my transcripts')
    .option('--organizer <email>', 'Filter by organizer email (repeatable)', collect, [])
    .option('--participant <email>', 'Filter by participant email (repeatable)', collect, [])
    .option('--limit <n>', 'Max transcripts to search')
    .action(
      withErrorHandling(async (query: string, opts) => {
        const client = getClient(program);
        const format = getOutputFormat(program);
        const { fromDate, toDate } = resolveDateRange(opts);

        const results = await client.transcripts.search(query, {
          caseSensitive: opts.caseSensitive,
          scope: opts.scope,
          speakers: opts.speaker.length > 0 ? opts.speaker : undefined,
          filterQuestions: opts.questions,
          filterTasks: opts.tasks,
          contextLines: Number.parseInt(opts.context, 10),
          fromDate,
          toDate,
          mine: opts.mine,
          organizers: opts.organizer.length > 0 ? opts.organizer : undefined,
          participants: opts.participant.length > 0 ? opts.participant : undefined,
          limit: opts.limit ? Number.parseInt(opts.limit, 10) : undefined,
        });

        outputSearchResults(results, format);
      })
    );
}
