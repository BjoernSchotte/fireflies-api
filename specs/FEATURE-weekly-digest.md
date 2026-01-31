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

### Architecture: SDK + Pure Helpers

Following CLAUDE.md's "functional core, imperative shell" principle:
- **SDK layer**: Fetches data from API
- **Helper layer**: Pure functions for aggregation and rendering (no API calls)

### SDK API (Data Fetching)

```typescript
// SDK handles API calls - existing method, no changes needed
const transcripts = await client.transcripts.list({
  fromDate: '2024-01-08',
  toDate: '2024-01-14',
  mine: true,
  limit: 100,
});

// Or fetch with full details for richer digest
const fullTranscripts = await client.transcripts.listWithDetails({
  period: 'last-week',  // Shortcut for date range
  mine: true,
});
```

### Helper API (Pure Functions)

```typescript
// src/helpers/digest.ts - Pure functions, no client/API calls
import {
  buildDigest,
  calculateStats,
  aggregateActionItems,
  extractHighlights,
  renderDigest,
  type WeeklyDigest,
} from 'fireflies-api';

// 1. Build digest from transcripts (pure aggregation)
const digest = buildDigest(transcripts, {
  includeActionItems: true,
  includeHighlights: true,
  includeStats: true,
  includeSentiment: true,
  groupBy: 'day',
});

// 2. Render to output format (pure template rendering)
const output = renderDigest(digest);                              // Default template
const output = renderDigest(digest, { template: 'compact' });     // Built-in preset
const output = renderDigest(digest, { template: './spanish.md' }); // Custom file

// Individual pure helpers (composable)
const stats = calculateStats(transcripts);
const actionItems = aggregateActionItems(transcripts);
const highlights = extractHighlights(transcripts);

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

# Custom template from markdown file
fireflies digest --last-week --template ./my-template.md
fireflies digest --last-week --template ./templates/spanish.md

# Built-in template variants
fireflies digest --last-week --template compact    # Minimal output
fireflies digest --last-week --template executive  # Executive summary style
```

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Template approach | **Markdown with {{variables}}** | No code required, easy to customize, i18n-friendly |
| Built-in templates | **Named presets** | `default`, `compact`, `executive` for common use cases |
| Template syntax | **Mustache-like {{var}}** | Simple, widely known, no learning curve |
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
| `src/helpers/digest-templates.ts` | Template rendering engine |
| `src/templates/digest/default.md` | Default digest template |
| `src/templates/digest/compact.md` | Minimal output template |
| `src/templates/digest/executive.md` | Executive summary template |
| `src/cli/commands/digest.ts` | CLI command handler |
| `test/unit/digest.test.ts` | Unit tests |
| `test/unit/digest-templates.test.ts` | Template rendering tests |

### Digest Generation Flow

**CLI/Application code (imperative shell):**
```typescript
// CLI command or user code - orchestrates SDK + helpers
async function createDigest(client: FirefliesClient, options: DigestCliOptions) {
  // 1. SDK layer: Fetch data from API
  const transcripts = await client.transcripts.list({
    fromDate: options.fromDate,
    toDate: options.toDate,
    mine: options.mine,
  });

  // 2. Helper layer: Pure aggregation (no API calls)
  const digest = buildDigest(transcripts, options);

  // 3. Helper layer: Pure rendering (no API calls)
  const output = renderDigest(digest, { template: options.template });

  return output;
}
```

**Pure helper functions (functional core):**
```typescript
// src/helpers/digest.ts - NO client parameter, NO API calls

/** Pure function: aggregate transcripts into digest structure */
export function buildDigest(
  transcripts: Transcript[],
  options: DigestBuildOptions = {}
): WeeklyDigest {
  const stats = calculateStats(transcripts);
  const actionItems = options.includeActionItems !== false
    ? aggregateActionItems(transcripts)
    : emptyActionItems();
  const highlights = options.includeHighlights !== false
    ? extractHighlights(transcripts)
    : [];
  const participants = aggregateParticipants(transcripts);

  return {
    period: calculatePeriod(transcripts),
    totalMeetings: transcripts.length,
    totalDuration: stats.totalMinutes,
    stats,
    actionItems,
    highlights,
    participants,
    meetings: transcripts.map(toMeetingSummary),
  };
}

/** Pure function: calculate meeting statistics */
export function calculateStats(transcripts: Transcript[]): DigestStats { ... }

/** Pure function: aggregate action items by assignee */
export function aggregateActionItems(transcripts: Transcript[]): DigestActionItems { ... }

/** Pure function: extract highlights from summaries */
export function extractHighlights(transcripts: Transcript[]): DigestHighlight[] { ... }
```

