---
name: ff-insights
description: Aggregate meeting analytics and statistics. Use when analyzing meeting patterns, speaker time, or trends.
allowed-tools: Bash(npm exec --yes --package=fireflies-api -- fireflies-api insights *)
---

# Fireflies Insights

Aggregate meeting analytics and statistics.

## Command

```bash
npm exec --yes --package=fireflies-api -- fireflies-api insights [options]
```

## Options

**Date Shortcuts (prefer these over --from/--to):**
- `--today` - Today's meetings
- `--yesterday` - Yesterday's meetings
- `--last-week` - Last 7 days
- `--last-month` - Last 30 days
- `--days <n>` - Last N days

**Analytics Options:**
- `--external` - Include external participants
- `--speaker <name>` - Filter by speaker
- `--group-by <field>` - Group results by field
- `--top <n>` - Show top N results
- `--from <date>` - Start date (YYYY-MM-DD) - only if shortcuts don't fit
- `--to <date>` - End date (YYYY-MM-DD) - only if shortcuts don't fit
- `-o, --output <format>` - Output format: json, jsonl, table, tsv, plain

## Examples

```bash
# Get insights for last week
npm exec --yes --package=fireflies-api -- fireflies-api insights --last-week

# Get insights grouped by speaker
npm exec --yes --package=fireflies-api -- fireflies-api insights --last-month --group-by speaker

# Get top 5 speakers
npm exec --yes --package=fireflies-api -- fireflies-api insights --days 30 --top 5

# Get insights for specific date range
npm exec --yes --package=fireflies-api -- fireflies-api insights --from 2024-01-01 --to 2024-01-31
```

## Instructions

1. Verify API key is set:
   ```bash
   test -n "$FIREFLIES_API_KEY" && echo "Ready" || echo "ERROR: Set FIREFLIES_API_KEY"
   ```

2. Execute the insights command with appropriate date filters.

3. Suggest grouping options for better analysis (by speaker, by date, etc.).

## Usage Tips

**Output Format:**
- Use `-o plain` for detailed human-readable output
- Use `-o table` for compact summary
- Only use `-o json` if user needs structured data

**When to Use Insights:**
- Getting meeting statistics and trends (efficient - single call)
- Speaker analytics across multiple meetings
- Time-based analysis (by day, week, month)
- **Meetings with external participants** - use `--external` flag (filters by domain)
- Avoids N+1 queries - aggregates in one API call
