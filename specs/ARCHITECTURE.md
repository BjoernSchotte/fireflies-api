# Fireflies API - Architecture Specification

## Project Vision

A first-class TypeScript/Node.js SDK for the Fireflies.ai API, designed to be the definitive npm package for Fireflies integration. This package differentiates itself from the official `@firefliesai/fireflies-node-sdk` by providing:

1. **Realtime WebSocket API support** - Live transcription streaming (not available in official SDK)
2. **Modern TypeScript patterns** - Async iterators, proper error types, tree-shaking
3. **Production-ready features** - Auto-reconnect, retry logic, rate limiting
4. **Developer experience** - Intuitive API design, comprehensive types

## Background Research

### Official SDK Analysis (`@firefliesai/fireflies-node-sdk`)

**Strengths:**
- Full TypeScript support
- Covers GraphQL queries and mutations
- Includes convenience helpers (multi-user fetch, external questions)

**Weaknesses:**
- No Realtime/WebSocket API support
- No retry logic or error recovery
- String-based field selection (fragile)
- Fixed rate limiting (not adaptive)
- No tests implemented
- Duplicated type definitions

### Fireflies API Surface

**GraphQL API** (`https://api.fireflies.ai/graphql`)
- Bearer token authentication
- Queries: transcripts, users, bites, active_meetings, AI apps
- Mutations: uploadAudio, deleteTranscript, createBite, addToLiveMeeting, setUserRole

**Realtime API** (`wss://api.fireflies.ai/ws/realtime`)
- Socket.IO-based WebSocket connection
- Authentication: Bearer token + transcript ID
- Events: `connect`, `auth.success`, `connection.established`, `transcription.broadcast`, `disconnect`
- Chunk format:
  ```json
  {
    "payload": {
      "chunk_id": "string",
      "speaker_name": "string",
      "text": "string",
      "start_time": 0.0,
      "end_time": 0.0
    }
  }
  ```

## Package Structure

```
fireflies-api/
├── src/
│   ├── index.ts                    # Public exports
│   ├── client.ts                   # FirefliesClient - unified entry
│   │
│   ├── graphql/
│   │   ├── client.ts               # GraphQL executor with retry
│   │   ├── queries/
│   │   │   ├── transcripts.ts      # transcript, transcripts
│   │   │   ├── users.ts            # user, users
│   │   │   ├── bites.ts            # bite, bites
│   │   │   ├── meetings.ts         # active_meetings
│   │   │   └── ai-apps.ts          # apps (AI app outputs)
│   │   └── mutations/
│   │       ├── transcripts.ts      # deleteTranscript
│   │       ├── audio.ts            # uploadAudio
│   │       ├── bites.ts            # createBite
│   │       ├── meetings.ts         # addToLiveMeeting
│   │       └── users.ts            # setUserRole
│   │
│   ├── realtime/
│   │   ├── client.ts               # RealtimeClient (Socket.IO)
│   │   ├── stream.ts               # AsyncIterable wrapper
│   │   └── types.ts                # Chunk, events
│   │
│   ├── helpers/                    # Convenience features
│   │   ├── multi-user.ts           # getMeetingsForMultipleUsers
│   │   ├── external-questions.ts   # findExternalParticipantQuestions
│   │   ├── pagination.ts           # Auto-paginate all transcripts
│   │   └── batch.ts                # Batch processor with rate limiting
│   │
│   ├── types/
│   │   ├── transcript.ts
│   │   ├── user.ts
│   │   ├── bite.ts
│   │   ├── meeting.ts
│   │   ├── ai-app.ts
│   │   ├── summary.ts
│   │   └── params.ts               # Query/mutation input types
│   │
│   ├── errors.ts                   # FirefliesError, RateLimitError, etc.
│   └── utils/
│       ├── retry.ts                # Exponential backoff
│       └── dedup.ts                # Chunk/meeting deduplication
│
├── specs/                          # This directory
│   └── ARCHITECTURE.md
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

## API Design

### Client Initialization

```typescript
import { FirefliesClient } from 'fireflies-api';

const client = new FirefliesClient({
  apiKey: process.env.FIREFLIES_API_KEY
});
```

### Queries

```typescript
// Transcripts
const transcripts = await client.transcripts.list({ limit: 20, mine: true });
const transcript = await client.transcripts.get('abc123');
const summary = await client.transcripts.getSummary('abc123');

