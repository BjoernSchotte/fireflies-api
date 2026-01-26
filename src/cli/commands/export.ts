import { writeFile } from 'node:fs/promises';
import type { Command } from 'commander';
import { transcriptToMarkdown } from '../../helpers/markdown.js';
import { getClient, getOutputFormat } from '../utils/client.js';
import { withErrorHandling } from '../utils/error.js';
import { output } from '../utils/output.js';

export function registerExportCommand(program: Command): void {
  program
    .command('export <transcript-id> [output-file]')
    .description('Export transcript to markdown')
    .option('--no-summary', 'Exclude summary section')
    .option('--no-timestamps', 'Exclude timestamps')
    .option('--format <format>', 'Output format: markdown, json', 'markdown')
    .action(
      withErrorHandling(async (transcriptId: string, outputFile: string | undefined, opts) => {
        const client = getClient(program);
        const cliFormat = getOutputFormat(program);

        const transcript = await client.transcripts.get(transcriptId);

        if (opts.format === 'json') {
          if (outputFile) {
            await writeFile(outputFile, JSON.stringify(transcript, null, 2), 'utf-8');
            console.log(`Exported to ${outputFile}`);
          } else {
            output(transcript, cliFormat);
          }
          return;
        }

        // Default: markdown format
        const markdown = await transcriptToMarkdown(transcript, {
          includeSummary: opts.summary,
          includeTimestamps: opts.timestamps,
        });

        if (outputFile) {
          await writeFile(outputFile, markdown, 'utf-8');
          console.log(`Exported to ${outputFile}`);
        } else {
          console.log(markdown);
        }
      })
    );
}
