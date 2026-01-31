import { writeFileSync } from 'node:fs';
import type { Command } from 'commander';
import { buildDigest } from '../../helpers/digest.js';
import { renderDigest, renderDigestHtml } from '../../helpers/digest-templates.js';
import type { WeeklyDigest } from '../../types/digest.js';
import type { Transcript } from '../../types/transcript.js';
import { getClient, getOutputFormat, isProgressEnabled } from '../utils/client.js';
import { resolveDateRange } from '../utils/date.js';
import { withErrorHandling } from '../utils/error.js';
import { output, writeLine } from '../utils/output.js';
import { withProgress } from '../utils/progress.js';

interface DigestResult {
  digest: WeeklyDigest | null;
  rendered: string | null;
  transcriptCount: number;
}

interface DigestOptions {
  actionItems: boolean;
  highlights: boolean;
  statsOnly: boolean;
  template: string;
  format?: string;
}

function buildDigestFromTranscripts(transcripts: Transcript[], opts: DigestOptions): WeeklyDigest {
  return buildDigest(transcripts, {
    includeActionItems: opts.actionItems !== false && !opts.statsOnly,
    includeHighlights: opts.highlights !== false && !opts.statsOnly,
    includeStats: true,
  });
}

function renderDigestOutput(digest: WeeklyDigest, outputFormat: string, template: string): string {
  if (outputFormat === 'json') {
    return JSON.stringify(digest, null, 2);
  }
  if (outputFormat === 'html') {
    return renderDigestHtml(digest);
  }
  return renderDigest(digest, { template });
}

export function registerDigestCommand(program: Command): void {
  program
    .command('digest')
    .description('Generate a weekly meeting digest')
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
    .option('--external', 'Only meetings with external (non-company) participants')
    .option('--limit <n>', 'Max transcripts to include')
    // Template options
    .option(
      '--template <name>',
      'Template: default, compact, executive, or path to .md file',
      'default'
    )
    // Output options
    .option('-o, --output-file <path>', 'Write digest to file')
    .option('--format <format>', 'Output format: markdown, html, json (default: markdown)')
    // Content options
    .option('--no-action-items', 'Exclude action items section')
    .option('--no-highlights', 'Exclude highlights section')
    .option('--stats-only', 'Only show meeting statistics')
    .action(
      withErrorHandling(async (opts) => {
        const client = getClient(program);
        const format = getOutputFormat(program);
        const showProgress = isProgressEnabled(program);
        const { fromDate, toDate } = resolveDateRange(opts);

        // Require at least one date constraint
        if (!fromDate && !toDate) {
          writeLine('Error: Please specify a date range (--from, --to, --last-week, etc.)');
          process.exitCode = 1;
          return;
        }

        const digestOutput = await withProgress(
          { enabled: showProgress, text: 'Generating digest...' },
          async (update): Promise<DigestResult> => {
            update('Fetching transcripts...');
            const transcripts = await client.transcripts.list({
              fromDate,
              toDate,
              mine: opts.mine,
              external: opts.external,
              limit: opts.limit ? Number.parseInt(opts.limit, 10) : undefined,
              includeSummary: true,
            });

            if (transcripts.length === 0) {
              return { digest: null, rendered: null, transcriptCount: 0 };
            }

            update(`Building digest from ${transcripts.length} transcripts...`);
            const digest = buildDigestFromTranscripts(transcripts, opts);

            update('Rendering output...');
            const outputFormat = opts.format || (format === 'json' ? 'json' : 'markdown');
            const rendered = renderDigestOutput(digest, outputFormat, opts.template);

            return { digest, rendered, transcriptCount: transcripts.length };
          }
        );

        // Handle empty result
        if (!digestOutput.digest || !digestOutput.rendered) {
          writeLine('No transcripts found for the specified date range.');
          return;
        }

        // Output result
        if (opts.outputFile) {
          writeFileSync(opts.outputFile, digestOutput.rendered);
          writeLine(
            `✓ Digest written to ${opts.outputFile} (${digestOutput.digest.actionItems.total} action items, ${digestOutput.transcriptCount} meetings)`
          );
        } else if (format === 'json') {
          output(digestOutput.digest, 'json');
        } else {
          writeLine(digestOutput.rendered);
        }
      })
    );
}
