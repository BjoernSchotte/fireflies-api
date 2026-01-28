---
name: ff-ai-apps
description: View AI application outputs and custom AI analysis for transcripts. Use when retrieving AI-generated summaries or custom analysis.
allowed-tools: Bash(npm exec --yes --package=fireflies-api -- fireflies-api ai-apps *)
---

# Fireflies AI Apps

View AI application outputs and custom AI analysis for transcripts.

Fireflies allows custom AI apps to process transcripts, generating summaries, analysis, and other AI-powered outputs.

## Command

```bash
npm exec --yes --package=fireflies-api -- fireflies-api ai-apps list [options]
```

## Options

- `--transcript <id>` - Transcript ID (required)
- `--app <name>` - Filter by app name
- `--limit <n>` - Number of results
- `-o, --output <format>` - Output format: json, jsonl, table, tsv, plain

## Examples

```bash
# List all AI app outputs for a transcript
npm exec --yes --package=fireflies-api -- fireflies-api ai-apps list --transcript "transcript_123"

# Filter by specific app
npm exec --yes --package=fireflies-api -- fireflies-api ai-apps list --transcript "transcript_123" --app "Summary Generator"

# Limit results
npm exec --yes --package=fireflies-api -- fireflies-api ai-apps list --transcript "transcript_123" --limit 5
```

## Instructions

1. Verify API key is set:
   ```bash
   test -n "$FIREFLIES_API_KEY" && echo "Ready" || echo "ERROR: Set FIREFLIES_API_KEY"
   ```

2. The `--transcript` option is required to list AI app outputs.

3. AI app outputs contain custom analysis, summaries, and other AI-generated content configured in the user's Fireflies account.
