---
name: ff-audio
description: Upload audio files for transcription. Use when uploading MP3, WAV, or video files to Fireflies for processing.
allowed-tools: Bash(npm exec --yes --package=fireflies-api -- fireflies-api audio *)
---

# Fireflies Audio Upload

Upload audio files for transcription.

## Command

```bash
npm exec --yes --package=fireflies-api -- fireflies-api audio upload <url> [options]
```

## Options

- `--title <title>` - Title for the transcription
- `--webhook <url>` - Webhook URL for completion notification
- `--language <code>` - Transcription language code
- `--save-video` - Save video if applicable
- `--attendee <email>` - Add attendee email
- `--reference-id <id>` - Custom reference ID

## Supported Formats

The URL must point to a publicly accessible audio/video file. Supported formats include:
- MP3, WAV, M4A (audio)
- MP4, MOV, WEBM (video)

## Examples

```bash
# Upload audio file
npm exec --yes --package=fireflies-api -- fireflies-api audio upload "https://example.com/meeting.mp3" --title "Q4 Planning"

# Upload with webhook notification
npm exec --yes --package=fireflies-api -- fireflies-api audio upload "https://example.com/meeting.mp3" --title "Team Sync" --webhook "https://myapp.com/webhook"

# Upload with language specification
npm exec --yes --package=fireflies-api -- fireflies-api audio upload "https://example.com/meeting.mp3" --title "German Meeting" --language "de"

# Upload with custom reference
npm exec --yes --package=fireflies-api -- fireflies-api audio upload "https://example.com/meeting.mp3" --title "Client Call" --reference-id "call_2024_001"
```

## Instructions

1. Verify API key is set:
   ```bash
   test -n "$FIREFLIES_API_KEY" && echo "Ready" || echo "ERROR: Set FIREFLIES_API_KEY"
   ```

2. Ensure the audio URL is publicly accessible.

3. Suggest adding a title for easier identification.

4. Transcription is asynchronous - suggest using webhook for notification or polling the transcripts list.
