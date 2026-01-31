# Feature Spec: Sentiment Analysis Dashboard

## Overview

Expose and aggregate the sentiment data already returned by the Fireflies API, providing per-speaker sentiment scores and trends over time.

**Priority:** Medium
**Complexity:** Medium
**Swarm Applicable:** Yes - 4 parallel work streams

---

## Problem Statement

The Fireflies API returns sentiment data in the `summary.sentiments` field, but:
1. It's not easily accessible without fetching full transcripts
2. There's no aggregation across meetings
3. No per-speaker sentiment breakdown
4. No trend analysis over time

Users want to answer questions like:
- "How was the overall mood in client meetings this month?"
- "Which speaker tends to be more positive/negative?"
- "Are our team meetings trending more positive over time?"

---

## API Research: Existing Sentiment Data

```typescript
// From src/types/transcript.ts
interface Sentiments {
  positive: number;   // Percentage 0-100
  negative: number;
  neutral: number;
}

interface Summary {
  sentiments?: Sentiments;
  // ... other fields
}
```

The API provides meeting-level sentiment percentages, but no per-speaker breakdown in the standard response.

---

## Proposed Solution

### SDK API

```typescript
// New helper: src/helpers/sentiment-analytics.ts
import { analyzeSentiment, type SentimentAnalytics } from 'fireflies-api';

// Single transcript analysis
const sentiment = analyzeSentiment(transcript);

interface SentimentAnalytics {
  overall: Sentiments;           // Meeting-level (from API)
  bySpeaker: SpeakerSentiment[]; // Derived from sentence analysis
  dominantSentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;        // -100 to +100 composite score
}

interface SpeakerSentiment {
  speakerName: string;
  sentiments: Sentiments;
  sentimentScore: number;
  sentenceCount: number;
}

// Multi-transcript aggregation
const insights = await client.transcripts.sentimentInsights({
  fromDate: '2024-01-01',
  toDate: '2024-01-31',
  groupBy: 'week', // 'day' | 'week' | 'month'
  speakers: ['John', 'Sarah'], // Optional: filter to specific speakers
});

interface SentimentInsights {
  overall: Sentiments;
  sentimentScore: number;
  totalMeetings: number;
  bySpeaker: SpeakerSentiment[];
  byPeriod: PeriodSentiment[];   // Trend data
  mostPositiveMeeting: { id: string; title: string; score: number };
  mostNegativeMeeting: { id: string; title: string; score: number };
}

interface PeriodSentiment {
  period: string;      // "2024-W03" or "2024-01-15"
  meetingCount: number;
  sentiments: Sentiments;
  sentimentScore: number;
}
```

### CLI Command

```bash
# Single transcript sentiment
fireflies sentiment <transcript-id>
# Output: Overall sentiment with speaker breakdown

# Aggregate sentiment insights
fireflies sentiment --last-month
fireflies sentiment --last-week --mine
fireflies sentiment --from 2024-01-01 --to 2024-01-31

# Group by period for trends
fireflies sentiment --last-month --group-by week

# Filter to specific speakers
fireflies sentiment --last-month --speaker "John" --speaker "Sarah"

# Output formats
fireflies sentiment --last-week -o json
fireflies sentiment --last-week -o table  # Tabular summary
```

---

## Technical Design

### Files to Create/Modify

| File | Description |
|------|-------------|
| `src/helpers/sentiment-analytics.ts` | Core sentiment analysis logic |
| `src/types/sentiment.ts` | Sentiment-specific types |
| `src/graphql/queries/transcripts.ts` | Add sentimentInsights method |
| `src/cli/commands/sentiment.ts` | CLI command handler |
| `test/unit/sentiment-analytics.test.ts` | Unit tests |

### Sentiment Score Calculation

```typescript
/**
 * Calculate composite sentiment score from percentages.
 * Returns value from -100 (all negative) to +100 (all positive).
 */
function calculateSentimentScore(sentiments: Sentiments): number {
  // Score = positive% - negative%
  // Neutral doesn't affect score
  return sentiments.positive - sentiments.negative;
}

// Examples:
// { positive: 80, negative: 10, neutral: 10 } → +70
// { positive: 20, negative: 60, neutral: 20 } → -40
// { positive: 30, negative: 30, neutral: 40 } → 0
```

