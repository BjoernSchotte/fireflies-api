# Feature Spec: Bulk Export Command

## Overview

Export multiple transcripts in parallel to various formats (Markdown, JSON, TXT, CSV) with progress tracking.

**Priority:** High (common user request)
**Complexity:** Medium
**Swarm Applicable:** Yes - 4 parallel work streams

---

## Problem Statement

Currently, users can only export one transcript at a time via `fireflies export <id>`. For users wanting to:
- Archive all meetings from a project
- Create a searchable local backup
- Generate reports across multiple meetings

...they must script multiple export calls manually.

---

## Proposed Solution

### Architecture: SDK + Pure Helpers

Following "functional core, imperative shell" principle:
- **SDK layer**: Fetches transcripts from API (existing methods)
- **Helper layer**: Pure format conversion functions (no API calls)
- **CLI layer**: Orchestrates fetching, conversion, and file writing

### SDK API (Data Fetching)

```typescript
// SDK handles API calls - existing methods, no changes needed
const transcripts = await client.transcripts.list({
  fromDate: '2024-01-01',
  toDate: '2024-01-31',
  mine: true,
});

// Fetch full transcript content for each
const fullTranscript = await client.transcripts.get(id);
```

### Helper API (Pure Functions)

```typescript
// src/helpers/export-formats.ts - Pure functions, no client/API calls
import {
  transcriptToMarkdown,
  transcriptToJson,
  transcriptToText,
  transcriptToCsv,
  exportTranscript,
  type ExportFormat,
} from 'fireflies-api';

// Convert single transcript to format (pure)
const markdown = transcriptToMarkdown(transcript);
const json = transcriptToJson(transcript);
const text = transcriptToText(transcript);
const csv = transcriptToCsv(transcript);

// Generic export helper (pure)
const content = exportTranscript(transcript, 'markdown');
const content = exportTranscript(transcript, 'csv');
```

### Result Types

```typescript
interface BulkExportResult {
  succeeded: Array<{ id: string; path: string }>;
  failed: Array<{ id: string; error: Error }>;
  totalExported: number;
  totalFailed: number;
}
```

### CLI Command

```bash
# Export by date range
fireflies export-bulk --last-month -o ./exports

# Export specific transcripts
fireflies export-bulk --ids id1,id2,id3 -o ./exports

# Different formats
fireflies export-bulk --last-week --format json -o ./exports
fireflies export-bulk --last-week --format csv -o ./exports   # Flat CSV of sentences
fireflies export-bulk --last-week --format txt -o ./exports   # Plain text

# With progress (uses --progress from previous feature)
fireflies export-bulk --last-month --progress -o ./exports

# Control concurrency
fireflies export-bulk --last-month --concurrency 5 -o ./exports

# Filter options
fireflies export-bulk --last-month --mine --organizer me@company.com -o ./exports
```

---

## Technical Design

### Files to Create/Modify

| File | Description |
|------|-------------|
| `src/helpers/export-formats.ts` | Pure format converters (markdown, JSON, TXT, CSV) |
| `src/cli/commands/export-bulk.ts` | CLI orchestration (SDK → helpers → file I/O) |
| `test/unit/export-formats.test.ts` | Pure function tests |

### Export Formats

```typescript
// src/helpers/export-formats.ts

/** Export transcript to plain text */
export function transcriptToText(transcript: Transcript): string {
  // Title + metadata header
  // Sentences as "Speaker: text" lines
}

/** Export transcript to CSV (flat sentence rows) */
export function transcriptToCsv(transcript: Transcript): string {
  // Headers: timestamp,speaker,text,isQuestion,isTask
  // One row per sentence
}

/** Export transcript to JSON (full structure) */
export function transcriptToJson(transcript: Transcript): string {
  return JSON.stringify(transcript, null, 2);
}

// Markdown already exists in src/helpers/markdown.ts
```

### CLI Orchestration Logic

