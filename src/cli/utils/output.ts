import type { OutputFormat } from './client.js';

/**
 * Output data in the specified format.
 */
export function output(data: unknown, format: OutputFormat): void {
  switch (format) {
    case 'json':
      console.log(JSON.stringify(data, null, 2));
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