### Per-Speaker Sentiment (Derived)

Since the API doesn't provide per-speaker sentiment, we derive it from sentence-level signals:

```typescript
function analyzeSpeakerSentiment(transcript: Transcript): SpeakerSentiment[] {
  // Group sentences by speaker
  // For each speaker:
  //   - Count questions (often neutral)
  //   - Look for sentiment keywords (basic heuristic)
  //   - Weight by talk time
  //
  // Note: This is approximate. Document limitations.
}
```

**Limitation:** Per-speaker sentiment is heuristic-based since the API doesn't provide it. Document this clearly.

---

## Orchestration Strategy (Swarm Pattern)

```
┌─────────────────────────────────────────────────────────────────┐
│                     TEAM: sentiment-analysis                     │
└─────────────────────────────────────────────────────────────────┘

Phase 1: Core Helpers (Parallel, Independent)
┌──────────────────────┐  ┌──────────────────────┐
│ single-agent         │  │ aggregate-agent      │
│ (general-purpose)    │  │ (general-purpose)    │
│                      │  │                      │
│ - analyzeSentiment() │  │ - aggregateSentiment │
│ - Per-speaker calc   │  │ - Period grouping    │
│ - Score calculation  │  │ - Trend detection    │
│ - Unit tests (TDD)   │  │ - Unit tests (TDD)   │
└──────────┬───────────┘  └──────────┬───────────┘
           │                         │
           └────────────┬────────────┘
                        ▼
Phase 2: SDK + CLI (Parallel, after Phase 1)
┌──────────────────────┐  ┌──────────────────────┐
│ sdk-agent            │  │ cli-agent            │
│ (general-purpose)    │  │ (general-purpose)    │
│                      │  │                      │
│ - sentimentInsights  │  │ - sentiment command  │
│   method             │  │ - All filter options │
│ - Uses helpers       │  │ - Plain/table output │
└──────────┬───────────┘  └──────────┬───────────┘
           │                         │
           └────────────┬────────────┘
                        ▼
Phase 3: Testing + Polish
┌──────────────────────────────────────┐
│ test-agent (general-purpose)         │
│                                      │
│ - Integration tests                  │
│ - Live E2E with real data            │
│ - Edge cases (no sentiment data)     │
└──────────────────────────────────────┘
```

### Task Definitions

```javascript
// Phase 1: Parallel helper implementation
TaskCreate({
  subject: "Implement single-transcript sentiment analysis",
  description: `
    Create src/helpers/sentiment-analytics.ts with:
    - analyzeSentiment(transcript) function
    - calculateSentimentScore() helper
    - Per-speaker sentiment derivation (heuristic)
    - Types in src/types/sentiment.ts

    TDD: Write failing tests first in test/unit/sentiment-analytics.test.ts
    Test cases:
    - Transcript with sentiment data
    - Transcript without sentiment data (graceful handling)
    - Score calculation edge cases
  `,
  activeForm: "Implementing sentiment analysis..."
})

TaskCreate({
  subject: "Implement sentiment aggregation across meetings",
  description: `
    Add to src/helpers/sentiment-analytics.ts:
    - aggregateSentiment(transcripts[]) function
    - Period grouping (day/week/month)
    - Find most positive/negative meetings
    - Trend calculation

    TDD: Write tests for aggregation logic
  `,
  activeForm: "Implementing sentiment aggregation..."
})

// Phase 2: SDK and CLI (blocked by Phase 1)
TaskCreate({
  subject: "Add sentimentInsights SDK method",
  description: `
    Add to client.transcripts:
    - sentimentInsights(params) method
    - Fetches transcripts with summary
    - Calls aggregateSentiment helper
    - Returns SentimentInsights
  `,
  activeForm: "Adding SDK method..."
})

TaskCreate({
  subject: "Implement sentiment CLI command",
  description: `
    Create src/cli/commands/sentiment.ts:
    - fireflies sentiment <id> for single transcript
    - fireflies sentiment --last-week for aggregate
    - --group-by option for trends
    - --speaker filter
    - Plain and table output formats
  `,
  activeForm: "Implementing CLI..."
})
```

