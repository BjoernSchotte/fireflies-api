# Realtime Streaming

Live transcription streaming is the key differentiator of this SDK. Stream transcription chunks in real-time as a meeting is being recorded.

## Quick Start

Stream transcription from an active meeting:

```typescript
for await (const chunk of client.realtime.stream('meeting-id')) {
  console.log(`${chunk.speaker_name}: ${chunk.text}`);
}
```

## Two API Styles

### Async Iterator (Recommended)

The simplest way to consume chunks:

```typescript
const stream = client.realtime.stream('meeting-id');

for await (const chunk of stream) {
  console.log(`[${chunk.speaker_name}] ${chunk.text}`);

  if (chunk.isFinal) {
    console.log('--- chunk complete ---');
  }
}
```

### Event-Based API

For more control over the connection lifecycle:

```typescript
const stream = client.realtime.connect('meeting-id');

stream.on('connected', () => {
  console.log('Connected to realtime stream');
});

stream.on('chunk', (chunk) => {
  console.log(`${chunk.speaker_name}: ${chunk.text}`);
});

stream.on('disconnected', (reason) => {
  console.log(`Disconnected: ${reason}`);
});

stream.on('error', (error) => {
  console.error('Stream error:', error);
});

// Later: close the connection
stream.close();
```

## Chunk Structure

Each chunk contains:

```typescript
interface TranscriptionChunk {
  chunk_id: string;      // Unique identifier
  speaker_name: string;  // Speaker's name
  text: string;          // Transcribed text
  start_time: number;    // Start time in seconds
  end_time: number;      // End time in seconds
  isFinal: boolean;      // True when chunk is complete
}
```

## Understanding Chunks

### Progressive Updates

Chunks are updated in real-time as speech is recognized. A chunk with the same `chunk_id` may arrive multiple times with increasingly complete text:

```
chunk_id: "abc123", text: "We need to"
chunk_id: "abc123", text: "We need to discuss the"
chunk_id: "abc123", text: "We need to discuss the quarterly"
chunk_id: "abc123", text: "We need to discuss the quarterly results"
```

### Final Chunks

When a new `chunk_id` appears, the previous chunk is considered final. The SDK sets `isFinal: true` on the previous chunk:

```typescript
for await (const chunk of stream) {
  if (chunk.isFinal) {
    // Safe to display/store - this text won't change
    saveToTranscript(chunk);
  } else {
    // Still being updated - show as preview
    showPreview(chunk);
  }
}
```

### Deduplication

The SDK automatically deduplicates chunks. If you receive the same `chunk_id` multiple times, only the most recent version is emitted.

## Connection Lifecycle

### Events

| Event | Description |
|-------|-------------|
| `connected` | Connection established |
| `chunk` | New transcription chunk |
| `disconnected` | Connection closed (with reason) |
| `error` | Error occurred |
| `reconnecting` | Attempting to reconnect |

### Auto-Reconnect

The stream automatically reconnects on connection loss:

```typescript
const stream = client.realtime.connect('meeting-id');

stream.on('reconnecting', (attempt) => {
  console.log(`Reconnecting... attempt ${attempt}`);
});

stream.on('connected', () => {
  console.log('Connected (or reconnected)');
});
```

Reconnection uses exponential backoff with configurable limits.

## Configuration

Configure realtime behavior when creating the client:

```typescript
const client = new FirefliesClient({
  apiKey: process.env.FIREFLIES_API_KEY!,
  // Realtime uses these defaults:
  // wsUrl: 'wss://api.fireflies.ai'
  // wsPath: '/ws/realtime'
});
```

### Stream Options

Pass options when connecting:

```typescript
const stream = client.realtime.connect('meeting-id', {
  chunkTimeout: 300_000,        // 5 min without chunks = timeout
  reconnect: true,              // Auto-reconnect on disconnect
  maxReconnectAttempts: 5,      // Max reconnect attempts
  reconnectDelay: 1000,         // Initial reconnect delay
  maxReconnectDelay: 30_000,    // Max reconnect delay
});
```

## Error Handling

Handle realtime-specific errors:

```typescript
import {
  ConnectionError,
  ChunkTimeoutError,
  StreamClosedError,
} from 'fireflies-api';

try {
  for await (const chunk of client.realtime.stream('meeting-id')) {
    console.log(chunk.text);
  }
} catch (error) {
  if (error instanceof ConnectionError) {
    console.log('Could not connect. Is the meeting active?');
  } else if (error instanceof ChunkTimeoutError) {
    console.log('No chunks received. Meeting may have ended.');
  } else if (error instanceof StreamClosedError) {
    console.log('Stream was closed.');
  }
}
```

## Building a Live Transcript

Complete example building a live transcript:

```typescript
import { FirefliesClient, ChunkTimeoutError } from 'fireflies-api';

interface TranscriptLine {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

async function transcribeLive(meetingId: string) {
  const client = new FirefliesClient({
    apiKey: process.env.FIREFLIES_API_KEY!,
  });

  const transcript: TranscriptLine[] = [];
  const pending = new Map<string, TranscriptLine>();

  try {
    for await (const chunk of client.realtime.stream(meetingId)) {
      // Update or create pending line
      pending.set(chunk.chunk_id, {
        speaker: chunk.speaker_name,
        text: chunk.text,
        startTime: chunk.start_time,
        endTime: chunk.end_time,
      });

      // When finalized, move to transcript
      if (chunk.isFinal) {
        const line = pending.get(chunk.chunk_id)!;
        transcript.push(line);
        pending.delete(chunk.chunk_id);

        // Display the finalized line
        console.log(`[${formatTime(line.startTime)}] ${line.speaker}: ${line.text}`);
      }
    }
  } catch (error) {
    if (error instanceof ChunkTimeoutError) {
      console.log('\nMeeting appears to have ended.');
    } else {
      throw error;
    }
  }

  // Finalize any remaining pending chunks
  for (const line of pending.values()) {
    transcript.push(line);
  }

  return transcript;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Usage
transcribeLive('meeting-id').then((transcript) => {
  console.log(`\nFinal transcript: ${transcript.length} lines`);
});
```

## Multiple Streams

You can connect to multiple meetings simultaneously:

```typescript
async function monitorMeetings(meetingIds: string[]) {
  const streams = meetingIds.map((id) =>
    processStream(id, client.realtime.stream(id))
  );

  await Promise.all(streams);
}

async function processStream(
  meetingId: string,
  stream: AsyncIterable<TranscriptionChunk>
) {
  for await (const chunk of stream) {
    console.log(`[${meetingId}] ${chunk.speaker_name}: ${chunk.text}`);
  }
}
```

## Checking Connection Status

```typescript
const stream = client.realtime.connect('meeting-id');

// Check if connected
if (stream.connected) {
  console.log('Stream is active');
}

// Clean up when done
stream.close();
```

## Next Steps

- [Meetings](meetings.md) - Add bot to meetings for recording
- [Error Handling](error-handling.md) - Handle all error types
- [Transcripts](transcripts.md) - Access completed transcripts
