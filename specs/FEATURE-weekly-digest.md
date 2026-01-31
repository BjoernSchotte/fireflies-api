# Feature Spec: Weekly Digest Generator

## Overview

Auto-generate comprehensive summary reports aggregating insights, action items, and highlights across multiple meetings for a given time period.

**Priority:** High (high user value)
**Complexity:** Medium
**Swarm Applicable:** Yes - 4 parallel work streams

---

## Problem Statement

Users attend many meetings weekly but struggle to:
- Get a consolidated view of all action items assigned to them
- See highlights and key decisions across meetings
- Track time spent in meetings
- Share meeting summaries with stakeholders who weren't present

Currently, users must manually review each transcript or export them individually.

---

## API Research: Transcript Summary Data

The digest relies on data already available in the Fireflies API:

```typescript
// From src/types/transcript.ts
interface Transcript {
  id: string;
  title: string;
  dateString: string;
  duration: number;          // Duration in minutes
  participants?: string[];   // Participant names/emails
  summary?: Summary;
}

interface Summary {
  overview?: string;         // Meeting overview text
  action_items?: string[];   // Extracted action items
  keywords?: string[];       // Key topics discussed
  sentiments?: Sentiments;   // Sentiment percentages
  // ... other fields
}
```

**Key data points for digest:**
- `summary.action_items` - Consolidated into action items section
- `summary.overview` - Source for highlights extraction
- `duration` - Used for time statistics
- `participants` - Aggregated for participant stats
- `summary.sentiments` - Optional sentiment analysis

---

## Proposed Solution

### SDK API

```typescript
// New helper: src/helpers/digest.ts
import { generateDigest, type WeeklyDigest } from 'fireflies-api';

const digest = await generateDigest(client, {
  fromDate: '2024-01-08',
  toDate: '2024-01-14',
  // OR use shortcuts
  period: 'last-week',  // 'last-week' | 'this-week' | 'last-month'

  // Optional filters
  mine: true,
  organizers: ['me@company.com'],
  participants: ['client@acme.com'],

  // Content options
  includeActionItems: true,
  includeHighlights: true,
  includeStats: true,
  includeSentiment: true,

  // Grouping
  groupBy: 'day',  // 'day' | 'category' | 'participant' | 'none'
});

interface WeeklyDigest {
  period: { from: string; to: string };
  totalMeetings: number;
  totalDuration: number;  // minutes

  // Time breakdown
  stats: {
    totalMeetings: number;
    totalMinutes: number;
    averageDuration: number;
    busiestDay: string;
    meetingsByDay: Record<string, number>;
  };

  // All action items consolidated
  actionItems: {
    total: number;
    byAssignee: Record<string, ActionItem[]>;
    unassigned: ActionItem[];
    withDueDates: ActionItem[];
  };

  // Key highlights from each meeting
  highlights: Array<{
    meetingId: string;
    meetingTitle: string;
    meetingDate: string;
    keyPoints: string[];
    decisions: string[];
  }>;

  // Participation summary
  participants: Array<{
    email: string;
    name: string;
    meetingCount: number;
    totalMinutes: number;
  }>;

  // Overall sentiment (if enabled)
  sentiment?: {
    overall: number;
    trend: 'improving' | 'stable' | 'declining';
  };

  // Meeting list
  meetings: Array<{
    id: string;
    title: string;
    date: string;
    duration: number;
    participants: number;
  }>;
}
```

### CLI Command

```bash
# Generate digest for last week
fireflies digest --last-week

# Custom date range
fireflies digest --from 2024-01-01 --to 2024-01-31

# Output to file
fireflies digest --last-week -o weekly-report.md

# Different formats
fireflies digest --last-week --format markdown  # Default
fireflies digest --last-week --format html
fireflies digest --last-week --format json

# Filter options
fireflies digest --last-week --mine
fireflies digest --last-week --participant client@acme.com

# Focus on specific content
fireflies digest --last-week --action-items-only
fireflies digest --last-week --highlights-only
fireflies digest --last-week --stats-only

# With progress indicator
fireflies digest --last-month --progress
```

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Template approach | **Template literals** | No external deps, simple, sufficient for fixed formats |
| Period shortcuts | **Helper function** | Reusable across CLI commands, consistent date handling |
| Empty digest handling | **Return empty object** | Not an error - valid scenario with meaningful defaults |
| Action item source | **summary.action_items** | API-provided, consistent quality vs custom extraction |
| Participant dedup | **By normalized email** | Most reliable identifier, handles name variations |
| Concurrency default | **3 parallel fetches** | Balance between speed and rate limit safety |
| Progress callback | **Optional in options** | SDK doesn't force CLI concerns, but supports them |
| Output formats | **markdown, html, json** | Common use cases without over-engineering |

