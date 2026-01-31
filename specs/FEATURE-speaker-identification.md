# Feature Spec: Speaker Identification Improvements

## Overview

Improve speaker identification with fuzzy name matching, email linking, and cross-meeting speaker profiles.

**Priority:** Medium
**Complexity:** Medium
**Swarm Applicable:** Yes - 4 parallel work streams

---

## Problem Statement

Current speaker identification has several limitations:

1. **Name variations** - "John", "John Smith", "J. Smith" are treated as different speakers
2. **No email linking** - Speakers aren't linked to participant emails
3. **Cross-meeting inconsistency** - Same person may have different speaker names across meetings
4. **Manual merging** - Current `mergeSpeakersByName` only does exact matching

Users want to:
- See consistent speaker profiles across meetings
- Link speaker voice to participant email
- Get accurate talk time stats for individuals
- Handle name variations automatically

---

## Proposed Solution

### SDK API

```typescript
// Enhanced speaker analytics
import {
  analyzeSpeakers,
  buildSpeakerProfile,
  type SpeakerProfile,
  type SpeakerMatchOptions,
} from 'fireflies-api';

// Single transcript with improved merging
const analytics = analyzeSpeakers(transcript, {
  mergeSpeakersByName: true,
  fuzzyMatch: true,           // NEW: Enable fuzzy matching
  fuzzyThreshold: 0.85,       // NEW: Similarity threshold
  linkToParticipants: true,   // NEW: Match to participant emails
});

// Cross-meeting speaker profile
const profile = await buildSpeakerProfile(client, {
  speakerName: 'John Smith',  // Or email
  fromDate: '2024-01-01',
  toDate: '2024-01-31',
  fuzzyMatch: true,
});

interface SpeakerProfile {
  // Identity
  primaryName: string;
  alternateNames: string[];   // Variations found
  linkedEmail?: string;       // If matched to participant

  // Aggregated stats
  totalMeetings: number;
  totalTalkTime: number;      // seconds
  averageTalkTimePercent: number;

  // Meeting breakdown
  meetings: Array<{
    id: string;
    title: string;
    date: string;
    talkTime: number;
    talkPercent: number;
    speakerNameUsed: string;  // Name in this meeting
  }>;

  // Patterns
  patterns: {
    mostActiveDays: string[];
    averageSentencesPerMeeting: number;
    questionRate: number;     // % of utterances that are questions
  };
}

// Merge speakers across transcript
interface MergeSpeakersOptions {
  strategy: 'exact' | 'fuzzy' | 'smart';
  threshold?: number;         // For fuzzy (0-1)
  customMappings?: Record<string, string>;  // Manual overrides
}

const mergedTranscript = mergeSpeakers(transcript, {
  strategy: 'smart',
  customMappings: {
    'J. Smith': 'John Smith',
    'External Guest': 'Client: Acme',
  },
});
```

### CLI Commands

```bash
# Analyze speakers with fuzzy matching
fireflies transcripts speakers <id> --fuzzy
fireflies transcripts speakers <id> --fuzzy-threshold 0.8

# Build speaker profile across meetings
fireflies speakers profile "John Smith" --last-month
fireflies speakers profile --email john@company.com --last-month

# List all unique speakers
fireflies speakers list --last-month
fireflies speakers list --last-month --min-meetings 3  # At least 3 meetings

# Merge similar speaker names (show suggestions)
fireflies speakers suggest-merges <id>
fireflies speakers suggest-merges <id> --apply  # Actually merge
```

---

## Technical Design

### Files to Create/Modify

| File | Description |
|------|-------------|
| `src/helpers/fuzzy-match.ts` | Fuzzy string matching utilities |
| `src/helpers/speaker-linking.ts` | Link speakers to participants |
| `src/helpers/speaker-profile.ts` | Cross-meeting profile building |
| `src/helpers/speaker-analytics.ts` | Enhance existing (add fuzzy) |
| `src/cli/commands/speakers.ts` | New CLI command group |
| `test/unit/fuzzy-match.test.ts` | Fuzzy matching tests |
| `test/unit/speaker-linking.test.ts` | Linking tests |
| `test/unit/speaker-profile.test.ts` | Profile tests |

### Fuzzy Matching Algorithm

