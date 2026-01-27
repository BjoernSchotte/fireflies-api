import type { Command } from 'commander';
import { getClient, getOutputFormat } from '../utils/client.js';
import { withErrorHandling } from '../utils/error.js';
import { outputLine, writeLine } from '../utils/output.js';

export function registerRealtimeCommand(program: Command): void {
  program
    .command('realtime <meeting-id>')
    .description('Stream live transcription to stdout')
    .action(
      withErrorHandling(async (meetingId: string) => {
        const client = getClient(program);
        const format = getOutputFormat(program);

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

          if (format === 'plain' || format === 'table') {
            // Human-readable text format
            writeLine(`[${chunk.speaker_name}]: ${chunk.text}`);
          } else {
            // json, jsonl, tsv all output line-delimited JSON for streaming
            outputLine(chunk);
          }
        }
      })
    );
}
