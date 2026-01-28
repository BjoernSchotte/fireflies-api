---
name: ff-realtime
description: Stream live transcription from active meetings in real-time via WebSocket. Use when monitoring live meeting transcription.
allowed-tools: Bash(npm exec --yes --package=fireflies-api -- fireflies-api realtime *)
---

# Fireflies Realtime

Stream live transcription from active meetings in real-time.

This is the **key differentiator** of this SDK - live transcription streaming via Socket.IO.

## Command

```bash
npm exec --yes --package=fireflies-api -- fireflies-api realtime <meeting-id>
```

## How It Works

1. Connects to Fireflies WebSocket at `wss://api.fireflies.ai/ws/realtime`
2. Authenticates with your API key
3. Streams transcription chunks as they arrive
4. Output appears continuously as speakers talk

## Output Format

Each line shows the speaker and their transcribed text:
```
John: Good morning everyone, let's get started.
Sarah: I have some updates on the project.
John: Great, please go ahead.
```

## Examples

```bash
# Stream from an active meeting
npm exec --yes --package=fireflies-api -- fireflies-api realtime "meeting_abc123"
```

## Requirements

- An active meeting with Fireflies bot present
- Valid API key with realtime access
- The meeting must be currently in progress

## Notes

- Press Ctrl+C to stop streaming
- Chunks arrive in real-time as speech is detected
- Some delay is normal due to speech processing

## Instructions

1. Verify API key is set:
   ```bash
   test -n "$FIREFLIES_API_KEY" && echo "Ready" || echo "ERROR: Set FIREFLIES_API_KEY"
   ```

2. The meeting ID can be obtained from:
   - `npm exec --yes --package=fireflies-api -- fireflies-api meetings list` for active meetings
   - The Fireflies dashboard

3. Start the realtime stream and let the user see transcription as it happens.

4. Warn user that Ctrl+C will be needed to stop the stream.
