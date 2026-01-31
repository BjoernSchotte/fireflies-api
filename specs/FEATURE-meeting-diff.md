# Feature Spec: Meeting Diff/Comparison Tool

## Overview

Compare two transcripts to identify differences in topics, action items, and decisions - useful for recurring meetings like weekly standups or project check-ins.

**Priority:** Medium
**Complexity:** Medium-High
**Swarm Applicable:** Yes - 4 parallel work streams

---

## Problem Statement

For recurring meetings (weekly standups, sprint reviews, client check-ins), users want to:
- See what's new vs. what was discussed before
- Track progress on action items between meetings
- Identify emerging topics or concerns
- Compare meeting dynamics (participation, sentiment)

Currently, there's no way to compare transcripts programmatically.

---

## Proposed Solution

### SDK API

```typescript
// New helper: src/helpers/transcript-diff.ts
import { diffTranscripts, type TranscriptDiff } from 'fireflies-api';

const diff = diffTranscripts(transcript1, transcript2);

interface TranscriptDiff {
  // Metadata comparison
  metadata: {
    durationChange: number;      // Minutes difference
    participantChanges: {
      added: string[];
      removed: string[];
      common: string[];
    };
  };

  // Topic/keyword analysis
  topics: {
    newTopics: string[];         // In t2 but not t1
    removedTopics: string[];     // In t1 but not t2
    commonTopics: string[];
    topicOverlap: number;        // 0-100%
  };

  // Action items comparison
  actionItems: {
    newItems: string[];          // New in t2
    completedItems: string[];    // In t1, resolved/not in t2
    carryoverItems: string[];    // Still present in t2
    completionRate: number;      // % of t1 items resolved
  };

  // Speaker participation changes
  speakers: {
    speakerName: string;
    talkTimeChange: number;      // Percentage points
    sentimentChange: number;     // Score change
  }[];

  // Summary
  overallSimilarity: number;     // 0-100%
  summary: string;               // AI-generated or template summary
}
```

### CLI Command

```bash
# Compare two specific transcripts
fireflies diff <id1> <id2>

# Compare most recent with previous (same title pattern)
fireflies diff <id> --with-previous

# Output formats
fireflies diff <id1> <id2> -o json
fireflies diff <id1> <id2> -o plain   # Human-readable report

# Focus on specific aspects
fireflies diff <id1> <id2> --topics-only
fireflies diff <id1> <id2> --action-items-only
fireflies diff <id1> <id2> --speakers-only
```

---

## Technical Design

### Files to Create/Modify

| File | Description |
|------|-------------|
| `src/helpers/transcript-diff.ts` | Core diff logic |
| `src/helpers/topic-extraction.ts` | Extract topics from keywords/summary |
| `src/helpers/text-similarity.ts` | Text comparison utilities |
| `src/cli/commands/diff.ts` | CLI command handler |
| `test/unit/transcript-diff.test.ts` | Unit tests |
| `test/unit/topic-extraction.test.ts` | Topic extraction tests |

### Topic Extraction

```typescript
// src/helpers/topic-extraction.ts

/**
 * Extract topics from transcript summary and keywords.
 * Combines multiple sources for better coverage.
 */
export function extractTopics(transcript: Transcript): string[] {
  const topics = new Set<string>();

  // From summary keywords
  if (transcript.summary?.keywords) {
    for (const kw of transcript.summary.keywords) {
      topics.add(normalizeKeyword(kw));
    }
  }

  // From summary sections (overview, key points)
  if (transcript.summary?.overview) {
    // Extract noun phrases or key terms
    extractKeyTerms(transcript.summary.overview).forEach(t => topics.add(t));
  }

  return Array.from(topics);
}
```

### Text Similarity

```typescript
// src/helpers/text-similarity.ts

/**
 * Calculate Jaccard similarity between two sets.
 */
export function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Find items that appear similar using fuzzy matching.
 */
export function findSimilarItems(
  items1: string[],
  items2: string[],
  threshold = 0.8
): Array<{ item1: string; item2: string; similarity: number }> {
  // Use Levenshtein distance or similar
}
```

### Action Item Comparison