```typescript
// src/cli/commands/export-bulk.ts - Orchestration layer
async function exportBulkCommand(options: ExportBulkCliOptions) {
  // 1. SDK layer: Fetch transcript list
  const transcripts = await client.transcripts.list({
    fromDate: options.fromDate,
    toDate: options.toDate,
    mine: options.mine,
  });

  // 2. Create output directory
  await mkdir(options.outputDir, { recursive: true });

  // 3. Process each transcript
  const results: BulkExportResult = { succeeded: [], failed: [], totalExported: 0, totalFailed: 0 };

  for await (const item of batch(transcripts, async (t) => {
    // SDK: Fetch full transcript
    const full = await client.transcripts.get(t.id);

    // Helper: Pure format conversion
    const content = exportTranscript(full, options.format);

    // File I/O: Write to disk
    const path = join(options.outputDir, `${t.id}.${options.format}`);
    await writeFile(path, content);

    return { id: t.id, path };
  }, { concurrency: options.concurrency })) {
    if (item.status === 'fulfilled') {
      results.succeeded.push(item.value);
      results.totalExported++;
    } else {
      results.failed.push({ id: item.id, error: item.reason });
      results.totalFailed++;
    }
  }

  return results;
}
```

### Pure Export Helper

```typescript
// src/helpers/export-formats.ts - Pure function, no I/O
export function exportTranscript(
  transcript: Transcript,
  format: ExportFormat
): string {
  switch (format) {
    case 'markdown': return transcriptToMarkdown(transcript);
    case 'json': return transcriptToJson(transcript);
    case 'txt': return transcriptToText(transcript);
    case 'csv': return transcriptToCsv(transcript);
  }
}
```

---

## Orchestration Strategy (Swarm Pattern)

```
┌─────────────────────────────────────────────────────────────────┐
│                     TEAM: bulk-export                            │
└─────────────────────────────────────────────────────────────────┘

Phase 1: Format Converters (Parallel, Independent)
┌──────────────────────┐  ┌──────────────────────┐
│ txt-format-agent     │  │ csv-format-agent     │
│ (general-purpose)    │  │ (general-purpose)    │
│                      │  │                      │
│ - transcriptToText() │  │ - transcriptToCsv()  │
│ - Unit tests         │  │ - Unit tests         │
│ - Handle edge cases  │  │ - Escape special     │
└──────────┬───────────┘  └──────────┬───────────┘
           │                         │
           └────────────┬────────────┘
                        ▼
Phase 2: CLI Orchestration (after Phase 1)
┌──────────────────────────────────────────────┐
│ cli-agent (general-purpose)                  │
│                                              │
│ - export-bulk command                        │
│ - Orchestrates: SDK fetch → helper → write   │
│ - Progress tracking with batch()             │
│ - Error handling and reporting               │
│ - All CLI options                            │
└──────────┬───────────┘  └──────────┬───────────┘
           │                         │
           └────────────┬────────────┘
                        ▼
Phase 3: Integration Tests (blocked by Phase 2)
┌──────────────────────────────────────┐
│ test-agent (general-purpose)         │
│                                      │
│ - Integration tests with mock fs     │
│ - Live E2E test (exports to temp)    │
│ - Verify all formats work            │
└──────────────────────────────────────┘
```

### Task Definitions

```javascript
// Phase 1: Parallel format workers
TaskCreate({
  subject: "Implement TXT export format",
  description: `
    Create transcriptToText() in src/helpers/export-formats.ts:
    - Title and date header
    - Sentences as "Speaker: text" format
    - Optional timestamps
    - TDD: Write tests first in test/unit/export-formats.test.ts
  `,
  activeForm: "Implementing TXT format..."
})

TaskCreate({
  subject: "Implement CSV export format",
  description: `
    Create transcriptToCsv() in src/helpers/export-formats.ts:
    - Headers: timestamp,speaker,text,isQuestion,isTask
    - Proper CSV escaping (quotes, commas, newlines)
    - TDD: Write tests first
  `,
  activeForm: "Implementing CSV format..."
})

// Phase 2: Core logic (blocked by Phase 1)
TaskCreate({
  subject: "Implement bulkExport helper",
  description: `
    Create src/helpers/bulk-export.ts:
    - Resolve transcripts from IDs or query
    - Use batch() for concurrent fetching
    - Convert each to target format
    - Write files with proper naming
    - Progress callback support
    - Error collection (continue on failure)
  `,
  activeForm: "Implementing bulk export..."
})

// CLI agent runs in parallel with bulk-export-agent
TaskCreate({
  subject: "Implement export-bulk CLI command",
  description: `
    Create src/cli/commands/export-bulk.ts:
    - All filter options (--from, --to, --last-week, etc.)
    - --format option (markdown, json, txt, csv)
    - --output directory option
    - --concurrency option
    - --progress integration
    - --ids for specific transcripts
  `,
  activeForm: "Implementing CLI command..."
})
```

