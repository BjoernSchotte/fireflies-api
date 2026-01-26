# Audio Upload

Upload audio or video files for transcription via URL.

## Basic Upload

Upload audio from a publicly accessible URL:

```typescript
const result = await client.audio.upload({
  url: 'https://example.com/recording.mp3',
});

console.log(`Success: ${result.success}`);
console.log(`Title: ${result.title}`);
console.log(`Message: ${result.message}`);
```

## Upload with Title

Specify a custom title for the transcript:

```typescript
const result = await client.audio.upload({
  url: 'https://example.com/recording.mp3',
  title: 'Q4 Planning Meeting',
});
```

## Upload with Webhook

Receive a notification when transcription completes:

```typescript
const result = await client.audio.upload({
  url: 'https://example.com/recording.mp3',
  title: 'Customer Interview',
  webhook: 'https://your-server.com/webhooks/fireflies',
});
```

The webhook receives a POST request when the transcript is ready.

## Upload with Attendees

Include attendee information for speaker identification:

```typescript
const result = await client.audio.upload({
  url: 'https://example.com/recording.mp3',
  title: 'Team Meeting',
  attendees: [
    { displayName: 'Alice Smith', email: 'alice@company.com' },
    { displayName: 'Bob Jones', email: 'bob@company.com' },
  ],
});
```

## Full Options

```typescript
const result = await client.audio.upload({
  url: 'https://example.com/recording.mp4',
  title: 'Product Demo Recording',
  webhook: 'https://your-server.com/webhooks/fireflies',
  custom_language: 'es',              // Spanish transcription
  save_video: true,                   // Save video for playback
  client_reference_id: 'demo-2024',   // Your reference ID
  bypass_size_check: false,           // Enforce size limits
  attendees: [
    { displayName: 'Demo Host', email: 'host@company.com' },
  ],
});
```

## Parameters Reference

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | `string` | **Required.** Public URL to audio/video file |
| `title` | `string` | Transcript title |
| `webhook` | `string` | URL for completion notification |
| `custom_language` | `string` | Language code (e.g., 'en', 'es', 'fr') |
| `save_video` | `boolean` | Save video for playback |
| `client_reference_id` | `string` | Your reference ID |
| `bypass_size_check` | `boolean` | Skip file size validation |
| `attendees` | `Attendee[]` | List of attendees |

### Attendee Object

| Field | Type | Description |
|-------|------|-------------|
| `displayName` | `string` | Name to show in transcript |
| `email` | `string` | Email for speaker identification |

## Response

```typescript
interface UploadResult {
  success: boolean;   // Whether upload was accepted
  title: string;      // Assigned title
  message: string;    // Status message
}
```

## Complete Example

```typescript
import { FirefliesClient } from 'fireflies-api';

const client = new FirefliesClient({
  apiKey: process.env.FIREFLIES_API_KEY!,
});

async function uploadRecording(audioUrl: string) {
  try {
    const result = await client.audio.upload({
      url: audioUrl,
      title: 'Uploaded Recording',
      webhook: process.env.WEBHOOK_URL,
      attendees: [
        { displayName: 'Speaker 1', email: 'speaker1@example.com' },
        { displayName: 'Speaker 2', email: 'speaker2@example.com' },
      ],
    });

    if (result.success) {
      console.log(`Upload accepted: ${result.title}`);
      console.log('Transcript will be available shortly.');
    } else {
      console.log(`Upload failed: ${result.message}`);
    }
  } catch (error) {
    console.error('Upload error:', error);
  }
}

uploadRecording('https://example.com/meeting.mp3').catch(console.error);
```

## Supported Formats

Fireflies supports common audio and video formats:

- Audio: MP3, WAV, M4A, FLAC, OGG
- Video: MP4, MOV, WebM

Check the [Fireflies documentation](https://docs.fireflies.ai) for current format support and size limits.

## Accessing the Transcript

After upload, the transcript appears in your transcript list once processing completes:

```typescript
// Wait for webhook or poll for the transcript
const transcripts = await client.transcripts.list({
  keyword: 'Uploaded Recording',
  limit: 1,
});

if (transcripts.length > 0) {
  const transcript = await client.transcripts.get(transcripts[0].id);
  console.log(transcript.title);
}
```

## Next Steps

- [Transcripts](transcripts.md) - Access uploaded transcripts
- [Error Handling](error-handling.md) - Handle upload errors
- [AI Apps](ai-apps.md) - Process transcripts with AI
