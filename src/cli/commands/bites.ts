import type { Command } from 'commander';
import { getClient, getOutputFormat } from '../utils/client.js';
import { withErrorHandling } from '../utils/error.js';
import { output } from '../utils/output.js';
import { type BitePrivacy, parseTime, validatePrivacy } from '../utils/parse.js';

/**
 * Collect repeatable privacy values.
 */
function collectPrivacies(value: string, previous: BitePrivacy[]): BitePrivacy[] {
  const validated = validatePrivacy(value);
  if (!validated) {
    console.error(`Invalid privacy value: ${value}. Must be one of: public, team, participants`);
    process.exit(1);
  }
  return previous.concat([validated]);
}

export function registerBitesCommand(program: Command): void {
  const cmd = program.command('bites').description('Soundbites/clips');

  cmd
    .command('list')
    .description('List bites')
    .option('--transcript <id>', 'Filter by transcript ID')
    .option('--limit <n>', 'Max results (default: 20)', '20')
    .option('--mine', 'Only my bites')
    .option('--team', 'All team bites')
    .action(
      withErrorHandling(async (opts) => {
        const client = getClient(program);
        const format = getOutputFormat(program);

        const bites = await client.bites.list({
          transcript_id: opts.transcript,
          limit: Number.parseInt(opts.limit, 10),
          mine: opts.mine,
          my_team: opts.team,
        });

        const formatted = bites.map((b) => ({
          id: b.id,
          name: b.name,
          transcript_id: b.transcript_id,
          status: b.status,
          start_time: b.start_time,
          end_time: b.end_time,
          created_at: b.created_at,
        }));

        output(formatted, format);
      })
    );

  cmd
    .command('get <id>')
    .description('Get bite details')
    .action(
      withErrorHandling(async (id: string) => {
        const client = getClient(program);
        const format = getOutputFormat(program);

        const bite = await client.bites.get(id);
        output(bite, format);
      })
    );

  cmd
    .command('create')
    .description('Create a bite/soundbite from a transcript')
    .requiredOption('--transcript <id>', 'Transcript ID (required)')
    .requiredOption('--start <time>', 'Start time in seconds or MM:SS format (required)')
    .requiredOption('--end <time>', 'End time in seconds or MM:SS format (required)')
    .option('--name <name>', 'Bite name (max 256 chars)')
    .option('--media-type <type>', 'Media type: video or audio')
    .option('--summary <text>', 'Summary (max 500 chars)')
    .option(
      '--privacy <level>',
      'Privacy: public, team, or participants (repeatable)',
      collectPrivacies,
      []
    )
    .action(
      withErrorHandling(async (opts) => {
        const client = getClient(program);
        const format = getOutputFormat(program);

        const startTime = parseTime(opts.start);
        const endTime = parseTime(opts.end);

        if (endTime <= startTime) {
          console.error('Error: End time must be greater than start time');
          process.exit(1);
        }

        const result = await client.bites.create({
          transcript_id: opts.transcript,
          start_time: startTime,
          end_time: endTime,
          name: opts.name,
          media_type: opts.mediaType,
          summary: opts.summary,
          privacies: opts.privacy.length > 0 ? opts.privacy : undefined,
        });

        output(result, format);
      })
    );
}
