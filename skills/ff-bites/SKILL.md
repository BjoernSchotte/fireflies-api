---
name: ff-bites
description: Manage clips and soundbites from transcripts. Use when creating, listing, or getting highlight clips from meetings.
allowed-tools: Bash(npm exec --yes --package=fireflies-api -- fireflies-api bites *)
---

# Fireflies Bites

Manage clips and soundbites from meeting transcripts.

## Commands

### List Bites
```bash
npm exec --yes --package=fireflies-api -- fireflies-api bites list [options]
```

**Options:**
- `--transcript <id>` - Filter by transcript ID
- `--limit <n>` - Number of bites to return
- `--mine` - Only my bites
- `--team` - Include team bites
- `-o, --output <format>` - Output format: json, jsonl, table, tsv, plain

### Get Bite
```bash
npm exec --yes --package=fireflies-api -- fireflies-api bites get <id>
```

### Create Bite
```bash
npm exec --yes --package=fireflies-api -- fireflies-api bites create [options]
```

**Options:**
- `--transcript <id>` - Transcript ID (required)
- `--start <seconds>` - Start time in seconds
- `--end <seconds>` - End time in seconds
- `--name <name>` - Bite name
- `--media-type <type>` - Media type
- `--summary <text>` - Summary text
- `--privacy <level>` - Privacy level

## Examples

```bash
# List recent bites
npm exec --yes --package=fireflies-api -- fireflies-api bites list --limit 10

# List bites from a specific transcript
npm exec --yes --package=fireflies-api -- fireflies-api bites list --transcript "transcript_123"

# Get a specific bite
npm exec --yes --package=fireflies-api -- fireflies-api bites get "bite_456"

# Create a new bite
npm exec --yes --package=fireflies-api -- fireflies-api bites create --transcript "transcript_123" --start 120 --end 180 --name "Key Decision"
```

## Instructions

1. Verify API key is set:
   ```bash
   test -n "$FIREFLIES_API_KEY" && echo "Ready" || echo "ERROR: Set FIREFLIES_API_KEY"
   ```

2. For creating bites, ensure start and end times are within the transcript duration.

3. Suggest meaningful names for bites to make them easier to find later.