```typescript
// src/helpers/fuzzy-match.ts

/**
 * Calculate similarity between two names using multiple strategies.
 */
export function nameSimilarity(name1: string, name2: string): number {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);

  // Strategy 1: Exact match after normalization
  if (n1 === n2) return 1.0;

  // Strategy 2: One is substring of other
  if (n1.includes(n2) || n2.includes(n1)) return 0.9;

  // Strategy 3: Same initials + last name
  if (sameInitialsAndLastName(n1, n2)) return 0.85;

  // Strategy 4: Levenshtein distance
  const levenshtein = 1 - (levenshteinDistance(n1, n2) / Math.max(n1.length, n2.length));

  // Strategy 5: Token overlap (for multi-word names)
  const tokenOverlap = jaccardSimilarity(
    new Set(n1.split(' ')),
    new Set(n2.split(' '))
  );

  // Weighted combination
  return Math.max(levenshtein * 0.6 + tokenOverlap * 0.4, levenshtein, tokenOverlap);
}

/**
 * Normalize name for comparison.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z\s]/g, '')  // Remove punctuation
    .replace(/\s+/g, ' ');      // Normalize whitespace
}

/**
 * Find potential matches for a speaker name.
 */
export function findSimilarSpeakers(
  targetName: string,
  candidates: string[],
  threshold = 0.85
): Array<{ name: string; similarity: number }> {
  return candidates
    .map(name => ({ name, similarity: nameSimilarity(targetName, name) }))
    .filter(m => m.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}
```

### Speaker-Participant Linking

```typescript
// src/helpers/speaker-linking.ts

/**
 * Attempt to link speakers to participant emails.
 * Uses name matching between speaker names and participant display names.
 */
export function linkSpeakersToParticipants(
  speakers: Speaker[],
  participants: MeetingAttendee[]
): Map<string, string> {  // speaker name -> email
  const links = new Map<string, string>();

  for (const speaker of speakers) {
    // Try exact match first
    const exactMatch = participants.find(p =>
      normalizeName(p.displayName) === normalizeName(speaker.name)
    );

    if (exactMatch) {
      links.set(speaker.name, exactMatch.email);
      continue;
    }

    // Try fuzzy match
    const fuzzyMatches = findSimilarSpeakers(
      speaker.name,
      participants.map(p => p.displayName),
      0.8
    );

    if (fuzzyMatches.length === 1) {
      // Only link if unambiguous
      const matched = participants.find(p =>
        normalizeName(p.displayName) === normalizeName(fuzzyMatches[0].name)
      );
      if (matched) {
        links.set(speaker.name, matched.email);
      }
    }
  }

  return links;
}
```

### Cross-Meeting Profile

```typescript
// src/helpers/speaker-profile.ts

export async function buildSpeakerProfile(
  client: FirefliesClient,
  options: SpeakerProfileOptions
): Promise<SpeakerProfile> {
  // 1. Fetch transcripts in date range
  const transcripts = await client.transcripts.list({
    fromDate: options.fromDate,
    toDate: options.toDate,
  });

  // 2. For each transcript, find matching speaker
  const meetings: SpeakerProfile['meetings'] = [];
  const alternateNames = new Set<string>();

  for (const t of transcripts) {
    const full = await client.transcripts.get(t.id);
    const matchedSpeaker = findMatchingSpeaker(
      full.speakers,
      options.speakerName,
      options.fuzzyMatch
    );

    if (matchedSpeaker) {
      alternateNames.add(matchedSpeaker.name);
      meetings.push({
        id: t.id,
        title: t.title,
        date: t.dateString,
        talkTime: matchedSpeaker.talkTime,
        talkPercent: calculateTalkPercent(matchedSpeaker, full),
        speakerNameUsed: matchedSpeaker.name,
      });
    }
  }

  // 3. Aggregate stats
  return {
    primaryName: options.speakerName,
    alternateNames: Array.from(alternateNames),
    linkedEmail: options.email,
    totalMeetings: meetings.length,
    totalTalkTime: meetings.reduce((sum, m) => sum + m.talkTime, 0),
    averageTalkTimePercent: average(meetings.map(m => m.talkPercent)),
    meetings,
    patterns: analyzePatterns(meetings),
  };
}
```

---

## Orchestration Strategy (Swarm Pattern)

