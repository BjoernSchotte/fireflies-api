import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { registerAiAppsCommand } from './commands/ai-apps.js';
import { registerBitesCommand } from './commands/bites.js';
import { registerExportCommand } from './commands/export.js';
import { registerMeetingsCommand } from './commands/meetings.js';
import { registerRealtimeCommand } from './commands/realtime.js';
import { registerTranscriptsCommand } from './commands/transcripts.js';
import { registerUsersCommand } from './commands/users.js';

// Get version from package.json
function getVersion(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    // In dist, package.json is at ../../package.json
    // In src, package.json is at ../../package.json
    const packagePath = join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8')) as { version: string };
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

const program = new Command();

program
  .name('fireflies')
  .description('CLI for Fireflies.ai API')
  .version(getVersion())
  .option('-k, --api-key <key>', 'API key (or FIREFLIES_API_KEY env)')
  .option('-o, --output <format>', 'Output format: json, table, plain', 'json');

// Register all commands
registerTranscriptsCommand(program);
registerMeetingsCommand(program);
registerUsersCommand(program);
registerBitesCommand(program);
registerAiAppsCommand(program);
registerRealtimeCommand(program);
registerExportCommand(program);

program.parse();
