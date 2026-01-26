import type { Command } from 'commander';
import type { MeetingState } from '../../types/meeting.js';
import { getClient, getOutputFormat } from '../utils/client.js';
import { withErrorHandling } from '../utils/error.js';
import { output } from '../utils/output.js';

export function registerMeetingsCommand(program: Command): void {
  const cmd = program.command('meetings').description('Active meetings and bot control');

  cmd
    .command('list')
    .description('List active meetings')
    .option('--state <state>', 'Filter by state: active, paused')
    .option('--email <email>', 'Filter by user email (admin only)')
    .action(
      withErrorHandling(async (opts) => {
        const client = getClient(program);
        const format = getOutputFormat(program);

        const states = opts.state ? ([opts.state] as MeetingState[]) : undefined;
        const meetings = await client.meetings.active({
          states,
          email: opts.email,
        });

        const formatted = meetings.map((m) => ({
          id: m.id,
          title: m.title,
          organizer: m.organizer_email,
          state: m.state,
          start_time: m.start_time,
        }));

        output(formatted, format);
      })
    );

  cmd
    .command('add-bot <url>')
    .description('Add Fireflies bot to a meeting')
    .option('--title <title>', 'Meeting title')
    .option('--duration <min>', 'Max duration in minutes (15-120)', '60')
    .option('--password <password>', 'Meeting password')
    .option('--language <lang>', 'Language code')
    .action(
      withErrorHandling(async (url: string, opts) => {
        const client = getClient(program);
        const format = getOutputFormat(program);

        const result = await client.meetings.addBot({
          meeting_link: url,
          title: opts.title,
          duration: Number.parseInt(opts.duration, 10),
          password: opts.password,
          language: opts.language,
        });

        output(result, format);
      })
    );
}