---

## Test Plan

### Unit Tests (TDD Required)

**export-formats.test.ts:**
- TXT: Basic conversion, special characters, empty sentences
- CSV: Proper escaping, headers, empty fields
- All formats handle missing optional fields

**bulk-export.test.ts:**
- Resolves transcript IDs correctly
- Respects concurrency limit
- Continues on individual failures
- Progress callback called correctly
- Creates output directory if missing

### Live E2E Tests

```typescript
describe('bulk export (live)', () => {
  it('exports last 3 transcripts to temp directory', async () => {
    const tmpDir = await mkdtemp('bulk-export-test');

    const result = await bulkExport(client, {
      limit: 3,
      format: 'markdown',
      outputDir: tmpDir,
    });

    expect(result.succeeded.length).toBe(3);
    // Verify files exist
  });
});
```

---

## CLI Output Examples

```bash
$ fireflies export-bulk --last-week --format markdown -o ./exports --progress

⠋ Exporting transcripts... 3/12

✔ Exported 12 transcripts to ./exports
  - 12 succeeded
  - 0 failed
  - Formats: markdown
  - Total size: 2.4 MB

$ fireflies export-bulk --last-month --format json -o ./backup

Exported 47 transcripts to ./backup
  - 45 succeeded
  - 2 failed (use --verbose for details)
```

---

## Acceptance Criteria

- [ ] `bulkExport()` helper works with all options
- [ ] All 4 formats work: markdown, json, txt, csv
- [ ] `fireflies export-bulk` CLI command works
- [ ] Progress display with `--progress` flag
- [ ] Concurrent exports respect `--concurrency`
- [ ] Failed exports don't stop the batch
- [ ] Output directory created if missing
- [ ] Files named sensibly (date + sanitized title)
- [ ] All tests pass
- [ ] Exported from `src/index.ts`

---

## File Naming Convention

```
./exports/
  2024-01-15-weekly-standup.md
  2024-01-16-client-review-acme-corp.md
  2024-01-17-sprint-planning.md
```

Format: `YYYY-MM-DD-sanitized-title.{ext}`

---

## Non-Goals / Out of Scope

This feature explicitly does NOT:
- Support cloud storage destinations (S3, GCS, etc.) - local filesystem only
- Merge multiple transcripts into a single file
- Support custom templates (use fixed format converters)
- Compress/zip output files
- Upload to external services
- Support incremental/delta exports (always full export)
- Filter sentences within transcripts (exports full content)

---

## Dependencies (Existing Code to Reuse)

| Existing Code | Usage |
|---------------|-------|
| `src/helpers/markdown.ts` | `transcriptToMarkdown()` already exists |
| `src/helpers/batch.ts` | `batch()` for concurrent fetching |
| `src/helpers/pagination.ts` | `paginateAll()` for listing |
| `src/cli/utils/dates.ts` | Date parsing for filters |
| `src/cli/utils/progress.ts` | Progress indicators |
| `src/types/transcript.ts` | Transcript type |

---

## Default Values Table

| Option | Default | Description |
|--------|---------|-------------|
| `format` | `'markdown'` | Output format |
| `concurrency` | `3` | Parallel fetches |
| `delayMs` | `100` | Delay between fetches |
| `overwrite` | `true` | Overwrite existing files |
| `limit` | `undefined` | No limit (all matching) |
| `mine` | `false` | All transcripts |

