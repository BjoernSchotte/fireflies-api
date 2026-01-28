---
name: ff-fireflies
description: Main hub for Fireflies.ai SDK. Use when working with meeting transcripts, search, insights, or live streaming.
allowed-tools: Bash(npx -y fireflies-api *)
---

# Fireflies SDK - Main Hub

> **Disclaimer**: This is an unofficial, community-built open source SDK. It is NOT affiliated with, endorsed by, or associated with Fireflies.ai Inc. This project provides a TypeScript SDK and CLI that uses the publicly available Fireflies API.

Use this skill as the main entry point for Fireflies.ai operations. Routes to appropriate subcommands based on the task.

## Available Subcommands

| Command | Description |
|---------|-------------|
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

```bash
# List recent transcripts
npx -y fireflies-api transcripts list --limit 5

# Search transcripts
npx -y fireflies-api search "budget" --limit 10

# Get current user
npx -y fireflies-api users me

# Stream live transcription
npx -y fireflies-api realtime <meeting-id>
```

## API Key

The `FIREFLIES_API_KEY` environment variable must be set before using any command.

## Instructions

1. First, check prerequisites (API key and CLI availability):
   ```bash
   test -n "$FIREFLIES_API_KEY" && echo "API key: OK" || echo "ERROR: Set FIREFLIES_API_KEY environment variable"
   ```

2. Run commands using `npx -y fireflies-api <command>`. The `-y` flag auto-installs the package if not present.

3. Based on the user's request, route to the appropriate subcommand or suggest a specific `/ff-*` skill.
