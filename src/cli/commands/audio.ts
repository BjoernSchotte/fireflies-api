import type { Command } from 'commander';
import type { UploadAudioAttendee } from '../../types/params.js';
import { getClient, getOutputFormat } from '../utils/client.js';
import { withErrorHandling } from '../utils/error.js';
import { output } from '../utils/output.js';

/**
 * Parse attendee string in format "name:email" or just "email".
 */
function parseAttendee(value: string): UploadAudioAttendee {
  if (value.includes(':')) {
    const [displayName, email] = value.split(':');
    return { displayName, email };
  }
  return { email: value };
}

/**
 * Collect repeatable option values into an array.
 */
function collectAttendees(value: string, previous: UploadAudioAttendee[]): UploadAudioAttendee[] {
  return previous.concat([parseAttendee(value)]);
}

export function registerAudioCommand(program: Command): void {
  const cmd = program.command('audio').description('Audio/video upload for transcription');

  cmd
    .command('upload <url>')
    .description('Upload audio/video file for transcription')
    .option('--title <title>', 'Title for the transcript (max 256 chars)')
    .option('--webhook <url>', 'Webhook URL for completion notification')
    .option('--language <code>', 'Language code (e.g., en, de, fr)')
    .option('--save-video', 'Save video if applicable')
    .option(
      '--attendee <name:email>',
      'Meeting attendee (repeatable, format: "Name:email@example.com" or just "email@example.com")',
      collectAttendees,
      []
    )
    .option('--reference-id <id>', 'Custom reference ID for tracking (max 128 chars)')
    .option('--bypass-size-check', 'Allow files smaller than 50kb')
    .action(
      withErrorHandling(async (url: string, opts) => {
        const client = getClient(program);
        const format = getOutputFormat(program);

        const result = await client.audio.upload({
          url,
          title: opts.title,
          webhook: opts.webhook,
          custom_language: opts.language,
          save_video: opts.saveVideo,
          attendees: opts.attendee.length > 0 ? opts.attendee : undefined,
          client_reference_id: opts.referenceId,
          bypass_size_check: opts.bypassSizeCheck,
        });

        output(result, format);
      })
    );
}
