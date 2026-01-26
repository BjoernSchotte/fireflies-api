# Error Handling

The SDK provides typed error classes for handling different failure scenarios.

## Error Hierarchy

All errors extend `FirefliesError`:

```
FirefliesError (base)
├── AuthenticationError   - Invalid or missing API key
├── RateLimitError        - Rate limits exceeded
├── NotFoundError         - Resource not found
├── ValidationError       - Invalid request parameters
├── GraphQLError          - GraphQL API errors
├── TimeoutError          - Request timeout
├── NetworkError          - Network connectivity issues
└── RealtimeError (base)
    ├── ConnectionError   - WebSocket connection failed
    ├── StreamClosedError - Stream accessed after close
    └── ChunkTimeoutError - No chunks received within timeout
```

## Basic Error Handling

```typescript
import {
  FirefliesClient,
  FirefliesError,
  AuthenticationError,
  NotFoundError,
} from 'fireflies-api';

try {
  const transcript = await client.transcripts.get('some-id');
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log('Transcript not found');
  } else if (error instanceof AuthenticationError) {
    console.log('Invalid API key');
  } else if (error instanceof FirefliesError) {
    console.log(`API error: ${error.message}`);
  } else {
    throw error;
  }
}
```

## Error Codes

Each error has a `code` property for programmatic handling:

```typescript
import { FirefliesError } from 'fireflies-api';

try {
  await client.transcripts.delete('id');
} catch (error) {
  if (error instanceof FirefliesError) {
    switch (error.code) {
      case 'AUTHENTICATION_ERROR':
        // Re-authenticate
        break;
      case 'RATE_LIMIT_ERROR':
        // Back off and retry
        break;
      case 'NOT_FOUND_ERROR':
        // Resource doesn't exist
        break;
      case 'VALIDATION_ERROR':
        // Fix request parameters
        break;
      default:
        console.error(`Unexpected error: ${error.code}`);
    }
  }
}
```

## Handling Rate Limits

The API has rate limits for certain operations. `RateLimitError` includes retry timing:

```typescript
import { RateLimitError } from 'fireflies-api';

async function deleteWithRetry(id: string) {
  try {
    return await client.transcripts.delete(id);
  } catch (error) {
    if (error instanceof RateLimitError) {
      const waitMs = error.retryAfter ?? 60_000;
      console.log(`Rate limited. Waiting ${waitMs}ms`);
      await sleep(waitMs);
      return deleteWithRetry(id);
    }
    throw error;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

**Note:** The built-in retry logic handles transient rate limits automatically. This manual handling is for cases where you need custom retry behavior.

## Handling GraphQL Errors

GraphQL errors contain details about what went wrong:

```typescript
import { GraphQLError } from 'fireflies-api';

try {
  await client.transcripts.list({ limit: 1000 }); // Too high
} catch (error) {
  if (error instanceof GraphQLError) {
    for (const detail of error.errors) {
      console.log(`Path: ${detail.path?.join('.')}`);
      console.log(`Message: ${detail.message}`);
    }
  }
}
```

## Network Errors

Handle connectivity issues:

```typescript
import { NetworkError, TimeoutError } from 'fireflies-api';

try {
  const transcripts = await client.transcripts.list();
} catch (error) {
  if (error instanceof TimeoutError) {
    console.log('Request timed out. Try increasing timeout.');
  } else if (error instanceof NetworkError) {
    console.log('Network error. Check your connection.');
  }
}
```

## Realtime Errors

The realtime API has specific error types:

```typescript
import {
  ConnectionError,
  StreamClosedError,
  ChunkTimeoutError,
} from 'fireflies-api';

try {
  for await (const chunk of client.realtime.stream('meeting-id')) {
    console.log(chunk.text);
  }
} catch (error) {
  if (error instanceof ConnectionError) {
    console.log('Failed to connect to realtime stream');
  } else if (error instanceof ChunkTimeoutError) {
    console.log(`No chunks for ${error.timeoutMs}ms. Meeting may have ended.`);
  } else if (error instanceof StreamClosedError) {
    console.log('Stream was closed');
  }
}
```

## Complete Example

```typescript
import {
  FirefliesClient,
  FirefliesError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  NetworkError,
  TimeoutError,
} from 'fireflies-api';

async function fetchTranscript(id: string) {
  try {
    return await client.transcripts.get(id);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw new Error('Invalid API key. Check FIREFLIES_API_KEY.');
    }

    if (error instanceof NotFoundError) {
      return null; // Transcript doesn't exist
    }

    if (error instanceof RateLimitError) {
      console.warn('Rate limited. Waiting...');
      await sleep(error.retryAfter ?? 60_000);
      return fetchTranscript(id); // Retry
    }

    if (error instanceof TimeoutError) {
      throw new Error(`Timeout fetching transcript ${id}`);
    }

    if (error instanceof NetworkError) {
      throw new Error('Network error. Check your connection.');
    }

    if (error instanceof FirefliesError) {
      throw new Error(`API error [${error.code}]: ${error.message}`);
    }

    throw error; // Unknown error
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

## Error Properties

| Error Class | Properties |
|-------------|------------|
| `FirefliesError` | `message`, `code` |
| `RateLimitError` | `retryAfter?: number` (milliseconds) |
| `GraphQLError` | `errors: GraphQLErrorDetail[]` |
| `ChunkTimeoutError` | `timeoutMs: number` |

## Next Steps

- [Transcripts](transcripts.md) - Work with transcripts
- [Realtime Streaming](realtime.md) - Handle realtime errors
- [Pagination](pagination.md) - Paginate large datasets