---

## CLI Output Examples

### Single Transcript

```bash
$ fireflies sentiment abc123

Sentiment Analysis: "Weekly Team Standup"
==========================================

Overall Sentiment:
  Positive: 65%  ████████████░░░░░░░░
  Neutral:  25%  █████░░░░░░░░░░░░░░░
  Negative: 10%  ██░░░░░░░░░░░░░░░░░░

  Score: +55 (Positive)

By Speaker:
  Speaker          Positive  Neutral  Negative  Score
  ─────────────────────────────────────────────────────
  Sarah            72%       20%      8%        +64
  John             58%       30%      12%       +46
  External Guest   45%       35%      20%       +25
```

### Aggregate with Trends

```bash
$ fireflies sentiment --last-month --group-by week

Sentiment Insights: Jan 1 - Jan 31, 2024
==========================================

Overall: +42 (Positive) across 23 meetings

Weekly Trend:
  Week    Meetings  Positive  Negative  Score
  ─────────────────────────────────────────────
  W01     5         62%       15%       +47
  W02     6         58%       18%       +40
  W03     7         55%       20%       +35   ↓
  W04     5         68%       12%       +56   ↑

Top Speakers:
  1. Sarah Chen      +62 (12 meetings)
  2. John Smith      +45 (18 meetings)
  3. Client: Acme    +38 (4 meetings)

Most Positive: "Project Kickoff" (+78)
Most Negative: "Budget Review" (-12)
```

---

## Test Plan

### Unit Tests (TDD)

**sentiment-analytics.test.ts:**
- Score calculation: various percentage combinations
- Single transcript analysis with/without sentiment
- Per-speaker derivation (mock sentences)
- Aggregation across multiple transcripts
- Period grouping (day/week/month)
- Edge cases: empty transcripts, missing data

### Live E2E Tests

```typescript
describe('sentiment (live)', () => {
  it('analyzes sentiment for single transcript', async () => {
    const transcripts = await client.transcripts.list({ limit: 1 });
    const transcript = await client.transcripts.get(transcripts[0].id);

    const sentiment = analyzeSentiment(transcript);

    expect(sentiment.sentimentScore).toBeGreaterThanOrEqual(-100);
    expect(sentiment.sentimentScore).toBeLessThanOrEqual(100);
  });

  it('aggregates sentiment across meetings', async () => {
    const insights = await client.transcripts.sentimentInsights({
      limit: 5,
    });

    expect(insights.totalMeetings).toBeLessThanOrEqual(5);
    expect(insights.overall).toBeDefined();
  });
});
```

---

## Acceptance Criteria

- [ ] `analyzeSentiment(transcript)` returns correct analysis
- [ ] `sentimentInsights()` aggregates across meetings
- [ ] `--group-by` shows trends over time
- [ ] `--speaker` filters to specific speakers
- [ ] `fireflies sentiment` CLI works in all modes
- [ ] Graceful handling when sentiment data missing
- [ ] Score calculation documented and tested
- [ ] All tests pass
- [ ] Exported from `src/index.ts`

---

## Limitations (Document Clearly)

1. **Per-speaker sentiment is heuristic** - Fireflies API doesn't provide this, so we derive approximations
2. **Sentiment data availability** - Not all transcripts have sentiment processed
3. **Cultural/language bias** - Sentiment detection may vary by language/context

---

## Non-Goals / Out of Scope

This feature explicitly does NOT:
- Perform sentiment analysis on raw text (uses Fireflies API data only)
- Provide sentence-level sentiment (meeting-level only from API)
- Support custom sentiment models or training
- Predict future sentiment trends
- Compare sentiment across different organizations/teams
- Provide sentiment alerts or notifications
- Support real-time sentiment during live meetings

---

## Dependencies (Existing Code to Reuse)

| Existing Code | Usage |
|---------------|-------|
| `src/types/transcript.ts` | Existing `Sentiments` interface |
| `src/helpers/batch.ts` | `batch()` for concurrent transcript fetching |
| `src/helpers/pagination.ts` | `paginateAll()` for listing |
| `src/helpers/speaker-analytics.ts` | Pattern for per-speaker analysis |
| `src/helpers/meeting-insights.ts` | Pattern for aggregation |
| `src/cli/utils/dates.ts` | Date parsing and period handling |
| `src/cli/utils/progress.ts` | Progress indicators |