```
┌─────────────────────────────────────────────────────────────────┐
│                     TEAM: speaker-identification                 │
└─────────────────────────────────────────────────────────────────┘

Phase 1: Core Utilities (Parallel, Independent)
┌──────────────────────┐  ┌──────────────────────┐
│ fuzzy-agent          │  │ linking-agent        │
│ (general-purpose)    │  │ (general-purpose)    │
│                      │  │                      │
│ - nameSimilarity()   │  │ - linkSpeakers       │
│ - normalizeName()    │  │   ToParticipants()   │
│ - findSimilarSpeakers│  │ - Email matching     │
│ - Unit tests (TDD)   │  │ - Unit tests (TDD)   │
└──────────┬───────────┘  └──────────┬───────────┘
           │                         │
           └────────────┬────────────┘
                        ▼
Phase 2: Profile + Analytics (Parallel, after Phase 1)
┌──────────────────────┐  ┌──────────────────────┐
│ profile-agent        │  │ analytics-agent      │
│ (general-purpose)    │  │ (general-purpose)    │
│                      │  │                      │
│ - buildSpeakerProfile│  │ - Enhance existing   │
│ - Cross-meeting      │  │   analyzeSpeakers()  │
│ - Pattern detection  │  │ - Add fuzzy option   │
│ - Unit tests         │  │ - Add linking option │
└──────────┬───────────┘  └──────────┬───────────┘
           │                         │
           └────────────┬────────────┘
                        ▼
Phase 3: CLI + Integration
┌──────────────────────────────────────┐
│ cli-agent (general-purpose)          │
│                                      │
│ - speakers command group             │
│ - profile subcommand                 │
│ - list subcommand                    │
│ - suggest-merges subcommand          │
│ - Live E2E tests                     │
└──────────────────────────────────────┘
```

### Task Definitions

```javascript
// Phase 1: Parallel utility helpers
TaskCreate({
  subject: "Implement fuzzy name matching",
  description: `
    Create src/helpers/fuzzy-match.ts:
    - nameSimilarity(name1, name2) - multi-strategy comparison
    - normalizeName(name) - standardize for comparison
    - findSimilarSpeakers(target, candidates, threshold)
    - levenshteinDistance(s1, s2) - edit distance

    TDD: Extensive tests for edge cases:
    - "John" vs "John Smith" vs "J. Smith"
    - "Dr. Jane Doe" vs "Jane Doe"
    - Completely different names
    - Empty/null handling
  `,
  activeForm: "Implementing fuzzy matching..."
})

TaskCreate({
  subject: "Implement speaker-participant linking",
  description: `
    Create src/helpers/speaker-linking.ts:
    - linkSpeakersToParticipants(speakers, participants)
    - Match by display name to speaker name
    - Handle ambiguous matches (skip if multiple)
    - Return Map<speakerName, email>

    TDD: Test with various participant/speaker combinations
  `,
  activeForm: "Implementing speaker linking..."
})

// Phase 2: Higher-level features
TaskCreate({
  subject: "Implement cross-meeting speaker profile",
  description: `
    Create src/helpers/speaker-profile.ts:
    - buildSpeakerProfile(client, options)
    - Find speaker across multiple transcripts
    - Aggregate talk time and patterns
    - Track name variations

    Uses fuzzy-match helper from Phase 1
    TDD: Test aggregation logic with fixtures
  `,
  activeForm: "Implementing speaker profile..."
})

TaskCreate({
  subject: "Enhance analyzeSpeakers with fuzzy matching",
  description: `
    Update src/helpers/speaker-analytics.ts:
    - Add fuzzyMatch option to SpeakerAnalyticsOptions
    - Add fuzzyThreshold option
    - Add linkToParticipants option
    - Use fuzzy-match helper for merging
    - Use speaker-linking for email attachment

    Backward compatible - new options default to false
    TDD: Add tests for new options
  `,
  activeForm: "Enhancing speaker analytics..."
})

// Phase 3: CLI
TaskCreate({
  subject: "Implement speakers CLI commands",
  description: `
    Create src/cli/commands/speakers.ts:
    - fireflies speakers profile <name> --last-month
    - fireflies speakers list --last-month
    - fireflies speakers suggest-merges <id>
    - fireflies transcripts speakers <id> --fuzzy

    Update transcripts speakers to add --fuzzy flag
  `,
  activeForm: "Implementing CLI..."
})
```

---

## CLI Output Examples

### Speaker Profile

