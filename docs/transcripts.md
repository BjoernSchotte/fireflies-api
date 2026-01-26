# Transcripts

The transcripts API lets you query, search, and manage meeting transcripts.

## List Transcripts

Fetch recent transcripts:

```typescript
const transcripts = await client.transcripts.list({ limit: 10 });

for (const t of transcripts) {
  console.log(`${t.title} - ${t.date}`);
}
```

## Get a Single Transcript

Fetch a transcript by ID:

```typescript
const transcript = await client.transcripts.get('transcript-id');

console.log(transcript.title);
console.log(transcript.duration);
console.log(transcript.participants);
```

### Optimize with Field Selection

For large transcripts, exclude heavy fields you don't need:

```typescript
// Skip sentences and summary for faster response
const transcript = await client.transcripts.get('transcript-id', {
  includeSentences: false,
  includeSummary: false,
});
```

### Get Summary Only

If you only need the summary:

```typescript
const summary = await client.transcripts.getSummary('transcript-id');

console.log(summary.overview);
console.log(summary.action_items);
console.log(summary.outline);
```

## Search by Keyword

Search across transcript content:

```typescript
const results = await client.transcripts.list({
  keyword: 'quarterly review',
  scope: 'all', // 'title' | 'sentences' | 'all'
});
```

## Filter by Date Range

Get transcripts within a date range:

```typescript
const transcripts = await client.transcripts.list({
  fromDate: '2024-01-01',
  toDate: '2024-03-31',
});
```

## Filter by Participants

Find transcripts with specific attendees:

```typescript
// By organizer email
const byOrganizer = await client.transcripts.list({
  organizers: ['manager@company.com'],
});

// By participant email
const byParticipant = await client.transcripts.list({
  participants: ['client@external.com'],
});
```

## Get Your Own Transcripts

```typescript
const myTranscripts = await client.transcripts.list({
  mine: true,
});
```

## Pagination

The API returns up to 50 transcripts per call. For more:

### Manual Pagination

```typescript
let skip = 0;
const limit = 50;

while (true) {
  const batch = await client.transcripts.list({ skip, limit });

  if (batch.length === 0) break;

  for (const t of batch) {
    console.log(t.title);
  }

  skip += batch.length;
}
```

### Auto-Pagination

Use the async iterator for automatic pagination:

```typescript
for await (const transcript of client.transcripts.listAll()) {
  console.log(transcript.title);
}
```

Collect all into an array:

```typescript
import { collectAll } from 'fireflies-api';

const allTranscripts = await collectAll(client.transcripts.listAll());
console.log(`Total: ${allTranscripts.length} transcripts`);
```

## Delete a Transcript

```typescript
try {
  const result = await client.transcripts.delete('transcript-id');
  console.log(`Deleted: ${result.title}`);
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log('Rate limited. Delete has a 10/min limit.');
  }
  throw error;
}
```

**Note:** Delete is rate-limited to 10 requests per minute.

## Complete Example

```typescript
import { FirefliesClient, RateLimitError, collectAll } from 'fireflies-api';

const client = new FirefliesClient({
  apiKey: process.env.FIREFLIES_API_KEY!,
});

async function main() {
  // Search for transcripts about a project
  const results = await client.transcripts.list({
    keyword: 'Project Alpha',
    fromDate: '2024-01-01',
    limit: 20,
  });

  console.log(`Found ${results.length} transcripts`);

  for (const t of results) {
    // Get full transcript with summary
    const full = await client.transcripts.get(t.id);

    console.log(`\n## ${full.title}`);
    console.log(`Duration: ${Math.round(full.duration / 60)} minutes`);
    console.log(`Participants: ${full.participants?.join(', ')}`);

    if (full.summary?.action_items) {
      console.log('\nAction Items:');
      for (const item of full.summary.action_items) {
        console.log(`  - ${item}`);
      }
    }
  }
}

main().catch(console.error);
```

## List Parameters Reference

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | `number` | Max results (1-50, default 50) |
| `skip` | `number` | Offset for pagination |
| `keyword` | `string` | Search term |
| `scope` | `'title' \| 'sentences' \| 'all'` | Where to search |
| `organizers` | `string[]` | Filter by organizer emails |
| `participants` | `string[]` | Filter by participant emails |
| `user_id` | `string` | Filter by user ID |
| `mine` | `boolean` | Only your transcripts |
| `channel_id` | `string` | Filter by channel |
| `fromDate` | `string` | Start date (YYYY-MM-DD) |
| `toDate` | `string` | End date (YYYY-MM-DD) |

## Next Steps

- [Realtime Streaming](realtime.md) - Stream live transcription
- [Pagination](pagination.md) - Advanced pagination patterns
- [Error Handling](error-handling.md) - Handle API errors