### Template System

Templates are markdown files with `{{variable}}` placeholders:

**Default template (`templates/default.md`):**
```markdown
# Weekly Meeting Digest
**{{period.from}} to {{period.to}}**

## Overview
- **{{totalMeetings}}** meetings
- **{{stats.totalMinutes | duration}}** total time
- **{{actionItems.total}}** action items

## Meeting Stats
{{#stats.meetingsByDay}}
- {{day}}: {{count}} meetings
{{/stats.meetingsByDay}}

Busiest day: {{stats.busiestDay}}

## Action Items
{{#actionItems.byAssignee}}
### {{assignee}}
{{#items}}
- [ ] {{text}}{{#dueDate}} (due {{dueDate}}){{/dueDate}}
{{/items}}
{{/actionItems.byAssignee}}

## Meeting Highlights
{{#highlights}}
### {{meetingTitle}} ({{meetingDate}})
{{#keyPoints}}
- {{.}}
{{/keyPoints}}
{{/highlights}}

---
*Generated with fireflies-api*
```

**Custom Spanish template example (`templates/spanish.md`):**
```markdown
# Resumen Semanal de Reuniones
**{{period.from}} al {{period.to}}**

## Resumen
- **{{totalMeetings}}** reuniones
- **{{stats.totalMinutes | duration}}** tiempo total
- **{{actionItems.total}}** tareas pendientes

## Tareas Pendientes
{{#actionItems.byAssignee}}
### Asignado a: {{assignee}}
{{#items}}
- [ ] {{text}}
{{/items}}
{{/actionItems.byAssignee}}

---
*Generado con fireflies-api*
```