```bash
$ fireflies speakers profile "John Smith" --last-month

Speaker Profile: John Smith
═══════════════════════════════════════════════════════════════

Identity
  Primary Name:    John Smith
  Alternate Names: John, J. Smith, John S.
  Linked Email:    john.smith@company.com

Stats (Last 30 Days)
  Meetings:        15
  Total Talk Time: 4h 32m
  Avg. Talk %:     28%

Meeting History
  Date        Meeting                          Talk Time  Talk %
  ──────────────────────────────────────────────────────────────
  Jan 14      Weekly Standup                   12m        25%
  Jan 13      Client Review - Acme             28m        35%
  Jan 12      Sprint Planning                  18m        22%
  Jan 11      1:1 with Sarah                   22m        48%
  ... (11 more meetings)

Patterns
  Most Active Days:  Monday, Wednesday
  Avg. Sentences:    45 per meeting
  Question Rate:     12% (asks more questions than average)
```

### Suggest Merges

```bash
$ fireflies speakers suggest-merges abc123

Suggested Speaker Merges for "Weekly Team Standup"
═══════════════════════════════════════════════════════════════

Found 3 potential merges:

1. "J. Smith" → "John Smith" (92% similarity)
   Current talk time: J. Smith (5m), John Smith (12m)
   Merged talk time: 17m (28% of meeting)

2. "Sarah" → "Sarah Chen" (88% similarity)
   Current talk time: Sarah (8m), Sarah Chen (3m)
   Merged talk time: 11m (18% of meeting)

3. "Guest" → "External: Acme Corp" (manual suggestion)
   Note: Generic name, consider manual verification

Apply these merges? Run: fireflies speakers suggest-merges abc123 --apply
```

---

## Test Plan

### Unit Tests (TDD)

**fuzzy-match.test.ts:**
- Exact matches return 1.0
- Substring matches ("John" in "John Smith")
- Initial matching ("J. Smith" ≈ "John Smith")
- Levenshtein distances
- Token overlap for multi-word names
- Threshold filtering
- Edge cases: empty, null, special characters

**speaker-linking.test.ts:**
- Exact name to email linking
- Fuzzy name to email linking
- Ambiguous match handling (skip)
- No match handling
- Case insensitivity

**speaker-profile.test.ts:**
- Aggregation across multiple meetings
- Name variation tracking
- Pattern detection
- Empty results handling

### Live E2E Tests

```typescript
describe('speaker identification (live)', () => {
  it('finds similar speakers with fuzzy matching', async () => {
    const transcripts = await client.transcripts.list({ limit: 1 });
    const transcript = await client.transcripts.get(transcripts[0].id);

    const analytics = analyzeSpeakers(transcript, {
      fuzzyMatch: true,
      fuzzyThreshold: 0.85,
    });

    // Should have fewer or equal speakers after merging
    expect(analytics.speakers.length).toBeLessThanOrEqual(
      transcript.speakers.length
    );
  });

  it('builds speaker profile across meetings', async () => {
    // Get a speaker name from recent transcript
    const transcripts = await client.transcripts.list({ limit: 1 });
    const transcript = await client.transcripts.get(transcripts[0].id);
    const speakerName = transcript.speakers[0]?.name;

    if (!speakerName) return;

    const profile = await buildSpeakerProfile(client, {
      speakerName,
      period: 'last-month',
      fuzzyMatch: true,
    });

    expect(profile.totalMeetings).toBeGreaterThan(0);
    expect(profile.primaryName).toBe(speakerName);
  });
});
```

---

## Acceptance Criteria

- [ ] `nameSimilarity()` handles all name variation patterns
- [ ] `findSimilarSpeakers()` returns ranked matches
- [ ] `linkSpeakersToParticipants()` links correctly
- [ ] `analyzeSpeakers()` supports `fuzzyMatch` option
- [ ] `buildSpeakerProfile()` aggregates cross-meeting data
- [ ] `fireflies speakers profile` CLI works
- [ ] `fireflies speakers list` shows unique speakers
- [ ] `fireflies speakers suggest-merges` shows suggestions
- [ ] Backward compatible (new options default off)
- [ ] All tests pass
- [ ] Exported from `src/index.ts`

---

## Non-Goals / Out of Scope

This feature explicitly does NOT:
- Perform voice recognition/biometrics (name-based only)
- Automatically correct speaker names in transcripts
- Sync with external contact databases
- Support speaker photos/avatars
- Train custom matching models
- Merge speakers permanently (suggestions only, user applies)
- Work across different Fireflies accounts