---

## Default Values Table

| Option | Default | Description |
|--------|---------|-------------|
| `groupBy` | `'none'` | No period grouping |
| `speakers` | `undefined` | All speakers |
| `fromDate` | `undefined` | No lower bound |
| `toDate` | `undefined` | No upper bound |
| `limit` | `50` | Max transcripts to analyze |
| `concurrency` | `3` | Parallel transcript fetches |

---

## Changelog Entry

```markdown
### Added
- `analyzeSentiment()` helper for single transcript sentiment analysis
- `client.transcripts.sentimentInsights()` for aggregated sentiment across meetings
- `fireflies sentiment` CLI command with trend visualization
- `SentimentAnalytics`, `SentimentInsights`, `SpeakerSentiment` types
```

---

## Implementation Checklist (per CLAUDE.md)

### Step 1: Identify Layers
- [ ] Helpers needed: `analyzeSentiment()`, `calculateSentimentScore()`, `aggregateSentiment()`
- [ ] SDK method: `client.transcripts.sentimentInsights()`
- [ ] CLI command: `fireflies sentiment`

### Step 2: Implement Helpers (TDD)
- [ ] Create `test/unit/sentiment-analytics.test.ts`
- [ ] Write failing tests for `calculateSentimentScore()`
- [ ] Implement score calculation
- [ ] Write failing tests for `analyzeSentiment()`
- [ ] Implement single transcript analysis
- [ ] Write failing tests for `aggregateSentiment()`
- [ ] Implement aggregation across transcripts
- [ ] All tests pass

### Step 3: Implement SDK Method
- [ ] Create `src/types/sentiment.ts`
- [ ] Add `sentimentInsights()` to transcripts queries
- [ ] Export types from `src/index.ts`

### Step 4: Implement CLI
- [ ] Create `src/cli/commands/sentiment.ts`
- [ ] Register in `src/cli/index.ts`
- [ ] Add `--group-by` and `--speaker` options
- [ ] Implement table and plain output formats

### Step 5: Verification
- [ ] `npm run build` succeeds
- [ ] `npm run typecheck` passes
- [ ] `npm run check` passes
- [ ] `npm test` passes
- [ ] Manual CLI test with real data

---

## Error Handling

```typescript
// Error scenarios:
// - Transcript has no sentiment data → return null/undefined for that field
// - All transcripts lack sentiment → return { overall: null, ... } with warning
// - Single transcript fetch fails in aggregate → skip, continue, log warning
// - Empty date range → return empty results, not error

// Graceful degradation pattern:
function analyzeSentiment(transcript: Transcript): SentimentAnalytics | null {
  if (!transcript.summary?.sentiments) {
    return null;  // Not an error, just no data
  }
  // ... analysis
}
```

---

## Rate Limiting

- Aggregation fetches multiple transcripts - use `batch()` helper
- Default delay between fetches: 100ms
- For `sentimentInsights()`, fetch list first (1 call), then details in batch

---

## CLI Registration

Update `src/cli/index.ts`:
```typescript
import { registerSentimentCommand } from './commands/sentiment.js';

registerSentimentCommand(program);  // ADD THIS
```

---

## Types Location

Create `src/types/sentiment.ts`:
```typescript
export interface SentimentAnalytics {
  overall: Sentiments | null;
  bySpeaker: SpeakerSentiment[];
  dominantSentiment: 'positive' | 'negative' | 'neutral' | null;
  sentimentScore: number | null;
}

export interface SpeakerSentiment {
  speakerName: string;
  sentiments: Sentiments;
  sentimentScore: number;
  sentenceCount: number;
}

export interface SentimentInsights {
  // ... as defined in SDK API section
}

export interface PeriodSentiment {
  // ... as defined in SDK API section
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
// CLI uses withProgress for aggregate sentiment
const insights = await withProgress(
  { enabled: showProgress, text: 'Analyzing sentiment...' },
  async (update) => {
    // Update as transcripts are processed
    return client.transcripts.sentimentInsights(params, {
      onProgress: (completed, total) => {
        update(`Analyzing sentiment... ${completed}/${total}`);
      },
    });
  }
);
```

