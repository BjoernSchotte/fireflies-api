import type { ActionItemsResult } from '../../helpers/action-items.js';
import type { SpeakerAnalytics } from '../../helpers/speaker-analytics.js';
import type { OutputFormat } from './client.js';

/**
 * Write a line to stdout with newline for pipe-friendly output.
 */
export function writeLine(line: string): void {
  process.stdout.write(`${line}\n`);
}

/**
 * Output a single item as a JSON line (for streaming/NDJSON).
 */
export function outputLine(data: unknown): void {
  writeLine(JSON.stringify(data));
}

/**
 * Output data in the specified format.
 */
export function output(data: unknown, format: OutputFormat): void {
  switch (format) {
    case 'json':
      console.log(JSON.stringify(data, null, 2));
      break;
    case 'jsonl':
      if (Array.isArray(data)) {
        for (const item of data) {
          writeLine(JSON.stringify(item));
        }
      } else {
        writeLine(JSON.stringify(data));
      }
      break;
    case 'tsv':
      printTsv(data);
      break;
    case 'table':
      if (Array.isArray(data)) {
        printTable(data as Record<string, unknown>[]);
      } else if (data && typeof data === 'object') {
        printKeyValue(data as Record<string, unknown>);
      } else {
        console.log(data);
      }
      break;
    case 'plain':
      if (typeof data === 'string') {
        console.log(data);
      } else {
        console.log(JSON.stringify(data));
      }
      break;
  }
}

/**
 * Print an array of objects as a table.
 */
function printTable(rows: Record<string, unknown>[]): void {
  if (rows.length === 0) {
    console.log('(no data)');
    return;
  }

  const firstRow = rows[0];
  if (!firstRow) return;

  const keys = Object.keys(firstRow);
  const widths: Record<string, number> = {};

  // Calculate column widths
  for (const key of keys) {
    widths[key] = key.length;
    for (const row of rows) {
      const value = formatValue(row[key]);
      widths[key] = Math.max(widths[key] ?? 0, value.length);
    }
  }

  // Print header
  const header = keys.map((k) => k.padEnd(widths[k] ?? 0)).join('  ');
  console.log(header);
  console.log(keys.map((k) => '-'.repeat(widths[k] ?? 0)).join('  '));

  // Print rows
  for (const row of rows) {
    const line = keys.map((k) => formatValue(row[k]).padEnd(widths[k] ?? 0)).join('  ');
    console.log(line);
  }
}

/**
 * Print an object as key-value pairs.
 */
function printKeyValue(obj: Record<string, unknown>): void {
  const maxKeyLen = Math.max(...Object.keys(obj).map((k) => k.length));

  for (const [key, value] of Object.entries(obj)) {
    console.log(`${key.padEnd(maxKeyLen)}  ${formatValue(value)}`);
  }
}

/**
 * Format a value for table output.
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return `[${value.length} items]`;
    }
    return '[object]';
  }
  return String(value);
}

/**
 * Print data as TSV (tab-separated values).
 */
function printTsv(data: unknown): void {
  if (!Array.isArray(data) || data.length === 0) {
    return;
  }
  const firstRow = data[0] as Record<string, unknown>;
  const keys = Object.keys(firstRow);

  // Header
  writeLine(keys.join('\t'));

  // Rows
  for (const row of data as Record<string, unknown>[]) {
    writeLine(keys.map((k) => formatTsvValue(row[k])).join('\t'));
  }
}

/**
 * Format a value for TSV output, escaping tabs and newlines.
 */
function formatTsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value).replace(/\t/g, ' ').replace(/\n/g, ' ');
}

/**
 * Output speaker analytics in the specified format.
 *
 * - plain: Human-readable summary with meeting overview and speaker details
 * - table/tsv: Flat speaker rows suitable for tabular display
 * - json/jsonl: Full analytics object
 */
export function outputSpeakerAnalytics(analytics: SpeakerAnalytics, format: OutputFormat): void {
  if (format === 'plain') {
    const mins = Math.round(analytics.totalDuration / 60);
    writeLine(
      `Meeting: ${mins} min, ${analytics.speakers.length} speakers, balance: ${analytics.balance}`
    );
    writeLine(`Dominant: ${analytics.dominantSpeaker} (${analytics.dominantSpeakerPercentage}%)`);
    writeLine('');
    for (const s of analytics.speakers) {
      writeLine(
        `${s.name}: ${Math.round(s.talkTime)}s (${s.talkTimePercentage}%) | ${s.wordCount} words | ${s.wordsPerMinute} wpm | ${s.turnCount} turns`
      );
    }
    return;
  }

  if (format === 'table' || format === 'tsv') {
    const rows = analytics.speakers.map((s) => ({
      name: s.name,
      talkTime: Math.round(s.talkTime),
      'talkTime%': s.talkTimePercentage,
      words: s.wordCount,
      wpm: s.wordsPerMinute,
      sentences: s.sentenceCount,
      turns: s.turnCount,
    }));
    output(rows, format);
    return;
  }

  // json, jsonl: full analytics object
  output(analytics, format);
}

/**
 * Output action items in the specified format.
 *
 * - plain: Human-readable list with assignee and due date
 * - table/tsv: Flat rows with columns: #, text, assignee, dueDate
 * - json/jsonl: Full ActionItemsResult object
 */
export function outputActionItems(result: ActionItemsResult, format: OutputFormat): void {
  if (format === 'plain') {
    const assignedCount = result.assignedItems;
    writeLine(`Action Items (${result.totalItems} total, ${assignedCount} assigned):`);
    writeLine('');
    for (const item of result.items) {
      writeLine(`${item.lineNumber}. ${item.text}`);
      const parts: string[] = [];
      if (item.assignee) {
        parts.push(`Assignee: ${item.assignee}`);
      }
      if (item.dueDate) {
        parts.push(`Due: ${item.dueDate}`);
      }
      if (parts.length > 0) {
        writeLine(`   ${parts.join(' | ')}`);
      }
      writeLine('');
    }
    return;
  }

  if (format === 'table' || format === 'tsv') {
    const rows = result.items.map((item) => ({
      '#': item.lineNumber,
      text: item.text,
      assignee: item.assignee ?? '-',
      dueDate: item.dueDate ?? '-',
    }));
    output(rows, format);
    return;
  }

  // json, jsonl: full result object
  output(result, format);
}
