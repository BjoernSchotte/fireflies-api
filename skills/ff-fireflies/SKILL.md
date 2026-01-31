---
name: ff-fireflies
description: Main hub for Fireflies.ai SDK. Use when working with meeting transcripts, search, insights, or live streaming.
allowed-tools: Bash(npm exec --yes --package=fireflies-api -- fireflies-api *)
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
npm exec --yes --package=fireflies-api -- fireflies-api transcripts list --limit 5

# Search transcripts
npm exec --yes --package=fireflies-api -- fireflies-api search "budget" --limit 10

# Get current user
npm exec --yes --package=fireflies-api -- fireflies-api users me

# Stream live transcription
npm exec --yes --package=fireflies-api -- fireflies-api realtime <meeting-id>
```

## API Key

The `FIREFLIES_API_KEY` environment variable must be set before using any command.

## Instructions

1. First, check prerequisites (API key and CLI availability):
   ```bash
   test -n "$FIREFLIES_API_KEY" && echo "API key: OK" || echo "ERROR: Set FIREFLIES_API_KEY environment variable"
   ```

2. Run commands using `npm exec --yes --package=fireflies-api -- fireflies-api <command>`. The `-y` flag auto-installs the package if not present.

3. Based on the user's request, route to the appropriate subcommand or suggest a specific `/ff-*` skill.

## CRITICAL Rules

**DO NOT:**
- Run `--help` commands - this skill documents all available options
- Invent options that aren't documented (e.g., `--fields` does not exist)
- Use `--from/--to` when date shortcuts work (use `--last-week` not `--from 2026-01-19 --to 2026-01-25`)
- Default to JSON output - use `-o table` or `-o plain` for human readability
- Pipe to jq/grep to work around missing features - data you need may not exist in output
- Try N+1 workarounds (looping `get` calls) - explain the limitation instead

**DO:**
- Trust this skill documentation - it is authoritative
- Use date shortcuts: `--last-week`, `--last-month`, `--days N`, `--today`, `--yesterday`
- Always add `-o table` or `-o plain` unless user asks for JSON
- Use `--external` to filter for meetings with external participants

## Choosing the Right Command

| User Intent | Best Command | Why |
|-------------|--------------|-----|
| "List my meetings" | `transcripts list --mine` | Quick overview |
| "Meetings I participated in" | `transcripts list --participant-me` | Includes meetings I didn't organize |
| "Meetings with external participants" | `transcripts list --external` | Filters by domain |
| "Show meeting details" | `transcripts get <id>` | Full content for one meeting |
| "Find what was said about X" | `search "X"` | Efficient cross-transcript search |
| "Meeting statistics/analytics" | `insights` | Aggregated analytics, no N+1 |
| "External participant analytics" | `insights --external` | Stats for external meetings |
| "All action items from last week" | `transcripts action-items export --last-week` | Bulk export |
| "Who talked most in meeting X" | `transcripts speakers <id>` | Speaker analytics |

**Output Format Guidance:**
- Default to human-readable formats (`-o table` or `-o plain`)
- Only use `-o json` when user explicitly requests JSON output
