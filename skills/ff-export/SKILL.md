---
name: ff-export
description: Export transcripts to Markdown or JSON formats. Use when saving transcripts to files for documentation or processing.
allowed-tools: Bash(npm exec --yes --package=fireflies-api -- fireflies-api export *)
---

# Fireflies Export

Export transcripts to various formats (Markdown, JSON).

## Command

```bash
npm exec --yes --package=fireflies-api -- fireflies-api export <id> [file] [options]
```

## Options

- `--no-summary` - Exclude summary from export
- `--no-timestamps` - Exclude timestamps
- `--format <format>` - Export format (md, json)

## Arguments

- `<id>` - Transcript ID (required)
- `[file]` - Output file path (optional, defaults to stdout)

## Examples

```bash
# Export to stdout
npm exec --yes --package=fireflies-api -- fireflies-api export "transcript_123"

# Export to markdown file
npm exec --yes --package=fireflies-api -- fireflies-api export "transcript_123" meeting-notes.md

# Export to JSON
npm exec --yes --package=fireflies-api -- fireflies-api export "transcript_123" meeting.json --format json

# Export without summary
npm exec --yes --package=fireflies-api -- fireflies-api export "transcript_123" notes.md --no-summary

# Export without timestamps
npm exec --yes --package=fireflies-api -- fireflies-api export "transcript_123" notes.md --no-timestamps
```

## Instructions

1. Verify API key is set:
   ```bash
   test -n "$FIREFLIES_API_KEY" && echo "Ready" || echo "ERROR: Set FIREFLIES_API_KEY"
   ```

2. Ask user for preferred format if not specified.

3. For file output, confirm the destination path with the user.

4. Markdown format is human-readable; JSON is for programmatic use.

## Usage Tips

**Format Selection:**
- Use Markdown (`.md`) for human-readable documentation (default)
- Use JSON only when user needs structured data for processing
- When exporting to stdout, Markdown is easier to read in the terminal