```typescript
/**
 * Compare action items between two transcripts.
 * Uses fuzzy matching since exact text may differ.
 */
export function compareActionItems(
  t1: Transcript,
  t2: Transcript
): ActionItemComparison {
  const items1 = extractActionItems(t1);
  const items2 = extractActionItems(t2);

  // Match similar items across transcripts
  // Items in t1 not matched in t2 = "completed" (optimistic)
  // Items in t2 not matched in t1 = "new"
  // Matched items = "carryover"
}
```

---

## Orchestration Strategy (Swarm Pattern)

```
┌─────────────────────────────────────────────────────────────────┐
│                     TEAM: meeting-diff                           │
└─────────────────────────────────────────────────────────────────┘

Phase 1: Utility Helpers (Parallel, Independent)
┌──────────────────────┐  ┌──────────────────────┐
│ topic-agent          │  │ similarity-agent     │
│ (general-purpose)    │  │ (general-purpose)    │
│                      │  │                      │
│ - extractTopics()    │  │ - jaccardSimilarity  │
│ - normalizeKeyword   │  │ - findSimilarItems   │
│ - extractKeyTerms    │  │ - Levenshtein dist   │
│ - Unit tests (TDD)   │  │ - Unit tests (TDD)   │
└──────────┬───────────┘  └──────────┬───────────┘
           │                         │
           └────────────┬────────────┘
                        ▼
Phase 2: Core Diff Logic (blocked by Phase 1)
┌──────────────────────────────────────┐
│ diff-agent (general-purpose)         │
│                                      │
│ - diffTranscripts() main function    │
│ - Metadata comparison                │
│ - Topic diff using extractTopics     │
│ - Action item comparison             │
│ - Speaker participation changes      │
│ - Overall similarity calculation     │
│ - Unit tests (TDD)                   │
└──────────────────┬───────────────────┘
                   ▼
Phase 3: CLI + Tests (Parallel)
┌──────────────────────┐  ┌──────────────────────┐
│ cli-agent            │  │ test-agent           │
│ (general-purpose)    │  │ (general-purpose)    │
│                      │  │                      │
│ - diff command       │  │ - Integration tests  │
│ - --with-previous    │  │ - Live E2E tests     │
│ - Output formatting  │  │ - Edge cases         │
│ - Focus flags        │  │                      │
└──────────────────────┘  └──────────────────────┘
```

### Task Definitions

```javascript
// Phase 1: Parallel utility helpers
TaskCreate({
  subject: "Implement topic extraction helper",
  description: `
    Create src/helpers/topic-extraction.ts:
    - extractTopics(transcript) - combine keywords + summary terms
    - normalizeKeyword() - lowercase, trim, standardize
    - extractKeyTerms(text) - extract noun phrases/key terms

    TDD: Write tests first for each function
    Consider: compound terms, abbreviations, synonyms
  `,
  activeForm: "Implementing topic extraction..."
})

TaskCreate({
  subject: "Implement text similarity utilities",
  description: `
    Create src/helpers/text-similarity.ts:
    - jaccardSimilarity(set1, set2) - set overlap
    - levenshteinDistance(s1, s2) - edit distance
    - findSimilarItems(items1, items2, threshold) - fuzzy matching

    TDD: Write comprehensive tests
    No external dependencies - implement from scratch
  `,
  activeForm: "Implementing similarity utils..."
})

// Phase 2: Core diff (blocked by Phase 1)
TaskCreate({
  subject: "Implement transcript diff logic",
  description: `
    Create src/helpers/transcript-diff.ts:
    - diffTranscripts(t1, t2) main function
    - Uses topic-extraction and text-similarity helpers
    - Compare metadata, topics, action items, speakers
    - Calculate overall similarity score

    TDD: Create test fixtures with known diffs
  `,
  activeForm: "Implementing diff logic..."
})

// Phase 3: CLI and testing
TaskCreate({
  subject: "Implement diff CLI command",
  description: `
    Create src/cli/commands/diff.ts:
    - fireflies diff <id1> <id2>
    - --with-previous flag (find similar title)
    - Focus flags: --topics-only, --action-items-only
    - Plain and JSON output formats
  `,
  activeForm: "Implementing CLI..."
})
```

---

## CLI Output Example

