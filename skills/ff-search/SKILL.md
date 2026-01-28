---
name: ff-search
description: Full-text search across meeting transcripts. Use when finding specific content, speakers, or questions.
allowed-tools: Bash(npx -y fireflies-api search *)
---

# Fireflies Search

Full-text search across meeting transcripts.

## Command

```bash
npx -y fireflies-api search <query> [options]
```

## Options

- `--speaker <name>` - Filter by speaker name
- `--questions` - Search only questions
- `--tasks` - Search only task-related content
- `--context` - Include surrounding context
- `--case-sensitive` - Case-sensitive search
- `--scope <scope>` - Search scope
- `--from <date>` - Start date (YYYY-MM-DD)
- `--to <date>` - End date (YYYY-MM-DD)
- `--today` - Today's transcripts
- `--yesterday` - Yesterday's transcripts
- `--last-week` - Last 7 days
- `--last-month` - Last 30 days
- `--days <n>` - Last N days
- `--limit <n>` - Number of results
- `-o, --output <format>` - Output format: json, jsonl, table, tsv, plain

## Examples

```bash
# Basic search
npx -y fireflies-api search "budget"

# Search with speaker filter
npx -y fireflies-api search "proposal" --speaker "John"

# Search questions from last week
npx -y fireflies-api search "deadline" --questions --last-week

# Search with context
npx -y fireflies-api search "action item" --context --limit 20
```

## Instructions

1. Verify API key is set:
   ```bash
   test -n "$FIREFLIES_API_KEY" && echo "Ready" || echo "ERROR: Set FIREFLIES_API_KEY"
   ```

2. Execute the search command with the user's query and any relevant filters.

3. Suggest appropriate filters based on the user's intent (e.g., `--questions` for finding Q&A).
