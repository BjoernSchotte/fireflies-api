import type { Command } from 'commander';
import { FirefliesClient } from '../../client.js';

export type OutputFormat = 'json' | 'table' | 'plain';

interface GlobalOptions {
  apiKey?: string;
  output?: OutputFormat;
}

/**
 * Create a FirefliesClient from CLI options or environment.
 */
export function getClient(cmd: Command): FirefliesClient {
  const opts = cmd.optsWithGlobals() as GlobalOptions;
  // eslint-disable-next-line @typescript-eslint/dot-notation
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
