import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Command } from 'commander';
import type { FirefliesClient } from '../../client.js';
import type { BulkExportResult, ExportFormat } from '../../types/bulk-export.js';
import { getClient, isProgressEnabled } from '../utils/client.js';
import { resolveDateRange } from '../utils/date.js';
import { withErrorHandling } from '../utils/error.js';
import { writeLine } from '../utils/output.js';
import { withProgress } from '../utils/progress.js';

interface ExportOptions {
  fromDate?: string;
  toDate?: string;
  ids?: string[];
  mine?: boolean;
  external?: boolean;
  limit?: number;
  format: ExportFormat;
  asZip: boolean;
  outputPath: string;
}

/**
 * Register the export-bulk command.
 */
export function registerExportBulkCommand(program: Command): void {
  program
    .command('export-bulk')
    .description('Export multiple transcripts to files')
    // Date filtering
    .option('--from <date>', 'From date (YYYY-MM-DD or ISO 8601)')
    .option('--to <date>', 'To date (YYYY-MM-DD or ISO 8601)')
    .option('--today', 'Meetings from today')
    .option('--yesterday', 'Meetings from yesterday')
    .option('--last-week', 'Meetings from last 7 days')
    .option('--last-month', 'Meetings from last 30 days')
    .option('--days <n>', 'Meetings from last N days')
    // Transcript filtering
    .option('--ids <ids>', 'Comma-separated transcript IDs')
    .option('--mine', 'Only my transcripts')
    .option('--external', 'Only meetings with external (non-company) participants')
    .option('--limit <n>', 'Max transcripts to export')
    // Output options
    .requiredOption('-d, --dest <path>', 'Output directory or .zip file')
    .option(
      '--format <format>',
      'Export format: markdown, json, txt, csv (default: markdown)',
      'markdown'
    )
    .option('--zip', 'Package as zip archive')
    .option('--dry-run', 'Show what would be exported without writing files')
    .action(
      withErrorHandling(async (opts: CliOptions) => {
        const client = getClient(program);
        const showProgress = isProgressEnabled(program);

        const exportOpts = parseExportOptions(opts);
        if (!exportOpts) return;

        if (opts.dryRun) {
          await runDryMode(client, exportOpts);
          return;
        }

        await runExport(client, exportOpts, showProgress);
      })
    );
}

interface CliOptions {
  from?: string;
  to?: string;
  today?: boolean;
  yesterday?: boolean;
  lastWeek?: boolean;
  lastMonth?: boolean;
  days?: string;
  ids?: string;
  mine?: boolean;
  external?: boolean;
  limit?: string;
  dest: string;
  format: string;
  zip?: boolean;
  dryRun?: boolean;
}

/**
 * Parse and validate CLI options.
 */
function parseExportOptions(opts: CliOptions): ExportOptions | null {
  const { fromDate, toDate } = resolveDateRange(opts);
  const format = validateFormat(opts.format);
  const outputPath = opts.dest;
  const asZip = Boolean(opts.zip) || outputPath.endsWith('.zip');
  const ids = opts.ids ? opts.ids.split(',').map((id) => id.trim()) : undefined;

  if (!fromDate && !toDate && !ids) {
    writeLine('Error: Please specify a date range (--from, --to, --last-week, etc.) or --ids');
    process.exitCode = 1;
    return null;
  }

  return {
    fromDate,
    toDate,
    ids,
    mine: opts.mine,
    external: opts.external,
    limit: opts.limit ? Number.parseInt(opts.limit, 10) : undefined,
    format,
    asZip,
    outputPath,
  };
}

/**
 * Execute the bulk export.
 */
async function runExport(
  client: FirefliesClient,
  opts: ExportOptions,
  showProgress: boolean
): Promise<void> {
  const result = await withProgress(
    { enabled: showProgress, text: 'Exporting transcripts...' },
    async (update) => {
      return client.transcripts.bulkExport({
        fromDate: opts.fromDate,
        toDate: opts.toDate,
        ids: opts.ids,
        mine: opts.mine,
        external: opts.external,
        limit: opts.limit,
        format: opts.format,
        asZip: opts.asZip,
        onProgress: (completed, total) => {
          update(`Exporting transcripts... ${completed}/${total}`);
        },
      });
    }
  );

  await writeExportResult(result, opts);
}

/**
 * Write export result to disk.
 */
async function writeExportResult(result: BulkExportResult, opts: ExportOptions): Promise<void> {
  if (result.totalExported === 0) {
    writeLine('No transcripts found matching the criteria.');
    return;
  }

  if (opts.asZip && result.zip) {
    await writeFile(opts.outputPath, result.zip);
    writeLine(`✓ Exported ${result.totalExported} transcripts to ${opts.outputPath}`);
  } else {
    await mkdir(opts.outputPath, { recursive: true });
    for (const file of result.files) {
      await writeFile(join(opts.outputPath, file.filename), file.content);
    }
    writeLine(`✓ Exported ${result.totalExported} transcripts to ${opts.outputPath}/`);
  }
}

/**
 * Validate and return the export format.
 */
function validateFormat(format: string): ExportFormat {
  const validFormats: ExportFormat[] = ['markdown', 'json', 'txt', 'csv'];
  if (!validFormats.includes(format as ExportFormat)) {
    throw new Error(`Invalid format "${format}". Valid formats: ${validFormats.join(', ')}`);
  }
  return format as ExportFormat;
}

/**
 * Run in dry-run mode - show what would be exported without writing files.
 */
async function runDryMode(client: FirefliesClient, params: ExportOptions): Promise<void> {
  writeLine('Dry run - no files will be written\n');

  const transcripts = await collectDryRunTranscripts(client, params);
  printDryRunResults(transcripts, params);
}

/**
 * Collect transcripts for dry-run preview.
 */
async function collectDryRunTranscripts(
  client: FirefliesClient,
  params: ExportOptions
): Promise<Array<{ id: string; title: string; date: string }>> {
  const transcripts: Array<{ id: string; title: string; date: string }> = [];

  if (params.ids?.length) {
    for (const id of params.ids) {
      try {
        const t = await client.transcripts.get(id, {
          includeSentences: false,
          includeSummary: false,
        });
        transcripts.push({ id: t.id, title: t.title, date: t.dateString || 'Unknown' });
      } catch {
        writeLine(`  ⚠ Transcript ${id} not found`);
      }
    }
  } else {
    for await (const t of client.transcripts.listAll({
      fromDate: params.fromDate,
      toDate: params.toDate,
      mine: params.mine,
    })) {
      transcripts.push({ id: t.id, title: t.title, date: t.dateString || 'Unknown' });
      if (params.limit && transcripts.length >= params.limit) break;
    }
  }

  return transcripts;
}

/**
 * Print dry-run results.
 */
function printDryRunResults(
  transcripts: Array<{ id: string; title: string; date: string }>,
  params: ExportOptions
): void {
  if (transcripts.length === 0) {
    writeLine('No transcripts found matching the criteria.');
    return;
  }

  writeLine(`Would export ${transcripts.length} transcripts:\n`);
  for (const t of transcripts) {
    const dateStr = t.date !== 'Unknown' ? new Date(t.date).toLocaleDateString() : 'Unknown';
    writeLine(`  ${dateStr} - ${t.title}`);
  }

  writeLine('');
  writeLine(`Format: ${params.format}`);
  writeLine(`Output: ${params.outputPath}${params.asZip ? '' : '/'}`);
}
