---
name: ff-transcripts
description: Manage and analyze meeting transcripts. Use when listing, getting, or analyzing transcripts, speakers, or action items.
allowed-tools: Bash(npm exec --yes --package=fireflies-api -- fireflies-api transcripts *)
---

# Fireflies Transcripts

Manage and analyze meeting transcripts from Fireflies.ai.

## Commands

### List Transcripts
```bash
npm exec --yes --package=fireflies-api -- fireflies-api transcripts list [options]
```

**Date Shortcuts (prefer these over --from/--to):**
- `--today` - Today's transcripts
- `--yesterday` - Yesterday's transcripts
- `--last-week` - Last 7 days
- `--last-month` - Last 30 days
- `--days <n>` - Last N days

**Other Options:**
- `--limit <n>` - Number of transcripts to return
- `--from <date>` - Start date (YYYY-MM-DD) - only if shortcuts don't fit
- `--to <date>` - End date (YYYY-MM-DD) - only if shortcuts don't fit
- `--mine` - Only my transcripts (I organized)
- `--participant-me` - Only meetings where I am a participant
- `--external` - Only meetings with external (non-company) participants
- `--keyword <text>` - Filter by keyword
- `--organizer <email>` - Filter by organizer (repeatable)
- `--participant <email>` - Filter by participant (repeatable)
- `-o, --output <format>` - Output format: json, jsonl, table, tsv, plain

### Get Transcript
```bash
npm exec --yes --package=fireflies-api -- fireflies-api transcripts get <id> [options]
```

**Options:**
- `--sentences` - Include sentences
- `--summary` - Include summary
- `--speakers` - Include speaker info
- `--action-items` - Include action items

### Speaker Analysis
```bash
npm exec --yes --package=fireflies-api -- fireflies-api transcripts speakers <id> [options]
```

**Options:**
- `--no-merge` - Don't merge similar speaker names
- `--raw-percentages` - Show raw percentage values

### Action Items
```bash
npm exec --yes --package=fireflies-api -- fireflies-api transcripts action-items get <id> [options]
```

**Options:**
- `--no-assignees` - Hide assignees
- `--no-due-dates` - Hide due dates
- `--include-source` - Include source context

### Export Action Items
```bash
npm exec --yes --package=fireflies-api -- fireflies-api transcripts action-items export [options]
```

**Options:**
- All date filter options
- `--assignee <email>` - Filter by assignee
- `--style <style>` - Output style
- `--group-by <field>` - Group results
- `--preset <name>` - Use preset
- `-o, --output <format>` - Output format

### Delete Transcript
```bash
npm exec --yes --package=fireflies-api -- fireflies-api transcripts delete <id> --confirm
```

**Note:** The `--confirm` flag is required.

## Instructions

1. Verify API key is set:
   ```bash
   test -n "$FIREFLIES_API_KEY" && echo "Ready" || echo "ERROR: Set FIREFLIES_API_KEY"
   ```

2. Execute the appropriate transcript command based on user request.

3. For listing, suggest appropriate filters based on context.

4. For deletion, always warn the user and require explicit confirmation.

## CRITICAL Rules

**DO NOT:**
- Run `--help` - this skill documents all options
- Invent options (e.g., `--fields` does NOT exist)
- Use `--from/--to` when shortcuts work - use `--last-week` instead
- Output JSON by default - always use `-o table` or `-o plain`
- Pipe to jq/grep to filter - use built-in flags instead

**DO:**
- Use date shortcuts: `--last-week`, `--last-month`, `--days N`
- Always include `-o table` (or `-o plain`) for human-readable output
- Use `--external` for meetings with external participants (filters by domain)

## Usage Tips

**Output Format:**
- Use `-o table` or `-o plain` for human-readable output (recommended)
- Only use `-o json` if user explicitly needs JSON or programmatic output

**Efficient Querying:**
- `transcripts list` returns basic info only (id, title, date, duration)
- For detailed info (summary, sentences), you must use `transcripts get <id>` per transcript
- **Avoid N+1**: Consider these alternatives:
  - Need analytics? Use `/ff-insights` (single efficient call)
  - Need to find content? Use `/ff-search` (searches all transcripts at once)
  - Need action items? Use `transcripts action-items export` (bulk export)

**External Participant Filtering:**
- Use `--external` to filter for meetings with participants outside your company domain
- Example: `transcripts list --last-week --external -o table`
