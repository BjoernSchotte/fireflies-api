# Meetings

Manage active meetings and add Fireflies bot to meetings for recording.

## List Active Meetings

Get meetings currently in progress:

```typescript
const meetings = await client.meetings.active();

for (const meeting of meetings) {
  console.log(`${meeting.title} - ${meeting.state}`);
}
```

## Filter Active Meetings

### By Email

```typescript
const myMeetings = await client.meetings.active({
  email: 'user@company.com',
});
```

### By State

```typescript
const paused = await client.meetings.active({
  states: ['paused'],
});

const active = await client.meetings.active({
  states: ['active'],
});
```

Meeting states: `'active'` or `'paused'`

## Add Bot to Meeting

Invite Fireflies bot to record a meeting:

```typescript
const result = await client.meetings.addBot({
  meeting_link: 'https://meet.google.com/abc-defg-hij',
  title: 'Team Standup',
});

console.log(`Bot added: ${result.success}`);
console.log(`Message: ${result.message}`);
```

### With Full Options

```typescript
const result = await client.meetings.addBot({
  meeting_link: 'https://zoom.us/j/123456789',
  title: 'Client Call',
  password: 'meeting-password',      // For password-protected meetings
  duration: 60,                      // Max duration in minutes
  language: 'en',                    // Transcription language
});
```

**Note:** The `addBot` mutation has rate limits. Avoid calling it repeatedly in quick succession.

## Active Meeting Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Meeting ID (use for realtime streaming) |
| `title` | `string` | Meeting title |
| `state` | `'active' \| 'paused'` | Current state |
| `meeting_link` | `string` | Original meeting URL |
| `start_time` | `string` | When recording started |

## Complete Example

```typescript
import { FirefliesClient, RateLimitError } from 'fireflies-api';

const client = new FirefliesClient({
  apiKey: process.env.FIREFLIES_API_KEY!,
});

async function addBotAndMonitor(meetingLink: string) {
  // Add bot to meeting
  try {
    const result = await client.meetings.addBot({
      meeting_link: meetingLink,
      title: 'Recorded Meeting',
    });

    if (!result.success) {
      console.log(`Failed to add bot: ${result.message}`);
      return;
    }

    console.log('Bot added successfully');
  } catch (error) {
    if (error instanceof RateLimitError) {
      console.log('Rate limited. Try again later.');
      return;
    }
    throw error;
  }

  // Wait for meeting to become active
  await sleep(10_000);

  // Find the active meeting
  const active = await client.meetings.active();
  const meeting = active.find((m) =>
    m.meeting_link?.includes(extractMeetingId(meetingLink))
  );

  if (meeting) {
    console.log(`Meeting active: ${meeting.title}`);
    console.log(`Meeting ID for realtime: ${meeting.id}`);

    // Stream live transcription
    for await (const chunk of client.realtime.stream(meeting.id)) {
      console.log(`${chunk.speaker_name}: ${chunk.text}`);
    }
  }
}

function extractMeetingId(link: string): string {
  // Extract meeting ID from URL for matching
  return link.split('/').pop() ?? link;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

addBotAndMonitor('https://meet.google.com/abc-defg-hij').catch(console.error);
```

## Workflow: Add Bot → Stream → Access Transcript

1. **Add bot** to meeting with `addBot()`
2. **Find active meeting** with `active()`
3. **Stream live** with `realtime.stream(meetingId)`
4. **Access transcript** later with `transcripts.get()`

```typescript
// 1. Add bot
await client.meetings.addBot({
  meeting_link: 'https://meet.google.com/xxx',
  title: 'Important Meeting',
});

// 2. Find active meeting
const active = await client.meetings.active();
const meeting = active[0];

// 3. Stream live transcription
for await (const chunk of client.realtime.stream(meeting.id)) {
  console.log(chunk.text);
}

// 4. After meeting ends, find transcript
const transcripts = await client.transcripts.list({
  keyword: 'Important Meeting',
  limit: 1,
});
```

## Next Steps

- [Realtime Streaming](realtime.md) - Stream live transcription
- [Transcripts](transcripts.md) - Access completed transcripts
- [Error Handling](error-handling.md) - Handle rate limits
