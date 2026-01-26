# Getting Started

## Prerequisites

- **Node.js 18+** (uses native fetch) or **Bun**
- A [Fireflies.ai](https://fireflies.ai) account with API access
- Your API key from the [Fireflies dashboard](https://app.fireflies.ai/integrations/custom/fireflies)

## Installation

```bash
npm install fireflies-api
```

Or with other package managers:

```bash
yarn add fireflies-api
pnpm add fireflies-api
bun add fireflies-api
```

## Configuration

Create a client with your API key:

```typescript
import { FirefliesClient } from 'fireflies-api';

const client = new FirefliesClient({
  apiKey: process.env.FIREFLIES_API_KEY!,
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | required | Your Fireflies API key |
| `baseUrl` | `string` | `https://api.fireflies.ai/graphql` | API endpoint |
| `timeout` | `number` | `30000` | Request timeout in milliseconds |
| `retry` | `RetryConfig` | see below | Retry configuration |

### Retry Configuration

```typescript
const client = new FirefliesClient({
  apiKey: process.env.FIREFLIES_API_KEY!,
  retry: {
    maxRetries: 3,    // Number of retry attempts
    baseDelay: 1000,  // Initial delay in ms
    maxDelay: 30000,  // Maximum delay in ms
  },
});
```

The client uses exponential backoff with jitter for retries. Rate limit errors (429) automatically use the `Retry-After` header when provided.

## Environment Setup

Store your API key in environment variables:

```bash
# .env
FIREFLIES_API_KEY=your-api-key-here
```

Load with dotenv or your preferred method:

```typescript
import 'dotenv/config';
import { FirefliesClient } from 'fireflies-api';

const client = new FirefliesClient({
  apiKey: process.env.FIREFLIES_API_KEY!,
});
```

## Your First API Call

Fetch your recent transcripts:

```typescript
import { FirefliesClient } from 'fireflies-api';

const client = new FirefliesClient({
  apiKey: process.env.FIREFLIES_API_KEY!,
});

async function main() {
  // Get current user
  const user = await client.users.me();
  console.log(`Hello, ${user.name}!`);

  // List recent transcripts
  const transcripts = await client.transcripts.list({ limit: 5 });

  for (const t of transcripts) {
    console.log(`- ${t.title} (${t.date})`);
  }
}

main().catch(console.error);
```

## Available Resources

The client provides access to these resources:

| Resource | Description |
|----------|-------------|
| `client.transcripts` | Query, search, and delete transcripts |
| `client.users` | User and team management |
| `client.bites` | Clips and soundbites |
| `client.meetings` | Active meetings, add bot to meetings |
| `client.audio` | Upload audio for transcription |
| `client.aiApps` | AI application outputs |
| `client.realtime` | Live transcription streaming |

## Next Steps

- [Transcripts](transcripts.md) - Query and manage transcripts
- [Realtime Streaming](realtime.md) - Live transcription from active meetings
- [Error Handling](error-handling.md) - Handle errors gracefully