---

## Changelog Entry

```markdown
### Added
- `bulkExport()` helper for batch transcript export
- `transcriptToText()` and `transcriptToCsv()` format converters
- `fireflies export-bulk` CLI command with progress tracking
- `BulkExportOptions`, `BulkExportResult`, `ExportFormat` types
```

---

## Implementation Checklist (per CLAUDE.md)

### Step 1: Identify Layers
- [ ] Helpers needed: `transcriptToText()`, `transcriptToCsv()`, `bulkExport()`
- [ ] SDK method: None (helper uses client internally)
- [ ] CLI command: `fireflies export-bulk`

### Step 2: Implement Helpers (TDD)
- [ ] Create `test/unit/export-formats.test.ts`
- [ ] Write failing tests for TXT format
- [ ] Implement `transcriptToText()` in `src/helpers/export-formats.ts`
- [ ] Write failing tests for CSV format
- [ ] Implement `transcriptToCsv()`
- [ ] Create `test/unit/bulk-export.test.ts`
- [ ] Write failing tests for `bulkExport()`
- [ ] Implement `bulkExport()` in `src/helpers/bulk-export.ts`
- [ ] All tests pass

### Step 3: Implement Types
- [ ] Create `src/types/bulk-export.ts`
- [ ] Export types from `src/index.ts`
- [ ] Export helpers from `src/index.ts`

### Step 4: Implement CLI
- [ ] Create `src/cli/commands/export-bulk.ts`
- [ ] Register in `src/cli/index.ts`
- [ ] Add all filter and format options
- [ ] Integrate progress indicator

### Step 5: Verification
- [ ] `npm run build` succeeds
- [ ] `npm run typecheck` passes
- [ ] `npm run check` passes
- [ ] `npm test` passes
- [ ] Manual CLI test with real exports

---

## Error Handling

```typescript
// Error scenarios:
// - Output directory doesn't exist → create it (mkdir -p behavior)
// - Output directory not writable → throw with clear message
// - Individual transcript fetch fails → log error, continue, include in failed[]
// - File already exists → overwrite (or --no-overwrite flag to skip)
// - Disk full → throw, report partial progress
// - Rate limit → retry with backoff, then fail if exhausted

interface BulkExportError extends Error {
  transcriptId: string;
  phase: 'fetch' | 'convert' | 'write';
}
```

---

## Rate Limiting

- Use `batch()` helper which already handles delays between requests
- Default `delayMs: 100` between transcript fetches
- Respect `concurrency` option (default: 3)
- Consider disk I/O - don't parallelize writes excessively

---

## CLI Registration

Update `src/cli/index.ts`:
```typescript
import { registerExportBulkCommand } from './commands/export-bulk.js';

registerExportBulkCommand(program);  // ADD THIS
```

---

## Additional CLI Options

```bash
# Dry run - show what would be exported
fireflies export-bulk --last-week --dry-run

# Skip existing files instead of overwriting
fireflies export-bulk --last-week --no-overwrite

# Verbose output for debugging
fireflies export-bulk --last-week --verbose
```

---

## Types Location

Create `src/types/bulk-export.ts`:
```typescript
export interface BulkExportOptions {
  // ... as defined in SDK API section
}

export interface BulkExportResult {
  // ... as defined in SDK API section
}

export type ExportFormat = 'markdown' | 'json' | 'txt' | 'csv';
```

Export from `src/index.ts`:
```typescript
export type {
  BulkExportOptions,
  BulkExportResult,
  ExportFormat,
} from './types/bulk-export.js';
```

---

## Quality Gates (per CLAUDE.md)