```bash
$ fireflies diff abc123 def456

Transcript Comparison
═══════════════════════════════════════════════════════════════

Meeting 1: "Weekly Standup - Jan 8" (45 min)
Meeting 2: "Weekly Standup - Jan 15" (52 min)

Overall Similarity: 65%

─── Topics ────────────────────────────────────────────────────
New Topics:        budget constraints, Q2 planning, hiring freeze
Removed Topics:    holiday schedule, year-end review
Common Topics:     sprint progress, blockers, client feedback

─── Action Items ──────────────────────────────────────────────
✓ Completed (3):
  • "Review Q4 metrics" - was assigned to Sarah
  • "Update project timeline" - was assigned to John
  • "Send client proposal" - was assigned to Mike

→ Carried Over (2):
  • "Fix login bug" - still assigned to Dev Team
  • "Prepare demo" - still assigned to Sarah

+ New Items (4):
  • "Draft Q2 budget proposal" - assigned to Finance
  • "Schedule hiring meeting" - assigned to HR
  • "Update roadmap" - assigned to Product
  • "Review contractor agreements" - assigned to Legal

Completion Rate: 60% (3 of 5 items from Meeting 1)

─── Participation Changes ─────────────────────────────────────
Speaker          Talk Time Change    Sentiment Change
─────────────────────────────────────────────────────────────
Sarah            +12%                +8 pts
John             -5%                 -3 pts
New: Finance     +15%                (new participant)
Left: HR Rep     -8%                 (not present)
```

---

## Test Plan

### Unit Tests (TDD)

**topic-extraction.test.ts:**
- Extract from keywords array
- Extract from summary text
- Handle empty/missing data
- Normalize variations ("AI", "A.I.", "ai" → "ai")

**text-similarity.test.ts:**
- Jaccard similarity edge cases (empty sets, identical, disjoint)
- Levenshtein distance known values
- Fuzzy matching threshold behavior

**transcript-diff.test.ts:**
- Identical transcripts → 100% similarity
- Completely different → low similarity
- Partial overlap calculation
- Action item completion detection

### Live E2E Tests

```typescript
describe('transcript diff (live)', () => {
  it('compares two transcripts', async () => {
    const transcripts = await client.transcripts.list({ limit: 2 });
    if (transcripts.length < 2) return;

    const t1 = await client.transcripts.get(transcripts[0].id);
    const t2 = await client.transcripts.get(transcripts[1].id);

    const diff = diffTranscripts(t1, t2);

    expect(diff.overallSimilarity).toBeGreaterThanOrEqual(0);
    expect(diff.overallSimilarity).toBeLessThanOrEqual(100);
  });
});
```

---

## Acceptance Criteria

- [ ] `diffTranscripts(t1, t2)` returns complete comparison
- [ ] Topic extraction works with various summary formats
- [ ] Action item comparison uses fuzzy matching
- [ ] Speaker participation changes calculated correctly
- [ ] `fireflies diff` CLI command works
- [ ] `--with-previous` finds matching previous meeting
- [ ] Focus flags filter output appropriately
- [ ] Plain output is human-readable
- [ ] All tests pass
- [ ] Exported from `src/index.ts`

---

## Future Enhancements

1. **Series comparison** - Compare across 3+ recurring meetings
2. **Trend visualization** - Show how topics evolve over time
3. **Automatic pairing** - Find related meetings by title pattern
4. **AI summary** - Generate natural language diff summary

---

## Non-Goals / Out of Scope

This feature explicitly does NOT:
- Compare more than 2 transcripts at once (use series comparison for that)
- Perform semantic/meaning-based comparison (uses keyword/text matching)
- Modify either transcript
- Store or cache comparison results
- Detect speaker identity across meetings (different feature)
- Compare audio/video content
- Generate AI-written summaries (template-based only)

---

## Dependencies (Existing Code to Reuse)

| Existing Code | Usage |
|---------------|-------|
| `src/helpers/action-items.ts` | `extractActionItems()` for item comparison |
| `src/helpers/speaker-analytics.ts` | Speaker analysis patterns |
| `src/types/transcript.ts` | Transcript, Speaker types |
| `src/cli/utils/progress.ts` | Progress for `--with-previous` |
| `src/cli/utils/dates.ts` | Date formatting |