// Users
const me = await client.users.me();
const user = await client.users.get('user-id');
const allUsers = await client.users.list();

// Bites (clips)
const bites = await client.bites.list({ transcriptId: 'abc123' });
const bite = await client.bites.get('bite-id');

// Active meetings
const activeMeetings = await client.meetings.active();

// AI Apps
const aiOutputs = await client.aiApps.list({ transcriptId: 'abc123' });
```

### Mutations

```typescript
// Delete transcript
await client.transcripts.delete('abc123');

// Upload audio
const upload = await client.audio.upload({
  url: 'https://example.com/recording.mp3',
  title: 'Sales Call Q1',
  webhook: 'https://myapp.com/webhook',
});

// Create bite/clip
const newBite = await client.bites.create({
  transcriptId: 'abc123',
  startTime: 120,
  endTime: 180,
  name: 'Key moment',
});

// Add bot to live meeting
await client.meetings.addBot({
  meetingLink: 'https://zoom.us/j/123456',
  duration: 60,
});

// Set user role
await client.users.setRole('user-id', 'admin');
```

### Realtime API

```typescript
// Event-based usage
const stream = client.realtime.connect('transcript-id');

stream.on('connected', () => console.log('Connected'));
stream.on('chunk', (chunk) => {
  console.log(`[${chunk.speakerName}]: ${chunk.text}`);
});
stream.on('disconnected', (reason) => console.log('Ended:', reason));

// Async iterator (auto-reconnect, deduplication built-in)
for await (const chunk of client.realtime.stream('transcript-id')) {
  console.log(chunk.text);
}
```

### Convenience Helpers

```typescript
// Multi-user meeting fetch with deduplication
const multiUserResults = await FirefliesClient.getMeetingsForMultipleUsers(
  ['api-key-1', 'api-key-2', 'api-key-3'],
  { deduplicate: true }
);

// Find questions from external participants
const { externalParticipants, questions } = await client.helpers.findExternalQuestions('@mycompany.com');

// Get all meeting videos
const videos = await client.helpers.getMeetingVideos();

// Auto-paginate ALL transcripts (handles limit:50 internally)
for await (const transcript of client.transcripts.listAll({ mine: true })) {
  console.log(transcript.title);
}
```

## Feature Comparison

| Feature | Official SDK | This Package |
|---------|--------------|--------------|
| **Realtime WebSocket** | ❌ | ✅ |
| **Async iterators** | ❌ | ✅ |
| **Auto-reconnect** | ❌ | ✅ |
| **Chunk deduplication** | ❌ | ✅ |
| getMeetingsForMultipleUsers | ✅ | ✅ (improved) |
| findExternalParticipantQuestions | ✅ | ✅ |
| getMeetingVideos | ✅ | ✅ |
| getTranscriptSummary | ✅ | ✅ |
| **Auto-pagination** | ❌ | ✅ |
| **Retry with backoff** | ❌ | ✅ |
| **Typed errors** | ❌ | ✅ |
| **Tree-shakeable** | Partial | ✅ |
| active_meetings query | ❌ | ✅ |

## Dependencies

**Runtime (minimal):**
```json
{
  "dependencies": {
    "socket.io-client": "^4.x"
  }
}
```

Native `fetch` for GraphQL - zero runtime deps for GraphQL-only users who tree-shake.

**Development:**
```json
{
  "devDependencies": {
    "tsup": "^8.x",
    "typescript": "^5.x",
    "vitest": "^2.x"
  }
}
```

## Build Output

- ESM + CommonJS dual output
- TypeScript declaration files
- Tree-shakeable exports
- Node.js 18+ (native fetch)

## Error Handling

```typescript
import {
  FirefliesError,
  AuthenticationError,
  RateLimitError,
  NotFoundError
} from 'fireflies-api';

try {
  await client.transcripts.get('invalid-id');
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log('Transcript not found');
  } else if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfter}ms`);
  } else if (error instanceof AuthenticationError) {
    console.log('Invalid API key');
  }
}
```

## References

- Fireflies API Introduction: https://docs.fireflies.ai/getting-started/introduction
- Fireflies API Docs: https://docs.fireflies.ai
- Official SDK: https://www.npmjs.com/package/@firefliesai/fireflies-node-sdk
- GraphQL Endpoint: https://api.fireflies.ai/graphql
- WebSocket Endpoint: wss://api.fireflies.ai/ws/realtime
