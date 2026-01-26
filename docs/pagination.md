# Pagination

The SDK provides flexible pagination options for working with large datasets.

## API Limits

List endpoints return up to 50 items per request:

| Endpoint | Default Limit | Max Limit |
|----------|---------------|-----------|
| Transcripts | 50 | 50 |
| Bites | 50 | 50 |
| AI Apps | 50 | 50 |

## Manual Pagination

Use `skip` and `limit` parameters:

```typescript
let skip = 0;
const limit = 50;

while (true) {
  const batch = await client.transcripts.list({ skip, limit });

  if (batch.length === 0) break;

  for (const transcript of batch) {
    console.log(transcript.title);
  }

  skip += batch.length;
}
```

## Auto-Pagination

Use `listAll()` methods for automatic pagination:

```typescript
for await (const transcript of client.transcripts.listAll()) {
  console.log(transcript.title);
}
```

The iterator fetches pages automatically as you consume items.

### Available on

- `client.transcripts.listAll(params?)`
- `client.bites.listAll(params?)`
- `client.aiApps.listAll(params?)`

## Collecting All Results

Use `collectAll()` to gather all items into an array:

```typescript
import { collectAll } from 'fireflies-api';

const allTranscripts = await collectAll(client.transcripts.listAll());
console.log(`Total: ${allTranscripts.length} transcripts`);
```

This is useful when you need all items in memory, but be mindful of memory usage with large datasets.

## Early Termination

Stop iteration early when you've found what you need:

```typescript
for await (const transcript of client.transcripts.listAll()) {
  if (transcript.title.includes('Q4 Planning')) {
    console.log(`Found: ${transcript.id}`);
    break; // Stop fetching more pages
  }
}
```

## Filtering with Pagination

Combine filters with auto-pagination:

```typescript
// Get all transcripts from Q4 2024
const q4Transcripts = client.transcripts.listAll({
  fromDate: '2024-10-01',
  toDate: '2024-12-31',
});

for await (const transcript of q4Transcripts) {
  console.log(`${transcript.date}: ${transcript.title}`);
}
```

## Processing in Batches

For batch processing, you may want to process pages rather than individual items:

```typescript
async function processBatches() {
  let skip = 0;
  const limit = 50;

  while (true) {
    const batch = await client.transcripts.list({ skip, limit });

    if (batch.length === 0) break;

    // Process batch (e.g., parallel processing)
    await Promise.all(
      batch.map(async (t) => {
        const full = await client.transcripts.get(t.id);
        await processTranscript(full);
      })
    );

    console.log(`Processed ${skip + batch.length} transcripts`);
    skip += batch.length;
  }
}
```

## Using the paginate Helper

For custom pagination, use the `paginate` helper:

```typescript
import { paginate, collectAll } from 'fireflies-api';

// Create a custom paginated iterator
const iterator = paginate(
  async (skip, limit) => {
    return client.bites.list({
      mine: true,
      skip,
      limit,
    });
  },
  50 // page size
);

// Use as async iterator
for await (const bite of iterator) {
  console.log(bite.name);
}

// Or collect all
const allBites = await collectAll(iterator);
```

## Counting Items

To count items without loading all data:

```typescript
let count = 0;
for await (const _ of client.transcripts.listAll()) {
  count++;
}
console.log(`Total: ${count}`);
```

Or fetch one page to estimate:

```typescript
const sample = await client.transcripts.list({ limit: 1 });
// Check if there's at least one
const hasTranscripts = sample.length > 0;
```

## Rate Limiting Consideration

When paginating through large datasets:

```typescript
async function fetchWithDelay() {
  for await (const transcript of client.transcripts.listAll()) {
    await processTranscript(transcript);

    // Add delay between pages if needed
    await sleep(100);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

## Next Steps

- [Transcripts](transcripts.md) - Transcript operations
- [Bites](bites.md) - Paginate through clips
- [AI Apps](ai-apps.md) - Paginate AI outputs
- [Error Handling](error-handling.md) - Handle pagination errors