---

## Technical Design

### Files to Create/Modify

| File | Description |
|------|-------------|
| `src/helpers/digest.ts` | Core digest generation logic |
| `src/helpers/digest-templates.ts` | Markdown/HTML templates |
| `src/cli/commands/digest.ts` | CLI command handler |
| `test/unit/digest.test.ts` | Unit tests |

### Digest Generation Flow

```typescript
// src/helpers/digest.ts

export async function generateDigest(
  client: FirefliesClient,
  options: DigestOptions
): Promise<WeeklyDigest> {
  // 1. Fetch transcripts for period (with summary)
  const transcripts = await client.transcripts.list({
    fromDate: options.fromDate,
    toDate: options.toDate,
    mine: options.mine,
    includeSummary: true,
  });

  // 2. Fetch full details for each (parallel with batch)
  const fullTranscripts = await batchAll(
    transcripts.map(t => t.id),
    id => client.transcripts.get(id, { includeSummary: true }),
    { concurrency: 3 }
  );

  // 3. Aggregate data
  const stats = calculateStats(fullTranscripts);
  const actionItems = aggregateActionItems(fullTranscripts);
  const highlights = extractHighlights(fullTranscripts);
  const participants = aggregateParticipants(fullTranscripts);
  const sentiment = options.includeSentiment
    ? analyzeSentiment(fullTranscripts)
    : undefined;

  return {
    period: { from: options.fromDate, to: options.toDate },
    totalMeetings: transcripts.length,
    totalDuration: stats.totalMinutes,
    stats,
    actionItems,
    highlights,
    participants,
    sentiment,
    meetings: transcripts.map(t => ({
      id: t.id,
      title: t.title,
      date: t.dateString,
      duration: t.duration,
      participants: t.participants?.length ?? 0,
    })),
  };
}
```

### Markdown Template

```typescript
// src/helpers/digest-templates.ts

export function digestToMarkdown(digest: WeeklyDigest): string {
  return `
# Weekly Meeting Digest
**${digest.period.from} to ${digest.period.to}**

## Overview
- **${digest.totalMeetings}** meetings
- **${formatDuration(digest.totalDuration)}** total time
- **${digest.actionItems.total}** action items

## Meeting Stats
${formatStats(digest.stats)}

## Action Items
${formatActionItems(digest.actionItems)}

## Meeting Highlights
${formatHighlights(digest.highlights)}

## Participants
${formatParticipants(digest.participants)}

---
*Generated with fireflies-api*
`;
}
```

---

## Orchestration Strategy (Swarm Pattern)

```
┌─────────────────────────────────────────────────────────────────┐
│                     TEAM: weekly-digest                          │
└─────────────────────────────────────────────────────────────────┘

Phase 1: Aggregation Helpers (Parallel, Independent)
┌──────────────────────┐  ┌──────────────────────┐
│ stats-agent          │  │ highlights-agent     │
│ (general-purpose)    │  │ (general-purpose)    │
│                      │  │                      │
│ - calculateStats()   │  │ - extractHighlights  │
│ - Meeting counts     │  │ - Key points         │
│ - Duration totals    │  │ - Decisions          │
│ - By-day breakdown   │  │ - From summary       │
│ - Unit tests (TDD)   │  │ - Unit tests (TDD)   │
└──────────┬───────────┘  └──────────┬───────────┘
           │                         │
           └────────────┬────────────┘
                        ▼
Phase 2: Templates + Core (Parallel)
┌──────────────────────┐  ┌──────────────────────┐
│ template-agent       │  │ digest-agent         │
│ (general-purpose)    │  │ (general-purpose)    │
│                      │  │                      │
│ - digestToMarkdown   │  │ - generateDigest()   │
│ - digestToHtml       │  │ - Orchestrates all   │
│ - Section formatters │  │ - Uses paginateAll   │
│ - Unit tests         │  │ - Progress callback  │
└──────────┬───────────┘  └──────────┬───────────┘
           │                         │
           └────────────┬────────────┘
                        ▼
Phase 3: CLI + Integration
┌──────────────────────────────────────┐
│ cli-agent (general-purpose)          │
│                                      │
│ - digest command                     │
│ - All filter options                 │
│ - Output to file                     │
│ - Format selection                   │
│ - Progress integration               │
│ - Live E2E tests                     │
└──────────────────────────────────────┘
```

