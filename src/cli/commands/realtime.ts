import type { Command } from 'commander';
import { getClient } from '../utils/client.js';
import { withErrorHandling } from '../utils/error.js';

export function registerRealtimeCommand(program: Command): void {
  program
    .command('realtime <meeting-id>')
    .description('Stream live transcription to stdout')
    .option('--format <format>', 'Output format: json, text', 'json')
    .action(
      withErrorHandling(async (meetingId: string, opts) => {
        const client = getClient(program);

        // Set up graceful shutdown
        let closing = false;
        const shutdown = () => {
          if (!closing) {
            closing = true;
            process.exit(0);
          }
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

        // Stream transcription chunks
        for await (const chunk of client.realtime.stream(meetingId)) {
          if (closing) break;

          if (opts.format === 'text') {
            console.log(`[${chunk.speaker_name}]: ${chunk.text}`);
          } else {
            // JSON format - line-delimited JSON
            console.log(JSON.stringify(chunk));
          }
        }
      })
    );
}