**New utilities to create:**
- `src/helpers/text-similarity.ts` - Jaccard, Levenshtein
- `src/helpers/topic-extraction.ts` - Keyword extraction

---

## Default Values Table

| Option | Default | Description |
|--------|---------|-------------|
| `fuzzyThreshold` | `0.8` | Action item matching threshold |
| `topicLimit` | `20` | Max topics to extract per transcript |
| `--with-previous` | `false` | Find previous meeting automatically |
| Output format | `'plain'` | Human-readable output |

---

## Changelog Entry

```markdown
### Added
- `diffTranscripts()` helper for comparing two meeting transcripts
- `extractTopics()` and `jaccardSimilarity()` text utilities
- `fireflies diff` CLI command for meeting comparison
- `TranscriptDiff`, `TopicComparison`, `ActionItemComparison` types
```

---

## Implementation Checklist (per CLAUDE.md)

### Step 1: Identify Layers
- [ ] Helpers needed: `extractTopics()`, `jaccardSimilarity()`, `levenshteinDistance()`, `findSimilarItems()`, `diffTranscripts()`
- [ ] SDK method: None (pure helper functions)
- [ ] CLI command: `fireflies diff`

### Step 2: Implement Helpers (TDD) - Phase 1: Utilities
- [ ] Create `test/unit/text-similarity.test.ts`
- [ ] Write failing tests for `jaccardSimilarity()`
- [ ] Implement in `src/helpers/text-similarity.ts`
- [ ] Write failing tests for `levenshteinDistance()`
- [ ] Implement Levenshtein
- [ ] Write failing tests for `findSimilarItems()`
- [ ] Implement fuzzy matching
- [ ] Create `test/unit/topic-extraction.test.ts`
- [ ] Write failing tests for `extractTopics()`
- [ ] Implement in `src/helpers/topic-extraction.ts`

### Step 2b: Implement Core Diff (TDD) - Phase 2
- [ ] Create `test/unit/transcript-diff.test.ts`
- [ ] Write failing tests for `diffTranscripts()`
- [ ] Implement in `src/helpers/transcript-diff.ts`
- [ ] All tests pass

### Step 3: Implement Types
- [ ] Create `src/types/transcript-diff.ts`
- [ ] Export types from `src/index.ts`
- [ ] Export helpers from `src/index.ts`

### Step 4: Implement CLI
- [ ] Create `src/cli/commands/diff.ts`
- [ ] Register in `src/cli/index.ts`
- [ ] Implement `--with-previous` logic
- [ ] Add focus flags (`--topics-only`, etc.)

### Step 5: Verification
- [ ] `npm run build` succeeds
- [ ] `npm run typecheck` passes
- [ ] `npm run check` passes
- [ ] `npm test` passes
- [ ] Manual CLI test with two real transcripts

---

## Error Handling

```typescript
// Error scenarios:
// - One or both transcripts not found → throw NotFoundError
// - Transcript has no summary/keywords → use empty arrays, don't fail
// - --with-previous finds no match → clear error message with suggestions
// - Transcripts are identical → return 100% similarity, not error

// Pattern for missing optional data:
function extractTopics(transcript: Transcript): string[] {
  const topics: string[] = [];
  // Gracefully handle missing data
  if (transcript.summary?.keywords) {
    topics.push(...transcript.summary.keywords);
  }
  return topics;  // May be empty, that's OK
}
```

---

## Rate Limiting

- `diffTranscripts()` is a pure function - no API calls, no rate limiting needed
- `fireflies diff --with-previous` fetches transcript list + 2 transcripts
- Use existing retry logic for fetches

---

## CLI Registration

Update `src/cli/index.ts`:
```typescript
import { registerDiffCommand } from './commands/diff.js';

registerDiffCommand(program);  // ADD THIS
```

---

## Types Location

Create `src/types/transcript-diff.ts`:
```typescript
export interface TranscriptDiff {
  metadata: MetadataComparison;
  topics: TopicComparison;
  actionItems: ActionItemComparison;
  speakers: SpeakerComparison[];
  overallSimilarity: number;
  summary: string;
}

export interface MetadataComparison {
  durationChange: number;
  participantChanges: {
    added: string[];
    removed: string[];
    common: string[];
  };
}

// ... other interfaces
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
// For --with-previous, show progress while searching
await withProgress(
  { enabled: showProgress, text: 'Finding previous meeting...' },
  async (update) => {
    update('Fetching transcript list...');
    // ... find matching previous
    update('Comparing transcripts...');
    // ... diff
  }
);
```

