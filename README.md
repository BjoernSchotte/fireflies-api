# fireflies-api

TypeScript SDK for [Fireflies.ai](https://fireflies.ai) with realtime transcription streaming.

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

## License

MIT
