import type { Command } from 'commander';
import { getClient, getOutputFormat } from '../utils/client.js';
import { withErrorHandling } from '../utils/error.js';
import { output } from '../utils/output.js';

export function registerAiAppsCommand(program: Command): void {
  const cmd = program.command('ai-apps').description('AI Apps output');

  cmd
    .command('list')
    .description('List AI App outputs')
    .requiredOption('--transcript <id>', 'Transcript ID (required)')
    .option('--app <id>', 'Filter by app ID')
    .option('--limit <n>', 'Max results (default: 10)', '10')
    .action(
      withErrorHandling(async (opts) => {
        const client = getClient(program);
        const format = getOutputFormat(program);

        const apps = await client.aiApps.list({
          transcript_id: opts.transcript,
          app_id: opts.app,
          limit: Number.parseInt(opts.limit, 10),
        });

        const formatted = apps.map((a) => ({
          app_id: a.app_id,
          title: a.title,
          transcript_id: a.transcript_id,
          created_at: a.created_at,
          response:
            a.response?.substring(0, 100) + (a.response && a.response.length > 100 ? '...' : ''),
        }));

        output(formatted, format);
      })
    );
}