### Task Definitions

```javascript
// Phase 1: Parallel aggregation helpers
TaskCreate({
  subject: "Implement meeting stats aggregation",
  description: `
    Add to src/helpers/digest.ts:
    - calculateStats(transcripts[]) function
    - Total meetings, duration, average
    - By-day breakdown
    - Busiest day calculation

    TDD: Write tests first with fixture transcripts
  `,
  activeForm: "Implementing stats aggregation..."
})

TaskCreate({
  subject: "Implement highlights extraction",
  description: `
    Add to src/helpers/digest.ts:
    - extractHighlights(transcripts[]) function
    - Pull key points from summary.overview
    - Extract decisions from summary sections
    - Limit to top N highlights per meeting

    TDD: Write tests with various summary formats
  `,
  activeForm: "Implementing highlights extraction..."
})

// Phase 2: Templates and core
TaskCreate({
  subject: "Implement digest templates",
  description: `
    Create src/helpers/digest-templates.ts:
    - digestToMarkdown(digest) - full markdown report
    - digestToHtml(digest) - HTML version
    - Section formatters (stats, action items, highlights)

    No external template engines - use template literals
    TDD: Write tests verifying output structure
  `,
  activeForm: "Implementing templates..."
})

TaskCreate({
  subject: "Implement generateDigest core function",
  description: `
    Add to src/helpers/digest.ts:
    - generateDigest(client, options) main function
    - Fetch transcripts for period
    - Call all aggregation helpers
    - Support progress callback
    - Return WeeklyDigest object

    Integration test with mock client
  `,
  activeForm: "Implementing digest generator..."
})

// Phase 3: CLI
TaskCreate({
  subject: "Implement digest CLI command",
  description: `
    Create src/cli/commands/digest.ts:
    - fireflies digest --last-week
    - Date range options (--from, --to)
    - --output file option
    - --format option (markdown, html, json)
    - --progress integration
    - Focus flags (--action-items-only, etc.)
  `,
  activeForm: "Implementing CLI..."
})
```

---

## CLI Output Examples

### Terminal Output (Plain)

```bash
$ fireflies digest --last-week

Weekly Meeting Digest
═══════════════════════════════════════════════════════════════
January 8 - January 14, 2024

OVERVIEW
  Meetings:     12
  Total Time:   8h 45m
  Action Items: 23

MEETING STATS
  Mon   ████████ 4 meetings (2h 15m)
  Tue   ████ 2 meetings (1h 30m)
  Wed   ██████ 3 meetings (1h 45m)
  Thu   ██ 1 meeting (45m)
  Fri   ████ 2 meetings (2h 30m)

  Busiest Day: Monday
  Average Duration: 44 minutes

ACTION ITEMS (23 total)
  Assigned to You (8):
    ☐ Review Q1 roadmap - due Jan 20
    ☐ Send proposal to Acme Corp - due Jan 15
    ☐ Update sprint backlog
    ... and 5 more

  Assigned to Others (12):
    Sarah: 5 items
    John: 4 items
    Dev Team: 3 items

  Unassigned (3):
    ☐ Schedule follow-up meeting
    ☐ Research competitor pricing
    ☐ Update documentation

KEY HIGHLIGHTS
  ▸ Client Review (Jan 10)
    - Approved Phase 2 budget
    - Timeline extended to Q2

  ▸ Sprint Planning (Jan 12)
    - Committed to 15 story points
    - New hire starting next week

  ▸ Team Standup (Jan 14)
    - Blocker resolved on auth issue
    - Demo scheduled for Friday

TOP PARTICIPANTS
  1. Sarah Chen - 10 meetings (6h 30m)
  2. John Smith - 8 meetings (5h 15m)
  3. External: Acme Corp - 3 meetings (2h)

Generated with fireflies-api
```

### Markdown File Output

```bash
$ fireflies digest --last-week -o report.md

✓ Digest written to report.md (23 action items, 12 meetings)
```

---

## Test Plan

### Unit Tests (TDD)

**digest.test.ts:**
- Stats calculation with various meeting sets
- Highlights extraction from different summary formats
- Participant aggregation and deduplication
- Action item consolidation
- Empty period handling

**digest-templates.test.ts:**
- Markdown output structure
- HTML output structure
- Section formatting (stats table, action item lists)
- Edge cases (empty sections, long content)

