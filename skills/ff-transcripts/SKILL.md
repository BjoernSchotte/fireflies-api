---
name: ff-transcripts
description: Manage and analyze meeting transcripts. Use when listing, getting, or analyzing transcripts, speakers, or action items.
allowed-tools: Bash(npx -y fireflies-api transcripts *)
---

# Fireflies Transcripts

Manage and analyze meeting transcripts from Fireflies.ai.

## Commands

### List Transcripts
```bash
npx -y fireflies-api transcripts list [options]
```

**Options:**
- `--limit <n>` - Number of transcripts to return
- `--from <date>` - Start date (YYYY-MM-DD)
- `--to <date>` - End date (YYYY-MM-DD)
- `--today` - Today's transcripts
- `--yesterday` - Yesterday's transcripts
- `--last-week` - Last 7 days
- `--last-month` - Last 30 days
- `--days <n>` - Last N days
- `--mine` - Only my transcripts
- `--keyword <text>` - Filter by keyword
- `--scope <scope>` - Filter scope
- `--organizer <email>` - Filter by organizer
- `--participant <email>` - Filter by participant
- `--normalize` - Normalize speaker names
- `-o, --output <format>` - Output format: json, jsonl, table, tsv, plain

### Get Transcript
```bash
npx -y fireflies-api transcripts get <id> [options]
```

**Options:**
- `--sentences` - Include sentences
- `--summary` - Include summary
- `--speakers` - Include speaker info
- `--action-items` - Include action items

### Speaker Analysis
```bash
npx -y fireflies-api transcripts speakers <id> [options]
```

**Options:**
- `--no-merge` - Don't merge similar speaker names
- `--raw-percentages` - Show raw percentage values

### Action Items
```bash
npx -y fireflies-api transcripts action-items get <id> [options]
```

**Options:**
- `--no-assignees` - Hide assignees
- `--no-due-dates` - Hide due dates
- `--include-source` - Include source context

### Export Action Items
```bash
npx -y fireflies-api transcripts action-items export [options]
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
npx -y fireflies-api transcripts delete <id> --confirm
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
