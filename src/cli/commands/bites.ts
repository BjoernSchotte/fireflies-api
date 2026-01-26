import type { Command } from 'commander';
import { getClient, getOutputFormat } from '../utils/client.js';
import { withErrorHandling } from '../utils/error.js';
import { output } from '../utils/output.js';

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
}