---

## Dependencies (Existing Code to Reuse)

| Existing Code | Usage |
|---------------|-------|
| `src/helpers/speaker-analytics.ts` | Existing `analyzeSpeakers()` to enhance |
| `src/helpers/batch.ts` | `batch()` for profile building |
| `src/helpers/pagination.ts` | `paginateAll()` for listing |
| `src/types/transcript.ts` | `Speaker`, `MeetingAttendee` types |
| `src/cli/utils/dates.ts` | Period parsing |
| `src/cli/utils/progress.ts` | Progress indicators |

**New utilities to create:**
- `src/helpers/fuzzy-match.ts` - Name similarity algorithms
- `src/helpers/speaker-linking.ts` - Speaker-participant linking
- `src/helpers/speaker-profile.ts` - Cross-meeting profiles

---

## Default Values Table

| Option | Default | Description |
|--------|---------|-------------|
| `fuzzyMatch` | `false` | Disabled for backward compat |
| `fuzzyThreshold` | `0.85` | 85% similarity required |
| `linkToParticipants` | `false` | Disabled by default |
| `strategy` | `'exact'` | Exact matching only |
| `minMeetings` | `1` | Minimum meetings for list |

---

## Changelog Entry

```markdown
### Added
- `nameSimilarity()` and `findSimilarSpeakers()` fuzzy matching utilities
- `linkSpeakersToParticipants()` for speaker-email linking
- `buildSpeakerProfile()` for cross-meeting speaker profiles
- `fuzzyMatch` and `linkToParticipants` options for `analyzeSpeakers()`
- `fireflies speakers` CLI command group (profile, list, suggest-merges)
- `SpeakerProfile`, `SpeakerMatchOptions`, `MergeSpeakersOptions` types
```

---

## Implementation Checklist (per CLAUDE.md)

### Step 1: Identify Layers
- [ ] Helpers needed: `nameSimilarity()`, `normalizeName()`, `findSimilarSpeakers()`, `levenshteinDistance()`, `linkSpeakersToParticipants()`, `buildSpeakerProfile()`
- [ ] SDK method: Enhanced `analyzeSpeakers()` (existing)
- [ ] CLI commands: `fireflies speakers profile|list|suggest-merges`

### Step 2: Implement Helpers (TDD) - Phase 1: Fuzzy Matching
- [ ] Create `test/unit/fuzzy-match.test.ts`
- [ ] Write failing tests for `normalizeName()`
- [ ] Implement in `src/helpers/fuzzy-match.ts`
- [ ] Write failing tests for `levenshteinDistance()`
- [ ] Implement Levenshtein algorithm
- [ ] Write failing tests for `nameSimilarity()`
- [ ] Implement multi-strategy similarity
- [ ] Write failing tests for `findSimilarSpeakers()`
- [ ] Implement ranked matching

### Step 2b: Implement Linking (TDD) - Phase 1 (parallel)
- [ ] Create `test/unit/speaker-linking.test.ts`
- [ ] Write failing tests for `linkSpeakersToParticipants()`
- [ ] Implement in `src/helpers/speaker-linking.ts`

### Step 2c: Implement Profile (TDD) - Phase 2
- [ ] Create `test/unit/speaker-profile.test.ts`
- [ ] Write failing tests for `buildSpeakerProfile()`
- [ ] Implement in `src/helpers/speaker-profile.ts`

### Step 2d: Enhance Existing (TDD) - Phase 2
- [ ] Add tests for new `fuzzyMatch` option in `speaker-analytics.test.ts`
- [ ] Enhance `analyzeSpeakers()` in `src/helpers/speaker-analytics.ts`
- [ ] All tests pass

### Step 3: Implement Types
- [ ] Create `src/types/speaker.ts`
- [ ] Export types from `src/index.ts`
- [ ] Export new helpers from `src/index.ts`

### Step 4: Implement CLI
- [ ] Create `src/cli/commands/speakers.ts`
- [ ] Register in `src/cli/index.ts`
- [ ] Implement `profile` subcommand
- [ ] Implement `list` subcommand
- [ ] Implement `suggest-merges` subcommand
- [ ] Add `--fuzzy` flag to `transcripts speakers`