### Live E2E Tests

```typescript
describe('digest (live)', () => {
  it('generates digest for last week', async () => {
    const digest = await generateDigest(client, {
      period: 'last-week',
      mine: true,
    });

    expect(digest.totalMeetings).toBeGreaterThanOrEqual(0);
    expect(digest.period.from).toBeDefined();
    expect(digest.period.to).toBeDefined();
  });

  it('outputs valid markdown', async () => {
    const digest = await generateDigest(client, { period: 'last-week' });
    const markdown = digestToMarkdown(digest);

    expect(markdown).toContain('# Weekly Meeting Digest');
    expect(markdown).toContain('## Action Items');
  });
});
```

---

## Acceptance Criteria

- [ ] `generateDigest()` aggregates data correctly
- [ ] Stats include all required metrics
- [ ] Action items consolidated with assignee grouping
- [ ] Highlights extracted from summaries
- [ ] `digestToMarkdown()` produces valid markdown
- [ ] `digestToHtml()` produces valid HTML
- [ ] `fireflies digest` CLI command works
- [ ] `--output` writes to file
- [ ] `--format` selects output format
- [ ] `--progress` shows progress during generation
- [ ] All tests pass
- [ ] Exported from `src/index.ts`

---

## Non-Goals / Out of Scope

This feature explicitly does NOT:
- Send digests via email (future enhancement)
- Post to Slack/Teams (future enhancement)
- Support custom templates (uses fixed formatters)
- Schedule automatic generation (manual only)
- Compare current period with previous (use diff feature)
- Include transcript content (summaries only)
- Support PDF output format
- Cache generated digests

---

## Dependencies (Existing Code to Reuse)

| Existing Code | Usage |
|---------------|-------|
| `src/helpers/action-items.ts` | `extractActionItems()` for consolidation |
| `src/helpers/batch.ts` | `batch()` for parallel fetching |
| `src/helpers/pagination.ts` | `paginateAll()` for listing |
| `src/helpers/markdown.ts` | Markdown formatting utilities |
| `src/cli/utils/dates.ts` | Period parsing (`--last-week`) |
| `src/cli/utils/progress.ts` | Progress indicators |
| `src/types/transcript.ts` | Transcript types |
| `src/types/action-items.ts` | ActionItem type |

---

## Default Values Table

| Option | Default | Description |
|--------|---------|-------------|
| `period` | Required | Must specify period or dates |
| `mine` | `false` | All transcripts |
| `includeActionItems` | `true` | Include action items section |
| `includeHighlights` | `true` | Include highlights section |
| `includeStats` | `true` | Include statistics section |
| `includeSentiment` | `false` | Exclude sentiment (requires extra processing) |
| `groupBy` | `'none'` | No grouping |
| `format` | `'markdown'` | Output format |
| `concurrency` | `3` | Parallel transcript fetches |

---

## Changelog Entry

```markdown
### Added
- `generateDigest()` helper for comprehensive meeting digests
- `digestToMarkdown()` and `digestToHtml()` template formatters
- `fireflies digest` CLI command with period-based generation
- `WeeklyDigest`, `DigestOptions`, `DigestStats` types
```

---

## Implementation Checklist (per CLAUDE.md)

### Step 1: Identify Layers
- [ ] Helpers needed: `calculateStats()`, `extractHighlights()`, `aggregateParticipants()`, `generateDigest()`, `digestToMarkdown()`, `digestToHtml()`
- [ ] SDK method: None (helper uses client internally)
- [ ] CLI command: `fireflies digest`

### Step 2: Implement Helpers (TDD) - Phase 1: Aggregators
- [ ] Create `test/unit/digest.test.ts`
- [ ] Write failing tests for `calculateStats()`
- [ ] Implement in `src/helpers/digest.ts`
- [ ] Write failing tests for `extractHighlights()`
- [ ] Implement highlights extraction
- [ ] Write failing tests for `aggregateParticipants()`
- [ ] Implement participant aggregation

### Step 2b: Implement Templates (TDD) - Phase 2
- [ ] Create `test/unit/digest-templates.test.ts`
- [ ] Write failing tests for `digestToMarkdown()`
- [ ] Implement in `src/helpers/digest-templates.ts`
- [ ] Write failing tests for `digestToHtml()`
- [ ] Implement HTML template

### Step 2c: Implement Core (TDD) - Phase 3
- [ ] Write failing tests for `generateDigest()`
- [ ] Implement main orchestration function
- [ ] All tests pass

