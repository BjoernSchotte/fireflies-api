# AI Apps

Access outputs from AI Apps that process your transcripts.

## List AI App Outputs

Get all AI App outputs:

```typescript
const outputs = await client.aiApps.list({ limit: 10 });

for (const output of outputs) {
  console.log(`App: ${output.app_id}`);
  console.log(`Transcript: ${output.transcript_id}`);
  console.log(`Response: ${output.response}`);
}
```

## Filter by App

Get outputs from a specific AI App:

```typescript
const outputs = await client.aiApps.list({
  app_id: 'your-app-id',
});
```

## Filter by Transcript

Get all AI App outputs for a transcript:

```typescript
const outputs = await client.aiApps.list({
  transcript_id: 'transcript-id',
});

for (const output of outputs) {
  console.log(`\n## ${output.app_id}`);
  console.log(output.response);
}
```

## Pagination

### Manual Pagination

```typescript
let skip = 0;
const limit = 50;

while (true) {
  const batch = await client.aiApps.list({ skip, limit });
  if (batch.length === 0) break;

  for (const output of batch) {
    console.log(output.response);
  }

  skip += batch.length;
}
```

### Auto-Pagination

```typescript
for await (const output of client.aiApps.listAll()) {
  console.log(`${output.app_id}: ${output.response}`);
}
```

Collect all into an array:

```typescript
import { collectAll } from 'fireflies-api';

const allOutputs = await collectAll(client.aiApps.listAll());
console.log(`Total outputs: ${allOutputs.length}`);
```

## AI App Output Fields

| Field | Type | Description |
|-------|------|-------------|
| `transcript_id` | `string` | Source transcript ID |
| `app_id` | `string` | AI App identifier |
| `prompt` | `string` | Prompt used for the app |
| `response` | `string` | AI-generated response |
| `created_at` | `string` | When output was created |

## Complete Example

```typescript
import { FirefliesClient, collectAll } from 'fireflies-api';

const client = new FirefliesClient({
  apiKey: process.env.FIREFLIES_API_KEY!,
});

async function getTranscriptInsights(transcriptId: string) {
  // Get the transcript
  const transcript = await client.transcripts.get(transcriptId);
  console.log(`Transcript: ${transcript.title}\n`);

  // Get all AI App outputs for this transcript
  const outputs = await collectAll(
    client.aiApps.listAll({ transcript_id: transcriptId })
  );

  if (outputs.length === 0) {
    console.log('No AI App outputs available');
    return;
  }

  for (const output of outputs) {
    console.log(`## ${output.app_id}`);
    console.log(output.response);
    console.log('---\n');
  }
}

getTranscriptInsights('transcript-id').catch(console.error);
```

## Working with Transcript Previews

Transcripts include an `apps_preview` field with quick access to app outputs:

```typescript
const transcript = await client.transcripts.get('transcript-id');

if (transcript.apps_preview) {
  for (const preview of transcript.apps_preview) {
    console.log(`App: ${preview.app_name}`);
    console.log(`Output: ${preview.output}`);
  }
}
```

Use the full AI Apps API when you need:
- Pagination across many outputs
- Filtering by app ID
- Access to prompts and metadata

## Next Steps

- [Transcripts](transcripts.md) - Access source transcripts
- [Pagination](pagination.md) - Advanced pagination patterns
- [Error Handling](error-handling.md) - Handle API errors