Before requesting commit approval:
- [ ] TDD followed (red-green-refactor cycle)
- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run check` (biome) passes
- [ ] Pre-existing lint warnings in modified files are fixed
- [ ] No `any` without justification
- [ ] Public API changes have JSDoc with `@example`
- [ ] Types exported from `src/index.ts`

---

## Progress Integration

CLI uses `withProgress` for visual feedback:
```typescript
await withProgress(
  { enabled: showProgress, text: 'Exporting transcripts...' },
  async (update) => {
    let completed = 0;
    for await (const result of bulkExportStream(...)) {
      completed++;
      update(`Exporting transcripts... ${completed}/${total}`);
    }
  }
);
```

---

## Memory Considerations

For large exports (100+ transcripts):
- Stream results instead of collecting all in memory
- Write files as soon as converted (don't buffer)
- Consider `--batch-size` option for very large exports

---

## Backward Compatibility

- `bulkExport()` is a new helper function - no breaking changes
- `transcriptToText()` and `transcriptToCsv()` are new functions - no breaking changes
- Existing `transcriptToMarkdown()` in `src/helpers/markdown.ts` is not modified
- No changes to existing CLI commands (`fireflies export` remains unchanged)

---

## Test Fixtures

Create test fixtures in `test/fixtures/export/`:
- `transcript-full.json` - Complete transcript with all fields
- `transcript-minimal.json` - Transcript with only required fields
- `transcript-special-chars.json` - Transcript with CSV-problematic characters
- `expected-output.csv` - Expected CSV output for comparison
- `expected-output.txt` - Expected TXT output for comparison

---

## JSDoc Requirements

All public functions must have JSDoc:
```typescript
/**
 * Export multiple transcripts to files in parallel.
 *
 * @param client - Fireflies client instance
 * @param options - Export options including format, output directory, and filters
 * @returns Results summary with succeeded and failed exports
 *
 * @example
 * ```typescript
 * const results = await bulkExport(client, {
 *   fromDate: '2024-01-01',
 *   toDate: '2024-01-31',
 *   format: 'markdown',
 *   outputDir: './exports',
 *   onProgress: (completed, total) => console.log(`${completed}/${total}`),
 * });
 * console.log(`Exported ${results.totalExported} transcripts`);
 * ```
 */
export async function bulkExport(
  client: FirefliesClient,
  options: BulkExportOptions
): Promise<BulkExportResult>;

/**
 * Convert transcript to plain text format.
 *
 * @param transcript - Transcript to convert
 * @returns Plain text representation with speaker labels
 *
 * @example
 * ```typescript
 * const text = transcriptToText(transcript);
 * await writeFile('meeting.txt', text);
 * ```
 */
export function transcriptToText(transcript: Transcript): string;

/**
 * Convert transcript to CSV format.
 *
 * @param transcript - Transcript to convert
 * @returns CSV string with headers and properly escaped values
 *
 * @example
 * ```typescript
 * const csv = transcriptToCsv(transcript);
 * await writeFile('meeting.csv', csv);
 * ```
 */
export function transcriptToCsv(transcript: Transcript): string;
```

---

## Code Patterns to Follow

Based on existing codebase patterns:

```typescript
// 1. Use batch() for streaming, batchAll() for collecting
// From src/helpers/batch.ts - follow this pattern

// Streaming results as they complete:
for await (const result of batch(transcriptIds, async (id) => {
  const transcript = await client.transcripts.get(id);
  const content = transcriptToText(transcript);
  await writeFile(getOutputPath(transcript), content);
  return { id, path: getOutputPath(transcript) };
}, { delayMs: 100 })) {
  if (result.error) {
    failed.push({ id: result.item, error: result.error });
  } else {
    succeeded.push(result.result);
  }
}

// 2. CSV escaping - handle quotes, commas, newlines
function escapeCsvField(field: string): string {
  if (field.includes('"') || field.includes(',') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

// 3. File naming with sanitization
function sanitizeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

// 4. Progress callback pattern
export interface BulkExportOptions {
  onProgress?: (completed: number, total: number) => void;
  onError?: (id: string, error: Error) => void;
}

// 5. Result type with discriminated union
export type ExportResult =
  | { id: string; path: string; error?: never }
  | { id: string; path?: never; error: Error };
```

---

## References

- Existing `src/helpers/markdown.ts` for markdown format
- Existing `src/helpers/batch.ts` for concurrent processing
- `src/cli/commands/export.ts` for single export (extend patterns)
- `src/cli/utils/progress.ts` for progress indicators