---

## Test Fixtures

Create test fixtures in `test/fixtures/diff/`:
- `transcript-a.json` - Base transcript
- `transcript-b-similar.json` - 70% similar to A
- `transcript-c-different.json` - Completely different
- `transcript-d-identical.json` - Clone of A

---

## Backward Compatibility

- All new functions - no breaking changes
- `diffTranscripts()` is pure helper, doesn't modify transcripts
- No changes to existing types

---

## JSDoc Requirements

All public functions must have JSDoc:
```typescript
/**
 * Compare two transcripts to identify differences.
 *
 * @param transcript1 - First (earlier) transcript
 * @param transcript2 - Second (later) transcript
 * @returns Detailed comparison including topics, action items, and speakers
 *
 * @example
 * ```typescript
 * const diff = diffTranscripts(lastWeek, thisWeek);
 * console.log(`Overall similarity: ${diff.overallSimilarity}%`);
 * console.log(`New topics: ${diff.topics.newTopics.join(', ')}`);
 * console.log(`Completed items: ${diff.actionItems.completedItems.length}`);
 * ```
 */
export function diffTranscripts(
  transcript1: Transcript,
  transcript2: Transcript
): TranscriptDiff;

/**
 * Extract topics from transcript summary and keywords.
 *
 * @param transcript - Transcript to extract topics from
 * @returns Array of normalized topic strings
 *
 * @example
 * ```typescript
 * const topics = extractTopics(transcript);
 * // Returns: ['budget', 'timeline', 'client feedback']
 * ```
 */
export function extractTopics(transcript: Transcript): string[];

/**
 * Calculate Jaccard similarity between two sets.
 *
 * @param set1 - First set
 * @param set2 - Second set
 * @returns Similarity score from 0 (disjoint) to 1 (identical)
 *
 * @example
 * ```typescript
 * const similarity = jaccardSimilarity(
 *   new Set(['a', 'b', 'c']),
 *   new Set(['b', 'c', 'd'])
 * );
 * // Returns: 0.5 (2 common / 4 total)
 * ```
 */
export function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number;
```

---

## Code Patterns to Follow

Based on existing codebase patterns:

```typescript
// 1. Pure function - no side effects, no API calls
export function diffTranscripts(
  transcript1: Transcript,
  transcript2: Transcript
): TranscriptDiff {
  // Pure computation only
}

// 2. Set operations for topic comparison
function compareTopics(t1Topics: string[], t2Topics: string[]): TopicComparison {
  const set1 = new Set(t1Topics);
  const set2 = new Set(t2Topics);

  return {
    newTopics: t2Topics.filter(t => !set1.has(t)),
    removedTopics: t1Topics.filter(t => !set2.has(t)),
    commonTopics: t1Topics.filter(t => set2.has(t)),
    topicOverlap: jaccardSimilarity(set1, set2) * 100,
  };
}

// 3. Levenshtein implementation (no external deps)
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length, n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  // ... standard DP implementation
}

// 4. Fuzzy matching with threshold
export function findSimilarItems(
  items1: string[],
  items2: string[],
  threshold = 0.8
): Array<{ item1: string; item2: string; similarity: number }> {
  const matches: Array<{ item1: string; item2: string; similarity: number }> = [];
  // Only return matches above threshold
}

// 5. Graceful handling of missing optional data
function extractTopics(transcript: Transcript): string[] {
  const topics: string[] = [];
  if (transcript.summary?.keywords) {
    topics.push(...transcript.summary.keywords.map(normalizeKeyword));
  }
  return topics;  // May be empty, that's OK
}
```

---

## References

- `src/helpers/action-items.ts` - Action item extraction
- `src/helpers/speaker-analytics.ts` - Speaker analysis patterns
- `src/types/transcript.ts` - Transcript structure
- `src/cli/utils/progress.ts` - Progress indicators
