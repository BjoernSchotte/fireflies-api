# Bites

Bites are clips or soundbites extracted from transcripts. Create highlights of key moments to share with your team.

## List Bites

Get your bites:

```typescript
const bites = await client.bites.list({ mine: true, limit: 10 });

for (const bite of bites) {
  console.log(`${bite.name} - ${bite.duration}s`);
}
```

## Get Bite Details

Fetch a specific bite:

```typescript
const bite = await client.bites.get('bite-id');

console.log(`Name: ${bite.name}`);
console.log(`Duration: ${bite.duration} seconds`);
console.log(`Created: ${bite.created_at}`);

// Access captions
for (const caption of bite.captions ?? []) {
  console.log(`${caption.speaker}: ${caption.text}`);
}
```

## Create a Bite

Extract a clip from a transcript:

```typescript
const bite = await client.bites.create({
  transcript_id: 'transcript-id',
  start_time: 120,   // 2:00 mark
  end_time: 180,     // 3:00 mark
  name: 'Key Decision',
});

console.log(`Created bite: ${bite.id}`);
```

### Create with Options

```typescript
const bite = await client.bites.create({
  transcript_id: 'transcript-id',
  start_time: 60,
  end_time: 120,
  name: 'Product Demo Highlights',
  summary: 'Overview of the new feature demonstration',
  media_type: 'video',
  privacies: ['team'], // 'public' | 'team' | 'private'
});
```

## Filter Bites

### By Transcript

```typescript
const transcriptBites = await client.bites.list({
  transcript_id: 'transcript-id',
});
```

### Team Bites

```typescript
const teamBites = await client.bites.list({
  my_team: true,
});
```

## Pagination

### Manual Pagination

```typescript
let skip = 0;
const limit = 50;

while (true) {
  const batch = await client.bites.list({ skip, limit });
  if (batch.length === 0) break;

  for (const bite of batch) {
    console.log(bite.name);
  }

  skip += batch.length;
}
```

### Auto-Pagination

```typescript
for await (const bite of client.bites.listAll({ mine: true })) {
  console.log(bite.name);
}
```

## Bite Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Bite ID |
| `name` | `string` | Bite title |
| `transcript_id` | `string` | Source transcript |
| `start_time` | `number` | Start time in seconds |
| `end_time` | `number` | End time in seconds |
| `duration` | `number` | Duration in seconds |
| `summary` | `string` | Bite summary |
| `captions` | `BiteCaption[]` | Caption entries |
| `sources` | `BiteSource[]` | Media sources |
| `created_at` | `string` | Creation timestamp |

## Complete Example

```typescript
import { FirefliesClient, collectAll } from 'fireflies-api';

const client = new FirefliesClient({
  apiKey: process.env.FIREFLIES_API_KEY!,
});

async function createHighlights(transcriptId: string) {
  // Get the transcript
  const transcript = await client.transcripts.get(transcriptId);

  // Find action items in the summary
  const actionItems = transcript.summary?.action_items ?? [];

  if (actionItems.length === 0) {
    console.log('No action items found');
    return;
  }

  // Create a bite for the first 2 minutes where decisions were made
  const bite = await client.bites.create({
    transcript_id: transcriptId,
    start_time: 0,
    end_time: 120,
    name: `Action Items - ${transcript.title}`,
    summary: actionItems.slice(0, 3).join('\n'),
  });

  console.log(`Created highlight: ${bite.id}`);

  // List all bites for this transcript
  const allBites = await collectAll(
    client.bites.listAll({ transcript_id: transcriptId })
  );

  console.log(`Total bites for transcript: ${allBites.length}`);
}

createHighlights('transcript-id').catch(console.error);
```

## Next Steps

- [Transcripts](transcripts.md) - Access source transcripts
- [Pagination](pagination.md) - Advanced pagination patterns
- [Users & Teams](users-and-teams.md) - Share bites with team
