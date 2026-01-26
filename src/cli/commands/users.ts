import type { Command } from 'commander';
import { getClient, getOutputFormat } from '../utils/client.js';
import { withErrorHandling } from '../utils/error.js';
import { output } from '../utils/output.js';

export function registerUsersCommand(program: Command): void {
  const cmd = program.command('users').description('User management');

  cmd
    .command('me')
    .description('Show current user info')
    .action(
      withErrorHandling(async () => {
        const client = getClient(program);
        const format = getOutputFormat(program);

        const user = await client.users.me();
        output(user, format);
      })
    );

  cmd
    .command('list')
    .description('List team users')
    .action(
      withErrorHandling(async () => {
        const client = getClient(program);
        const format = getOutputFormat(program);

        const users = await client.users.list();

        const formatted = users.map((u) => ({
          id: u.user_id,
          name: u.name,
          email: u.email,
          role: u.role,
        }));

        output(formatted, format);
      })
    );

  cmd
    .command('get <id>')
    .description('Get user details')
    .action(
      withErrorHandling(async (id: string) => {
        const client = getClient(program);
        const format = getOutputFormat(program);

        const user = await client.users.get(id);
        output(user, format);
      })
    );
}
