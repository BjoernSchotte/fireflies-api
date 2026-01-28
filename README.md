# fireflies-api

TypeScript SDK for [Fireflies.ai](https://fireflies.ai) with realtime transcription streaming.

> **Disclaimer**: This is an unofficial, community-built open source SDK. It is **NOT affiliated with, endorsed by, or associated with Fireflies.ai Inc.** This project provides a TypeScript SDK and CLI that uses the publicly available Fireflies API.

## Features

- Full GraphQL API coverage
- **Live transcription streaming** via Socket.IO (key differentiator)
- Auto-pagination for large datasets
- TypeScript-first with full type coverage
- Works with Node.js 18+ and Bun

## Quick Start

```bash
npm install fireflies-api
```

```typescript
import { FirefliesClient } from 'fireflies-api';

const client = new FirefliesClient({
  apiKey: process.env.FIREFLIES_API_KEY!,
});

// List recent transcripts
const transcripts = await client.transcripts.list({ limit: 10 });

for (const t of transcripts) {
  console.log(`${t.title} - ${t.date}`);
}
```

## Realtime Transcription

Stream live transcription from an active meeting:

```typescript
for await (const chunk of client.realtime.stream('meeting-id')) {
  console.log(`${chunk.speaker_name}: ${chunk.text}`);
}
```

## Documentation

- [Getting Started](docs/getting-started.md) - Installation and configuration
- [Transcripts](docs/transcripts.md) - Query and manage transcripts
- [Realtime Streaming](docs/realtime.md) - Live transcription
- [Users & Teams](docs/users-and-teams.md) - User management
- [Bites](docs/bites.md) - Clips and soundbites
- [Meetings](docs/meetings.md) - Active meetings and bot management
- [Audio Upload](docs/audio-upload.md) - Upload audio for transcription
- [AI Apps](docs/ai-apps.md) - AI application outputs
- [Pagination](docs/pagination.md) - Auto-pagination patterns
- [Error Handling](docs/error-handling.md) - Error types and recovery
- [Migration Guide](docs/migration.md) - Migrating from official SDK

## API Reference

For Fireflies API field details, see [docs.fireflies.ai](https://docs.fireflies.ai).

## Claude Code Plugin

Use Fireflies directly in [Claude Code](https://claude.com/claude-code) with slash commands:

```bash
# Install the plugin
/plugin marketplace add BjoernSchotte/fireflies-api
/plugin install fireflies@fireflies-api
```

Set your API key before launching Claude Code:
```bash
export FIREFLIES_API_KEY="your-api-key"
claude
```

Available commands:
- `/ff-transcripts` - List, get, analyze transcripts
- `/ff-search` - Full-text search
- `/ff-insights` - Meeting analytics
- `/ff-meetings` - Active meetings, add bot
- `/ff-realtime` - Live transcription streaming
- `/ff-export` - Export to markdown/JSON

See [Claude Code Plugin docs](docs/claude-code-plugin.md) for full documentation.

## License

MIT