**Template rendering:**
```typescript
// src/helpers/digest-templates.ts

export function renderDigest(
  digest: WeeklyDigest,
  options?: { template?: string }
): string {
  const templatePath = resolveTemplate(options?.template ?? 'default');
  const templateContent = readFileSync(templatePath, 'utf-8');
  return renderTemplate(templateContent, digest);
}

// Built-in templates: 'default', 'compact', 'executive'
// Custom templates: path to .md file
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
│ - renderTemplate()   │  │ - buildDigest()      │
│ - renderDigest()     │  │ - Combines helpers   │
│ - Built-in .md files │  │ - Pure function      │
│ - Unit tests         │  │ - Unit tests         │
└──────────┬───────────┘  └──────────┬───────────┘
           │                         │
           └────────────┬────────────┘
                        ▼
Phase 3: CLI (Orchestration Layer)
┌──────────────────────────────────────┐
│ cli-agent (general-purpose)          │
│                                      │
│ - digest command                     │
│ - Orchestrates: SDK → build → render │
│ - --template option                  │
│ - Output to file                     │
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
  subject: "Implement template rendering",
  description: `
    Create src/helpers/digest-templates.ts:
    - renderTemplate(template, data) - mustache-like parser
    - renderDigest(digest, options) - loads template, renders
    - Create built-in templates: default.md, compact.md, executive.md

    TDD: Write tests for variable substitution, loops, filters
  `,
  activeForm: "Implementing templates..."
})

TaskCreate({
  subject: "Implement buildDigest core function",
  description: `
    Add to src/helpers/digest.ts:
    - buildDigest(transcripts, options) - pure function
    - Combines all aggregation helpers
    - NO client parameter, NO API calls
    - Return WeeklyDigest object

    TDD: Write tests with fixture transcripts
  `,
  activeForm: "Implementing buildDigest..."
})

// Phase 3: CLI (Orchestration Layer)
TaskCreate({
  subject: "Implement digest CLI command",
  description: `
    Create src/cli/commands/digest.ts:
    - Orchestrates: client.transcripts.list() → buildDigest() → renderDigest()
    - Date range options (--from, --to, --last-week)
    - --template option (built-in name or path to .md file)
    - --output file option
    - --progress integration
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
  it('builds digest from real transcripts', async () => {
    // SDK layer: fetch data
    const transcripts = await client.transcripts.list({
      fromDate: getLastWeekStart(),
      toDate: getLastWeekEnd(),
      mine: true,
    });

    // Helper layer: pure aggregation
    const digest = buildDigest(transcripts);

    expect(digest.totalMeetings).toBeGreaterThanOrEqual(0);
    expect(digest.period.from).toBeDefined();
  });

  it('renders with default template', async () => {
    const transcripts = await client.transcripts.list({ limit: 5 });
    const digest = buildDigest(transcripts);
    const output = renderDigest(digest);

    expect(markdown).toContain('# Weekly Meeting Digest');
    expect(markdown).toContain('## Action Items');
  });
});
```

---

## Acceptance Criteria

- [ ] `buildDigest()` aggregates transcripts correctly (pure function)
- [ ] `calculateStats()` computes all required metrics
- [ ] `aggregateActionItems()` groups by assignee correctly
- [ ] `extractHighlights()` extracts from summaries
- [ ] `renderDigest()` renders with default template
- [ ] `--template compact` uses built-in compact template
- [ ] `--template ./custom.md` loads custom template file
- [ ] Template variables `{{var}}` are replaced correctly
- [ ] Template loops `{{#items}}...{{/items}}` work
- [ ] CLI orchestrates: SDK fetch → buildDigest → renderDigest
- [ ] `fireflies digest` CLI command works
- [ ] `--output` writes to file
- [ ] `--progress` shows progress during generation
- [ ] All tests pass
- [ ] Exported from `src/index.ts`

---

## Non-Goals / Out of Scope

This feature explicitly does NOT:
- Send digests via email (future enhancement)
- Post to Slack/Teams (future enhancement)
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
| `template` | `'default'` | Built-in template or path to custom .md file |
| `concurrency` | `3` | Parallel transcript fetches |

---

## Changelog Entry

```markdown
### Added
- `buildDigest()` pure helper for aggregating transcripts into digest
- `renderDigest()` pure helper with customizable markdown templates
- `calculateStats()`, `aggregateActionItems()`, `extractHighlights()` composable helpers
- Built-in templates: `default`, `compact`, `executive`
- Custom template support via `--template path/to/template.md`
- `fireflies digest` CLI command with period-based generation
- `WeeklyDigest`, `DigestBuildOptions`, `RenderOptions` types
```

---

## Implementation Checklist (per CLAUDE.md)

### Step 1: Identify Layers
- [ ] **SDK layer**: Use existing `client.transcripts.list()` - no new SDK methods needed
- [ ] **Helpers (pure)**: `buildDigest()`, `calculateStats()`, `extractHighlights()`, `aggregateParticipants()`, `aggregateActionItems()`
- [ ] **Templates (pure)**: `renderDigest()`, `renderTemplate()` + built-in `.md` files
- [ ] **CLI**: `fireflies digest` with `--template` option (orchestrates SDK + helpers)

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
- [ ] Write failing tests for `renderTemplate()` (variable substitution)
- [ ] Implement mustache-like template parser in `src/helpers/digest-templates.ts`
- [ ] Write failing tests for `renderDigest()` with built-in templates
- [ ] Create built-in templates: `default.md`, `compact.md`, `executive.md`
- [ ] Write failing tests for custom template file loading
- [ ] Implement custom template file support

### Step 2c: Implement Core (TDD) - Phase 3
- [ ] Write failing tests for `buildDigest()` (combines all aggregators)
- [ ] Implement `buildDigest()` - pure function, no client
- [ ] All tests pass

### Step 3: Implement Types
- [ ] Create `src/types/digest.ts`
- [ ] Export types from `src/index.ts`
- [ ] Export helpers from `src/index.ts`

### Step 4: Implement CLI (Orchestration Layer)
- [ ] Create `src/cli/commands/digest.ts`
- [ ] Register in `src/cli/index.ts`
- [ ] CLI orchestrates: SDK fetch → `buildDigest()` → `renderDigest()`
- [ ] Add `--template` option (path or built-in name)
- [ ] Add `--output` file option
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
/** Options for buildDigest() - pure aggregation */
export interface DigestBuildOptions {
  includeActionItems?: boolean;
  includeHighlights?: boolean;
  includeStats?: boolean;
  includeSentiment?: boolean;
  groupBy?: 'day' | 'category' | 'participant' | 'none';
}

/** Options for renderDigest() - pure template rendering */
export interface RenderOptions {
  /** Built-in template name or path to custom .md file */
  template?: 'default' | 'compact' | 'executive' | string;
}

/** CLI options - combines SDK params + build + render options */
export interface DigestCliOptions {
  fromDate?: string;
  toDate?: string;
  period?: 'last-week' | 'this-week' | 'last-month';
  mine?: boolean;
  template?: string;
  output?: string;
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

- `buildDigest()` is a new function - no breaking changes
- `renderDigest()` is a new function - no breaking changes
- `renderTemplate()` is a new function - no breaking changes
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
 * Build a digest from transcripts. Pure function - no API calls.
 *
 * @param transcripts - Array of transcripts to aggregate
 * @param options - Build options for filtering sections
 * @returns Weekly digest with stats, action items, highlights, and participants
 *
 * @example
 * ```typescript
 * const transcripts = await client.transcripts.list({ period: 'last-week' });
 * const digest = buildDigest(transcripts, {
 *   includeActionItems: true,
 *   includeHighlights: true,
 * });
 * console.log(`${digest.totalMeetings} meetings`);
 * ```
 */
export function buildDigest(
  transcripts: Transcript[],
  options?: DigestBuildOptions
): WeeklyDigest;

/**
 * Render digest using a template. Pure function.
 *
 * @param digest - Digest to render
 * @param options - Template options (built-in name or path to .md file)
 * @returns Rendered string (markdown by default)
 *
 * @example
 * ```typescript
 * const output = renderDigest(digest);                          // Default
 * const output = renderDigest(digest, { template: 'compact' }); // Built-in
 * const output = renderDigest(digest, { template: './es.md' }); // Custom
 * ```
 */
export function renderDigest(
  digest: WeeklyDigest,
  options?: RenderOptions
): string;

/**
 * Calculate meeting statistics from transcripts. Pure function.
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

Based on existing codebase patterns and "functional core, imperative shell":

```typescript
// 1. CLI as orchestration layer (imperative shell)
// src/cli/commands/digest.ts
async function digestCommand(options: DigestCliOptions) {
  // SDK layer: fetch data
  const transcripts = await client.transcripts.list({
    fromDate: options.fromDate,
    toDate: options.toDate,
    mine: options.mine,
  });

  // Helper layer: pure aggregation
  const digest = buildDigest(transcripts, options);

  // Helper layer: pure rendering
  const output = renderDigest(digest, { template: options.template });

  // Output
  if (options.output) {
    writeFileSync(options.output, output);
  } else {
    console.log(output);
  }
}

// 2. Pure aggregation helpers (functional core) - NO client parameter
// src/helpers/digest.ts
export function aggregateActionItems(transcripts: Transcript[]): DigestActionItems {
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
  };
}

// 3. Template rendering with mustache-like syntax
// src/helpers/digest-templates.ts
export function renderDigest(digest: WeeklyDigest, options?: RenderOptions): string {
  const templatePath = resolveTemplate(options?.template ?? 'default');
  const template = readFileSync(templatePath, 'utf-8');
  return renderTemplate(template, digest);
}

function renderTemplate(template: string, data: object): string {
  // Replace {{var}} with data.var
  // Handle {{#items}}...{{/items}} loops
  // Handle {{var | filter}} filters
}

// 4. Empty state with meaningful defaults
function emptyDigest(): WeeklyDigest {
  return {
    period: { from: '', to: '' },
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
