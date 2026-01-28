# Claude Code Plugin

> **Disclaimer**: This is an unofficial, community-built open source SDK. It is NOT affiliated with, endorsed by, or associated with Fireflies.ai Inc. This project provides a TypeScript SDK and CLI that uses the publicly available Fireflies API.

This plugin enables Claude Code to interact with Fireflies.ai through `/ff-*` slash commands.

## Installation

```bash
/plugin marketplace add BjoernSchotte/fireflies-api
/plugin install fireflies@fireflies-api
```

## API Key Setup

Set your Fireflies API key before launching Claude Code. Claude never sees the actual key value:

```bash
# Direct
export FIREFLIES_API_KEY="your-api-key"
claude

# Using 1Password (recommended)
export FIREFLIES_API_KEY=$(op read "op://Personal/Fireflies/credential")
claude
```

Get your API key from [Fireflies Settings](https://app.fireflies.ai/integrations/custom/fireflies).

## Available Commands

| Command | Description |
|---------|-------------|
| `/ff-fireflies` | Main hub - routes to subcommands |
| `/ff-transcripts` | List, get, analyze transcripts |
| `/ff-search` | Full-text search across transcripts |
| `/ff-insights` | Aggregate meeting analytics |
| `/ff-meetings` | Active meetings, add bot |
| `/ff-users` | User management |
| `/ff-bites` | Clips and soundbites |
| `/ff-ai-apps` | AI app outputs |
| `/ff-audio` | Upload audio files |
| `/ff-realtime` | Live transcription streaming |
| `/ff-export` | Export to markdown/JSON |

## Quick Examples

### List Recent Transcripts
```
/ff-transcripts list --limit 5
```

### Search Transcripts
```
/ff-search "budget discussion" --last-week
```

### Get Meeting Insights
```
/ff-insights --last-month --group-by speaker
```

### Stream Live Transcription
```
/ff-realtime <meeting-id>
```

### Export Transcript
```
/ff-export <transcript-id> meeting-notes.md
```

## Date Filters

Many commands support date filters:

| Filter | Description |
|--------|-------------|
| `--from <date>` | Start date (YYYY-MM-DD) |
| `--to <date>` | End date (YYYY-MM-DD) |
| `--today` | Today's data |
| `--yesterday` | Yesterday's data |
| `--last-week` | Last 7 days |
| `--last-month` | Last 30 days |
| `--days <n>` | Last N days |

## Output Formats

Use `-o` or `--output` to specify format:

- `json` - JSON object
- `jsonl` - JSON Lines (one object per line)
- `table` - ASCII table
- `tsv` - Tab-separated values
- `plain` - Plain text

## Realtime Streaming

The `/ff-realtime` command streams live transcription from active meetings:

1. Ensure a Fireflies bot is in an active meeting
2. Get the meeting ID from `/ff-meetings list`
3. Run `/ff-realtime <meeting-id>`
4. Transcription appears in real-time as speakers talk
5. Press Ctrl+C to stop

## Troubleshooting

### "ERROR: Set FIREFLIES_API_KEY"

The API key is not set. Export it before launching Claude Code:
```bash
export FIREFLIES_API_KEY="your-api-key"
```

### Command not found

Ensure the plugin is installed:
```bash
/plugin list
```

If not listed, reinstall:
```bash
/plugin marketplace add BjoernSchotte/fireflies-api
/plugin install fireflies@fireflies-api
```

### Permission denied

Some operations require specific Fireflies plan levels. Check your account permissions at [Fireflies Settings](https://app.fireflies.ai/settings).
