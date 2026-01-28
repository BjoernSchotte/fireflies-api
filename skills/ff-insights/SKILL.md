---
name: ff-insights
description: Aggregate meeting analytics and statistics. Use when analyzing meeting patterns, speaker time, or trends.
allowed-tools: Bash(npx -y fireflies-api insights *)
---

# Fireflies Insights

Aggregate meeting analytics and statistics.

## Command

```bash
npx -y fireflies-api insights [options]
```

## Options

- `--from <date>` - Start date (YYYY-MM-DD)
- `--to <date>` - End date (YYYY-MM-DD)
- `--today` - Today's meetings
- `--yesterday` - Yesterday's meetings
- `--last-week` - Last 7 days
- `--last-month` - Last 30 days
- `--days <n>` - Last N days
- `--external` - Include external participants
- `--speaker <name>` - Filter by speaker
- `--group-by <field>` - Group results by field
- `--top <n>` - Show top N results
- `-o, --output <format>` - Output format: json, jsonl, table, tsv, plain

## Examples

```bash
# Get insights for last week
npx -y fireflies-api insights --last-week

# Get insights grouped by speaker
npx -y fireflies-api insights --last-month --group-by speaker

# Get top 5 speakers
npx -y fireflies-api insights --days 30 --top 5

# Get insights for specific date range
npx -y fireflies-api insights --from 2024-01-01 --to 2024-01-31
```

## Instructions

1. Verify API key is set:
   ```bash
   test -n "$FIREFLIES_API_KEY" && echo "Ready" || echo "ERROR: Set FIREFLIES_API_KEY"
   ```

2. Execute the insights command with appropriate date filters.

3. Suggest grouping options for better analysis (by speaker, by date, etc.).