### Step 5: Verification
- [ ] `npm run build` succeeds
- [ ] `npm run typecheck` passes
- [ ] `npm run check` passes
- [ ] `npm test` passes
- [ ] Manual CLI test with real speaker data

---

## Algorithm Considerations

### Similarity Threshold

Default: **0.85** (85% similarity required)

- Too low (< 0.7): May merge different people
- Too high (> 0.95): Misses valid variations

Allow user override via `fuzzyThreshold` option.

### Ambiguous Matches

When multiple candidates match above threshold:
- **For linking:** Skip (don't link to wrong email)
- **For merging:** Pick highest similarity if > 10% above second

### Performance

For large speaker lists, consider:
- Early exit on exact match
- Skip comparison if lengths differ by > 50%
- Cache normalized names

---

## Error Handling

```typescript
// Error scenarios:
// - No speakers in transcript → return empty analytics, not error
// - Speaker name is null/undefined → skip, log warning
// - No participants to link → return empty links map
// - buildSpeakerProfile finds no matches → return profile with 0 meetings
// - Invalid fuzzy threshold (< 0 or > 1) → throw ValidationError

// Graceful degradation pattern:
function analyzeSpeakers(
  transcript: Transcript,
  options: SpeakerAnalyticsOptions = {}
): SpeakerAnalytics {
  if (!transcript.speakers || transcript.speakers.length === 0) {
    return {
      speakers: [],
      totalDuration: 0,
      dominantSpeaker: null,
    };
  }
  // ... analyze speakers
}

// Ambiguous match handling:
function linkSpeakersToParticipants(
  speakers: Speaker[],
  participants: MeetingAttendee[]
): Map<string, string> {
  // Only link if unambiguous (single match above threshold)
  // Multiple matches → skip linking, don't guess
}
```

---

## Rate Limiting

- `buildSpeakerProfile()` fetches multiple transcripts - use pagination
- Default `delayMs: 100` between transcript fetches
- Single transcript operations have no rate limiting concerns
- Consider caching speaker analysis results per transcript

---

## CLI Registration

Update `src/cli/index.ts`:
```typescript
import { registerSpeakersCommand } from './commands/speakers.js';

registerSpeakersCommand(program);  // ADD THIS
```

Also update `src/cli/commands/transcripts.ts` to add `--fuzzy` flag to the `speakers` subcommand.

---

## Types Location

Create `src/types/speaker.ts`:
```typescript
export interface SpeakerMatchOptions {
  fuzzyMatch?: boolean;
  fuzzyThreshold?: number;
  linkToParticipants?: boolean;
}

export interface SpeakerProfile {
  primaryName: string;
  alternateNames: string[];
  linkedEmail?: string;
  totalMeetings: number;
  totalTalkTime: number;
  averageTalkTimePercent: number;
  meetings: SpeakerMeetingEntry[];
  patterns: SpeakerPatterns;
}

export interface SpeakerMeetingEntry {
  id: string;
  title: string;
  date: string;
  talkTime: number;
  talkPercent: number;
  speakerNameUsed: string;
}

export interface SpeakerPatterns {
  mostActiveDays: string[];
  averageSentencesPerMeeting: number;
  questionRate: number;
}

export interface MergeSpeakersOptions {
  strategy: 'exact' | 'fuzzy' | 'smart';
  threshold?: number;
  customMappings?: Record<string, string>;
}

export interface SpeakerSimilarity {
  name: string;
  similarity: number;
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
// CLI uses withProgress for profile building
const profile = await withProgress(
  { enabled: showProgress, text: 'Building speaker profile...' },
  async (update) => {
    update('Fetching transcripts...');
    const transcripts = await client.transcripts.list(params);

    let completed = 0;
    const total = transcripts.length;

    const meetings: SpeakerMeetingEntry[] = [];
    for (const t of transcripts) {
      update(`Analyzing meetings... ${completed}/${total}`);
      const full = await client.transcripts.get(t.id);
      // ... find and aggregate speaker data
      completed++;
    }

    update('Calculating patterns...');
    return buildProfile(meetings, options);
  }
);
```

---

## Backward Compatibility

- `analyzeSpeakers()` enhancement is backward compatible
  - New options (`fuzzyMatch`, `linkToParticipants`) default to `false`
  - Existing code continues to work unchanged
- `buildSpeakerProfile()` is a new function - no breaking changes
- Fuzzy matching utilities are new exports - no breaking changes
- No changes to existing `Speaker` or `SpeakerAnalytics` types

---

## Test Fixtures

Create test fixtures in `test/fixtures/speakers/`:
- `speakers-various-names.json` - Speakers with name variations
- `participants-for-linking.json` - Participant list for linking tests
- `transcript-multi-speaker.json` - Transcript with many speakers
- `expected-merges.json` - Expected merge suggestions

---

## JSDoc Requirements

All public functions must have JSDoc:
```typescript
/**
 * Calculate similarity between two speaker names using multiple strategies.
 *
 * @param name1 - First speaker name
 * @param name2 - Second speaker name
 * @returns Similarity score from 0 (no match) to 1 (exact match)
 *
 * @example
 * ```typescript
 * nameSimilarity('John Smith', 'J. Smith'); // ~0.85
 * nameSimilarity('John Smith', 'John Smith'); // 1.0
 * nameSimilarity('John', 'Jane'); // ~0.5
 * ```
 */
export function nameSimilarity(name1: string, name2: string): number;

/**
 * Build a cross-meeting profile for a speaker.
 *
 * @param client - Fireflies client instance
 * @param options - Profile building options
 * @returns Speaker profile with aggregated stats and meeting history
 *
 * @example
 * ```typescript
 * const profile = await buildSpeakerProfile(client, {
 *   speakerName: 'John Smith',
 *   period: 'last-month',
 *   fuzzyMatch: true,
 * });
 * console.log(`${profile.primaryName}: ${profile.totalMeetings} meetings`);
 * ```
 */
export async function buildSpeakerProfile(
  client: FirefliesClient,
  options: SpeakerProfileOptions
): Promise<SpeakerProfile>;
```

---

## Code Patterns to Follow

Based on existing codebase patterns:

```typescript
// 1. Enhance existing function with backward-compatible options
// From src/helpers/speaker-analytics.ts pattern
export function analyzeSpeakers(
  transcript: Transcript,
  options: SpeakerAnalyticsOptions = {}
): SpeakerAnalytics {
  const {
    mergeSpeakersByName = true,  // Existing default
    fuzzyMatch = false,          // NEW - defaults to false for compat
    fuzzyThreshold = 0.85,       // NEW
    linkToParticipants = false,  // NEW
  } = options;
  // ...
}

// 2. Name normalization pattern
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z\s]/g, '')   // Remove punctuation
    .replace(/\s+/g, ' ');       // Normalize whitespace
}

// 3. Multi-strategy similarity (no single algorithm)
export function nameSimilarity(name1: string, name2: string): number {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);

  // Try multiple strategies, return best match
  if (n1 === n2) return 1.0;
  if (n1.includes(n2) || n2.includes(n1)) return 0.9;
  if (sameInitialsAndLastName(n1, n2)) return 0.85;

  const levenshtein = 1 - (levenshteinDistance(n1, n2) / Math.max(n1.length, n2.length));
  const tokenOverlap = jaccardSimilarity(tokenize(n1), tokenize(n2));

  return Math.max(levenshtein, tokenOverlap);
}

// 4. Ambiguous match handling - skip rather than guess
function linkSpeakersToParticipants(
  speakers: Speaker[],
  participants: MeetingAttendee[]
): Map<string, string> {
  const links = new Map<string, string>();

  for (const speaker of speakers) {
    const matches = findSimilarSpeakers(speaker.name, participants.map(p => p.displayName));
    // Only link if EXACTLY ONE match - don't guess
    if (matches.length === 1) {
      const participant = participants.find(p =>
        normalizeName(p.displayName) === normalizeName(matches[0].name)
      );
      if (participant) {
        links.set(speaker.name, participant.email);
      }
    }
  }

  return links;
}

// 5. Profile building with progress
export async function buildSpeakerProfile(
  client: FirefliesClient,
  options: SpeakerProfileOptions
): Promise<SpeakerProfile> {
  // Use pagination for large date ranges
  const meetings: SpeakerMeetingEntry[] = [];

  for await (const transcript of paginateAll(
    (skip, limit) => client.transcripts.list({ ...params, skip, limit })
  )) {
    // Process each transcript
  }
}
```

---

## References

- `src/helpers/speaker-analytics.ts` - Existing speaker analysis
- `src/types/transcript.ts` - Speaker, MeetingAttendee types
- Levenshtein distance algorithm
- Jaccard similarity for token sets
