import type { Command } from 'commander';
import { FirefliesClient } from '../../client.js';

export type OutputFormat = 'json' | 'jsonl' | 'table' | 'tsv' | 'plain';

interface GlobalOptions {
  apiKey?: string;
  output?: OutputFormat;
  progress?: boolean;
}

/**
 * Create a FirefliesClient from CLI options or environment.
 */
export function getClient(cmd: Command): FirefliesClient {
  const opts = cmd.optsWithGlobals() as GlobalOptions;
  // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for process.env
  const apiKey = opts.apiKey ?? process.env['FIREFLIES_API_KEY'];

  if (!apiKey) {
    console.error('Error: API key required. Set FIREFLIES_API_KEY or use --api-key');
    process.exit(1);
  }

  return new FirefliesClient({ apiKey });
}

/**
 * Get the output format from CLI options.
 */
export function getOutputFormat(cmd: Command): OutputFormat {
  const opts = cmd.optsWithGlobals() as GlobalOptions;
  return opts.output ?? 'json';
}

/**
 * Check if progress indicators are enabled.
 */
export function isProgressEnabled(cmd: Command): boolean {
  const opts = cmd.optsWithGlobals() as GlobalOptions;
  return opts.progress ?? false;
}
