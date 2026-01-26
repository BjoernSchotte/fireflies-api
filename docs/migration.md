# Migration from Official SDK

This guide covers key differences when migrating from the official Fireflies SDK.

## Key Differences

### 1. Realtime Streaming

This SDK includes live transcription streaming, not available in the official SDK:

```typescript
// This SDK only
for await (const chunk of client.realtime.stream('meeting-id')) {
  console.log(`${chunk.speaker_name}: ${chunk.text}`);
}
```

### 2. Resource-Based API

This SDK uses a resource-based pattern:

```typescript
// This SDK
const transcripts = await client.transcripts.list();
const user = await client.users.me();
const bites = await client.bites.list({ mine: true });

// vs. flat methods in some SDKs
```

### 3. Auto-Pagination

Built-in async iterators for pagination:

```typescript
// This SDK
for await (const t of client.transcripts.listAll()) {
  // Automatically fetches all pages
}

// vs. manual pagination loop
```

### 4. Typed Errors

Specific error classes for different scenarios:

```typescript
import {
  AuthenticationError,
  RateLimitError,
  NotFoundError,
} from 'fireflies-api';

try {
  await client.transcripts.get(id);
} catch (error) {
  if (error instanceof NotFoundError) {
    // Handle not found
  }
}
```

### 5. Field Selection

Optimize transcript fetches by excluding heavy fields:

```typescript
// Skip sentences and summary for faster response
const transcript = await client.transcripts.get(id, {
  includeSentences: false,
  includeSummary: false,
});
```

## Installation

```bash
# Remove official SDK
npm uninstall @fireflies-ai/sdk

# Install this SDK
npm install fireflies-api
```

## Import Changes

```typescript
// Before (official SDK pattern)
import Fireflies from '@fireflies-ai/sdk';
const client = new Fireflies({ apiKey: '...' });

// After (this SDK)
import { FirefliesClient } from 'fireflies-api';
const client = new FirefliesClient({ apiKey: '...' });
```

## Common Operations

### List Transcripts

```typescript
// This SDK
const transcripts = await client.transcripts.list({ limit: 10 });
```

### Get User

```typescript
// This SDK
const user = await client.users.me();
```

### Upload Audio

```typescript
// This SDK
const result = await client.audio.upload({
  url: 'https://example.com/audio.mp3',
  title: 'Meeting Recording',
});
```

### Add Bot to Meeting

```typescript
// This SDK
await client.meetings.addBot({
  meeting_link: 'https://meet.google.com/xxx',
  title: 'Team Meeting',
});
```

## Error Handling

```typescript
// This SDK provides typed errors
import {
  FirefliesError,
  AuthenticationError,
  RateLimitError,
} from 'fireflies-api';

try {
  await client.transcripts.list();
} catch (error) {
  if (error instanceof RateLimitError) {
    // Wait and retry
    await sleep(error.retryAfter ?? 60000);
  } else if (error instanceof AuthenticationError) {
    // Check API key
  } else if (error instanceof FirefliesError) {
    // Other API error
    console.log(error.code, error.message);
  }
}
```

## New Capabilities

Features unique to this SDK:

1. **Realtime transcription streaming** - Live chunks via WebSocket
2. **Auto-pagination** - `listAll()` methods with async iterators
3. **Field selection** - Optimize API responses
4. **Typed errors** - Specific error classes
5. **Built-in retry** - Configurable retry with backoff
6. **Chunk deduplication** - Automatic in realtime streams

## Next Steps

- [Getting Started](getting-started.md) - Full setup guide
- [Realtime Streaming](realtime.md) - Live transcription
- [Pagination](pagination.md) - Auto-pagination patterns
- [Error Handling](error-handling.md) - Error types