### Step 3: Implement Types
- [ ] Create `src/types/digest.ts`
- [ ] Export types from `src/index.ts`
- [ ] Export helpers from `src/index.ts`

### Step 4: Implement CLI
- [ ] Create `src/cli/commands/digest.ts`
- [ ] Register in `src/cli/index.ts`
- [ ] Add `--output` file option
- [ ] Add `--format` option
- [ ] Integrate progress indicator

### Step 5: Verification
- [ ] `npm run build` succeeds
- [ ] `npm run typecheck` passes
- [ ] `npm run check` passes
- [ ] `npm test` passes
- [ ] Manual CLI test generating real digest

---

## Error Handling

```typescript
// Error scenarios:
// - No transcripts in date range → return empty digest, not error
// - Individual transcript fetch fails → skip, continue, log warning
// - All fetches fail → throw AggregateError with all failures
// - Invalid date range (from > to) → throw ValidationError
// - Output file not writable → throw with clear path in message

// Graceful degradation pattern:
function extractHighlights(transcript: Transcript): Highlight[] {
  // Missing summary is not an error
  if (!transcript.summary?.overview) {
    return [];
  }
  // ... extract highlights
}

// Partial results pattern:
interface DigestResult {
  digest: WeeklyDigest;
  warnings: string[];  // Non-fatal issues
  skipped: Array<{ id: string; reason: string }>;
}
```

---

## Rate Limiting

- Digest fetches multiple transcripts - use `batch()` helper
- Default `delayMs: 100` between transcript fetches
- Default `concurrency: 3` for parallel detail fetches
- Progress callback support for UI feedback
- Consider caching transcript summaries for repeated digest generation

---

## CLI Registration

Update `src/cli/index.ts`:
```typescript
import { registerDigestCommand } from './commands/digest.js';

registerDigestCommand(program);  // ADD THIS
```

---

## Types Location

Create `src/types/digest.ts`:
```typescript
export interface DigestOptions {
  fromDate?: string;
  toDate?: string;
  period?: 'last-week' | 'this-week' | 'last-month';
  mine?: boolean;
  organizers?: string[];
  participants?: string[];
  includeActionItems?: boolean;
  includeHighlights?: boolean;
  includeStats?: boolean;
  includeSentiment?: boolean;
  groupBy?: 'day' | 'category' | 'participant' | 'none';
}

export interface WeeklyDigest {
  // ... as defined in SDK API section
}

export interface DigestStats {
  totalMeetings: number;
  totalMinutes: number;
  averageDuration: number;
  busiestDay: string;
  meetingsByDay: Record<string, number>;
}

export interface DigestHighlight {
  meetingId: string;
  meetingTitle: string;
  meetingDate: string;
  keyPoints: string[];
  decisions: string[];
}
```

Export from `src/index.ts`.

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

```typescript
// CLI uses withProgress for digest generation
const digest = await withProgress(
  { enabled: showProgress, text: 'Generating digest...' },
  async (update) => {
    update('Fetching transcript list...');
    const transcripts = await client.transcripts.list(params);

    let completed = 0;
    const total = transcripts.length;

    update(`Fetching details... 0/${total}`);
    const fullTranscripts = await batchAll(
      transcripts.map(t => t.id),
      async (id) => {
        const result = await client.transcripts.get(id);
        completed++;
        update(`Fetching details... ${completed}/${total}`);
        return result;
      },
      { concurrency: 3 }
    );

    update('Aggregating data...');
    return buildDigest(fullTranscripts, options);
  }
);
```

---

## Backward Compatibility

- `generateDigest()` is a new function - no breaking changes
- `digestToMarkdown()` is a new function - no breaking changes
- No changes to existing types
- All new helpers are additive

---

## Limitations (Document Clearly)

1. **Action items depend on Fireflies AI extraction** - Quality varies by meeting audio/content
2. **Highlights are derived from summary.overview** - May not capture all important points
3. **Duration accuracy depends on transcript metadata** - Meetings without duration show 0
4. **Participant names may be inconsistent** - Same person might appear with different names across meetings (use speaker-identification feature for normalization)
5. **Large date ranges may hit rate limits** - Use progress callback and appropriate delays for month+ ranges
6. **No real-time updates** - Digest reflects data at generation time

---

## Test Fixtures

Create test fixtures in `test/fixtures/digest/`:
- `transcripts-week.json` - Array of 5 transcripts for a week
- `transcript-with-actions.json` - Transcript with action items
- `transcript-no-summary.json` - Transcript without summary data
- `expected-digest.json` - Expected digest output for fixtures

