---
name: ff-meetings
description: Manage active meetings and add Fireflies bot to calls. Use when listing active meetings or adding bot to a meeting URL.
allowed-tools: Bash(npx -y fireflies-api meetings *)
---

# Fireflies Meetings

Manage active meetings and add bots to meetings.

## Commands

### List Active Meetings
```bash
npx -y fireflies-api meetings list [options]
```

**Options:**
- `--state <state>` - Filter by meeting state
- `--email <email>` - Filter by participant email
- `-o, --output <format>` - Output format: json, jsonl, table, tsv, plain

### Add Bot to Meeting
```bash
npx -y fireflies-api meetings add-bot <url> [options]
```

**Options:**
- `--title <title>` - Meeting title
- `--duration <minutes>` - Expected duration
- `--password <password>` - Meeting password (if required)
- `--language <code>` - Transcription language

## Examples

```bash
# List active meetings
npx -y fireflies-api meetings list

# Add bot to a Zoom meeting
npx -y fireflies-api meetings add-bot "https://zoom.us/j/123456789" --title "Team Standup"

# Add bot with password
npx -y fireflies-api meetings add-bot "https://zoom.us/j/123456789" --password "abc123" --duration 60
```

## Instructions

1. Verify API key is set:
   ```bash
   test -n "$FIREFLIES_API_KEY" && echo "Ready" || echo "ERROR: Set FIREFLIES_API_KEY"
   ```

2. For listing meetings, show active meetings with their current state.

3. For adding bots, ensure the meeting URL is valid and suggest adding a title for easier identification.