---

## Backward Compatibility

- `analyzeSentiment()` is a new function - no breaking changes
- `sentimentInsights()` is a new SDK method - no breaking changes
- Existing `Sentiments` type in `transcript.ts` is reused, not modified

---

## Test Fixtures

Create test fixtures in `test/fixtures/sentiment/`:
- `transcript-positive.json` - Transcript with high positive sentiment
- `transcript-negative.json` - Transcript with high negative sentiment
- `transcript-neutral.json` - Transcript with mostly neutral sentiment
- `transcript-no-sentiment.json` - Transcript without sentiment data
- `transcripts-week.json` - Array of transcripts for aggregation tests
- `expected-insights.json` - Expected aggregated insights output

---

## JSDoc Requirements

All public functions must have JSDoc:
```typescript
/**
 * Analyze sentiment for a single transcript.
 *
 * @param transcript - Transcript to analyze
 * @returns Sentiment analytics including overall score and per-speaker breakdown,
 *          or null if transcript has no sentiment data
 *
 * @example
 * ```typescript
 * const sentiment = analyzeSentiment(transcript);
 * if (sentiment) {
 *   console.log(`Score: ${sentiment.sentimentScore}`);
 *   console.log(`Dominant: ${sentiment.dominantSentiment}`);
 * }
 * ```
 */
export function analyzeSentiment(transcript: Transcript): SentimentAnalytics | null;

/**
 * Calculate composite sentiment score from percentages.
 *
 * @param sentiments - Sentiment percentages (positive, negative, neutral)
 * @returns Score from -100 (all negative) to +100 (all positive)
 *
 * @example
 * ```typescript
 * const score = calculateSentimentScore({ positive: 70, negative: 10, neutral: 20 });
 * // Returns: 60
 * ```
 */
export function calculateSentimentScore(sentiments: Sentiments): number;

/**
 * Get aggregated sentiment insights across multiple meetings.
 *
 * @param params - Query parameters including date range and grouping
 * @returns Aggregated insights with trends and extremes
 *
 * @example
 * ```typescript
 * const insights = await client.transcripts.sentimentInsights({
 *   fromDate: '2024-01-01',
 *   toDate: '2024-01-31',
 *   groupBy: 'week',
 * });
 * console.log(`Overall score: ${insights.sentimentScore}`);
 * ```
 */
```

---

## Code Patterns to Follow

Based on existing codebase patterns:

```typescript
// 1. Reuse existing Sentiments type from transcript.ts
import type { Sentiments } from '../types/transcript.js';

// 2. Null-safe access pattern for optional sentiment data
function analyzeSentiment(transcript: Transcript): SentimentAnalytics | null {
  const sentiments = transcript.summary?.sentiments;
  if (!sentiments) {
    return null;  // Not an error, just no data
  }
  // ... analysis
}

// 3. Score calculation as pure function
export function calculateSentimentScore(sentiments: Sentiments): number {
  // Score = positive% - negative%
  return sentiments.positive - sentiments.negative;
}

// 4. Period grouping pattern (similar to meeting-insights.ts)
function groupByPeriod(
  items: Array<{ date: string; score: number }>,
  groupBy: 'day' | 'week' | 'month'
): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  for (const item of items) {
    const key = getPeriodKey(item.date, groupBy);
    const group = groups.get(key) ?? [];
    group.push(item.score);
    groups.set(key, group);
  }
  return groups;
}

// 5. Interface with detailed JSDoc for nullable fields
export interface SentimentAnalytics {
  /** Overall meeting sentiment, null if not available */
  overall: Sentiments | null;
  /** Score from -100 to +100, null if no data */
  sentimentScore: number | null;
  /** Per-speaker breakdown (heuristic-based) */
  bySpeaker: SpeakerSentiment[];
}
```

---

## References

- `src/types/transcript.ts` - Existing Sentiments type
- `src/helpers/meeting-insights.ts` - Similar aggregation pattern
- `src/helpers/speaker-analytics.ts` - Per-speaker analysis pattern
- `src/cli/utils/progress.ts` - Progress indicators