---

## JSDoc Requirements

All public functions must have JSDoc:
```typescript
/**
 * Generate a comprehensive digest for meetings in a time period.
 *
 * @param client - Fireflies client instance
 * @param options - Digest generation options including date range and filters
 * @returns Weekly digest with stats, action items, highlights, and participants
 *
 * @example
 * ```typescript
 * const digest = await generateDigest(client, {
 *   period: 'last-week',
 *   mine: true,
 *   includeActionItems: true,
 *   includeHighlights: true,
 * });
 * console.log(`${digest.totalMeetings} meetings, ${digest.actionItems.total} action items`);
 * ```
 */
export async function generateDigest(
  client: FirefliesClient,
  options: DigestOptions
): Promise<WeeklyDigest>;

/**
 * Convert digest to markdown format.
 *
 * @param digest - Digest to convert
 * @returns Markdown string suitable for reports or documentation
 *
 * @example
 * ```typescript
 * const markdown = digestToMarkdown(digest);
 * await writeFile('weekly-report.md', markdown);
 * ```
 */
export function digestToMarkdown(digest: WeeklyDigest): string;

/**
 * Convert digest to HTML format.
 *
 * @param digest - Digest to convert
 * @returns HTML string suitable for emails or web display
 *
 * @example
 * ```typescript
 * const html = digestToHtml(digest);
 * await sendEmail({ body: html });
 * ```
 */
export function digestToHtml(digest: WeeklyDigest): string;

/**
 * Calculate meeting statistics from transcripts.
 *
 * @param transcripts - Array of transcripts to analyze
 * @returns Statistics including totals, averages, and by-day breakdown
 *
 * @example
 * ```typescript
 * const stats = calculateStats(transcripts);
 * console.log(`Busiest day: ${stats.busiestDay}`);
 * ```
 */
export function calculateStats(transcripts: Transcript[]): DigestStats;
```

---

## Future Enhancements

1. **Email integration** - Send digest via email
2. **Slack/Teams integration** - Post digest to channels
3. **Custom templates** - User-provided templates
4. **Scheduling** - Auto-generate on schedule
5. **Comparison** - Compare this week vs. last week

---

## Code Patterns to Follow

Based on existing codebase patterns:

```typescript
// 1. Use batchAll for collecting multiple transcripts
import { batchAll } from './batch.js';

const fullTranscripts = await batchAll(
  transcripts.map(t => t.id),
  id => client.transcripts.get(id, { includeSummary: true }),
  { concurrency: 3, continueOnError: true }
);

// 2. Aggregation pattern from meeting-insights.ts
function aggregateActionItems(transcripts: Transcript[]): DigestActionItems {
  const byAssignee = new Map<string, ActionItem[]>();

  for (const t of transcripts) {
    for (const item of extractActionItems(t)) {
      const assignee = item.assignee ?? 'unassigned';
      const items = byAssignee.get(assignee) ?? [];
      items.push(item);
      byAssignee.set(assignee, items);
    }
  }

  return {
    total: /* count */,
    byAssignee: Object.fromEntries(byAssignee),
    // ...
  };
}

// 3. Template string pattern (no external template engines)
export function digestToMarkdown(digest: WeeklyDigest): string {
  return `# Weekly Meeting Digest
**${digest.period.from} to ${digest.period.to}**

## Overview
- **${digest.totalMeetings}** meetings
- **${formatDuration(digest.stats.totalMinutes)}** total time

${formatActionItemsSection(digest.actionItems)}
`;
}

// 4. Period calculation helpers
function getPeriodDates(period: 'last-week' | 'this-week' | 'last-month'): {
  fromDate: string;
  toDate: string;
} {
  const now = new Date();
  // ... calculate based on period
}

// 5. Empty state with meaningful defaults
function emptyDigest(period: { from: string; to: string }): WeeklyDigest {
  return {
    period,
    totalMeetings: 0,
    totalDuration: 0,
    stats: emptyStats(),
    actionItems: { total: 0, byAssignee: {}, unassigned: [], withDueDates: [] },
    highlights: [],
    participants: [],
    meetings: [],
  };
}
```

---

## References

- `src/helpers/meeting-insights.ts` - Similar aggregation patterns
- `src/helpers/action-items.ts` - Action item extraction
- `src/helpers/markdown.ts` - Existing markdown utilities
- `src/helpers/batch.ts` - Concurrent fetching
