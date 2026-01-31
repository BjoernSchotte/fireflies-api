# Feature Spec: AskFred API Integration

## Overview

Integrate the AskFred conversational AI API, allowing users to query transcripts using natural language questions.

**Priority:** High (listed in ROADMAP.md Future Considerations)
**Complexity:** Medium-High
**Swarm Applicable:** Yes - 4 parallel work streams

---

## Problem Statement

Users currently need to manually search transcripts or write code to extract specific information. AskFred provides a natural language interface to query meeting content, but it's not exposed in this SDK.

**Example use cases:**
- "What action items were assigned to Sarah?"
- "Summarize the budget discussion from last week's meetings"
- "What questions did the client ask about pricing?"

---

## Proposed Solution

### SDK API

```typescript
// New method on FirefliesClient
const answer = await client.askFred.query({
  question: "What were the main concerns raised about the timeline?",
  transcriptIds: ["id1", "id2"], // Optional: limit to specific transcripts
  fromDate: "2024-01-01",        // Optional: date range
  toDate: "2024-01-31",
});

// Response
interface AskFredResponse {
  answer: string;
  confidence: number;
  sources: Array<{
    transcriptId: string;
    transcriptTitle: string;
    relevantText: string;
    timestamp: number;
  }>;
}
```

### CLI Command

```bash
# Basic query
fireflies ask "What action items were assigned to Sarah?"

# With filters
fireflies ask "Summarize budget discussions" --last-month --mine

# Output formats
fireflies ask "List all client questions" -o json
fireflies ask "Key decisions made" -o plain  # Default: formatted answer
```

---

## Technical Design

### Files to Create/Modify

| File | Description |
|------|-------------|
| `src/types/askfred.ts` | AskFredQuery, AskFredResponse types |
| `src/graphql/queries/askfred.ts` | GraphQL query implementation |
| `src/cli/commands/ask.ts` | CLI command handler |
| `test/unit/askfred.test.ts` | Unit tests for response parsing |
| `test/live/askfred.live.test.ts` | Live E2E tests |

### GraphQL Query (to research)

```graphql
# Needs investigation - AskFred API schema unknown
query AskFred($question: String!, $transcriptIds: [ID]) {
  askFred(question: $question, transcriptIds: $transcriptIds) {
    answer
    confidence
    sources {
      transcriptId
      text
      timestamp
    }
  }
}
```

### Dependencies

- None (uses existing GraphQL client)

---

## Orchestration Strategy (Swarm Pattern)

This feature benefits from parallel development because the work streams are independent:

```
┌─────────────────────────────────────────────────────────────────┐
│                     TEAM: askfred-integration                    │
└─────────────────────────────────────────────────────────────────┘

Phase 1: Research + Foundation (Parallel)
┌──────────────────────┐  ┌──────────────────────┐
│ research-agent       │  │ types-agent          │
│ (Explore)            │  │ (general-purpose)    │
│                      │  │                      │
│ - Find AskFred docs  │  │ - Create askfred.ts  │
│ - Discover schema    │  │ - Request/response   │
│ - Auth requirements  │  │ - Error types        │
│ - Rate limits        │  │ - Export from index  │
└──────────┬───────────┘  └──────────┬───────────┘
           │                         │
           └────────────┬────────────┘
                        ▼
Phase 2: Implementation (Parallel, blocked by Phase 1)
┌──────────────────────┐  ┌──────────────────────┐
│ sdk-agent            │  │ cli-agent            │
│ (general-purpose)    │  │ (general-purpose)    │
│                      │  │                      │
│ - GraphQL query      │  │ - ask command        │
│ - Client method      │  │ - Output formatting  │
│ - Error handling     │  │ - Date filters       │
└──────────┬───────────┘  └──────────┬───────────┘
           │                         │
           └────────────┬────────────┘
                        ▼
Phase 3: Testing (blocked by Phase 2)
┌──────────────────────────────────────┐
│ test-agent (general-purpose)         │
│                                      │
│ - Unit tests for response parsing    │
│ - Integration tests with fixtures    │
│ - Live E2E test (read-only)          │
└──────────────────────────────────────┘
```

### Task Definitions

```javascript
// Task #1: Research AskFred API
TaskCreate({
  subject: "Research AskFred API schema and authentication",
  description: `
    Use WebSearch and WebFetch to discover:
    1. AskFred GraphQL schema (query name, parameters, response shape)
    2. Authentication requirements (same API key? different?)
    3. Rate limits and quotas
    4. Any existing documentation or examples

    Output: Summary in specs/research/askfred-api.md
  `,
  activeForm: "Researching AskFred API..."
})

// Task #2: Create types (parallel with #1)
TaskCreate({
  subject: "Create AskFred TypeScript types",
  description: `
    Create src/types/askfred.ts with:
    - AskFredQueryParams interface
    - AskFredResponse interface
    - AskFredSource interface
    - Export from src/index.ts

    Follow existing type patterns in src/types/
  `,
  activeForm: "Creating AskFred types..."
})

// Task #3: Implement SDK method (blocked by #1, #2)
// Task #4: Implement CLI command (blocked by #2)
// Task #5: Write tests (blocked by #3, #4)
```

---

## CLI Output Examples

```bash
$ fireflies ask "What action items were assigned to Sarah?"

AskFred Response
═══════════════════════════════════════════════════════════════

Question: What action items were assigned to Sarah?

Answer:
Sarah was assigned 3 action items across your recent meetings:
1. Review the Q1 marketing budget (due Jan 15)
2. Schedule follow-up with Acme Corp
3. Update the project timeline in Jira

Confidence: 92%

Sources:
  • Weekly Standup (Jan 10) - "Sarah, can you review the Q1 budget?"
  • Client Review (Jan 12) - "Sarah will handle the Acme follow-up"
  • Sprint Planning (Jan 14) - "Sarah to update Jira by EOD"

$ fireflies ask "Summarize budget discussions" --last-month -o json
{
  "answer": "Budget discussions focused on Q1 allocations...",
  "confidence": 0.85,
  "sources": [
    {
      "transcriptId": "abc123",
      "transcriptTitle": "Budget Review",
      "relevantText": "We need to allocate 30% more to marketing",
      "timestamp": 1234567890
    }
  ]
}
```

---

## Test Plan

### Unit Tests
- Response parsing with various answer formats
- Source extraction and linking
- Error handling (no results, rate limit, auth failure)

### Integration Tests (with fixtures)
- Query with transcript filter
- Query with date range
- Empty results handling

### Live E2E Tests
- Basic query against real transcripts
- Verify source links are valid transcript IDs

---

## Acceptance Criteria

- [ ] `client.askFred.query()` returns answers with sources
- [ ] `fireflies ask "question"` works from CLI
- [ ] Date filters (`--from`, `--to`, `--last-week`) work
- [ ] Transcript filters (`--transcript-id`) work
- [ ] Sources link back to actual transcript content
- [ ] All tests pass
- [ ] TypeDoc documentation complete

---

## Open Questions

1. **API Discovery:** What is the actual AskFred GraphQL schema? Needs research.
2. **Rate Limits:** Does AskFred have separate rate limits from main API?
3. **Streaming:** Does AskFred support streaming responses for long answers?
4. **Cost:** Are there per-query costs that should be documented?

---

## Non-Goals / Out of Scope

This feature explicitly does NOT:
- Provide local/offline question answering (requires API)
- Cache answers (each query is fresh)
- Support follow-up conversational context (each query is independent)
- Modify or annotate transcripts based on answers
- Provide real-time streaming of answers (batch response only)
- Support non-English questions (API limitation, if any)

---

## Dependencies (Existing Code to Reuse)

| Existing Code | Usage |
|---------------|-------|
| `src/graphql/client.ts` | GraphQL execution |
| `src/errors.ts` | Base error classes to extend |
| `src/utils/retry.ts` | Rate limit retry logic |
| `src/cli/utils/output.ts` | CLI output formatting |
| `src/cli/utils/progress.ts` | Progress indicators |
| `src/cli/utils/dates.ts` | Date parsing for `--last-week` etc. |

---

## Default Values Table

| Option | Default | Description |
|--------|---------|-------------|
| `transcriptIds` | `undefined` | All transcripts if not specified |
| `fromDate` | `undefined` | No lower bound |
| `toDate` | `undefined` | No upper bound |
| `limit` | `50` | Max transcripts to search |
| `retryOnRateLimit` | `true` | Auto-retry on 429 |
| `maxRetries` | `3` | Max retry attempts |
| `timeout` | `30000` | Request timeout (ms) |

---

## Changelog Entry

```markdown
### Added
- `client.askFred.query()` - Query transcripts using natural language via AskFred AI
- `fireflies ask` CLI command for natural language queries
- `AskFredResponse`, `AskFredQueryParams`, `AskFredSource` types
```

---

## Implementation Checklist (per CLAUDE.md)

### Step 1: Identify Layers
- [ ] Helpers needed: Response parsing utilities (pure functions)
- [ ] SDK method: `client.askFred.query()`
- [ ] CLI command: `fireflies ask`

### Step 2: Implement Helpers (TDD)
- [ ] Create `test/unit/askfred.test.ts`
- [ ] Write failing tests for response parsing
- [ ] Implement parsing helpers
- [ ] Tests pass

### Step 3: Implement SDK Method
- [ ] Create `src/types/askfred.ts`
- [ ] Create `src/graphql/queries/askfred.ts`
- [ ] Add `askFred` to client
- [ ] Export types from `src/index.ts`

### Step 4: Implement CLI
- [ ] Create `src/cli/commands/ask.ts`
- [ ] Register in `src/cli/index.ts`
- [ ] Add date filter options
- [ ] Add output formatting

### Step 5: Verification
- [ ] `npm run build` succeeds
- [ ] `npm run typecheck` passes
- [ ] `npm run check` passes
- [ ] `npm test` passes
- [ ] Manual CLI test works

---

## Error Handling

```typescript
// src/errors.ts - Add new error class
export class AskFredError extends FirefliesError {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'AskFredError';
  }
}

// Error scenarios to handle:
// - No transcripts match filters → return empty sources, not error
// - AskFred service unavailable → throw AskFredError
// - Rate limit exceeded → throw RateLimitError (existing)
// - Invalid question format → throw ValidationError (existing)
// - No answer found → return { answer: '', confidence: 0, sources: [] }
```

---

## Rate Limiting

- AskFred may have separate rate limits from main API
- Research required: document limits in JSDoc
- Consider adding `retryOnRateLimit` option (default: true)
- Use existing `src/utils/retry.ts` for exponential backoff

---

## CLI Registration

Update `src/cli/index.ts`:
```typescript
import { registerAskCommand } from './commands/ask.js';
// ... other imports

// Register all commands
registerAskCommand(program);  // ADD THIS
```

---

## Types Location

Create `src/types/askfred.ts`:
```typescript
export interface AskFredQueryParams {
  question: string;
  transcriptIds?: string[];
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export interface AskFredResponse {
  answer: string;
  confidence: number;
  sources: AskFredSource[];
}

export interface AskFredSource {
  transcriptId: string;
  transcriptTitle: string;
  relevantText: string;
  timestamp: number;
}
```

Export from `src/index.ts`:
```typescript
export type {
  AskFredQueryParams,
  AskFredResponse,
  AskFredSource,
} from './types/askfred.js';
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

## JSDoc Requirements

All public functions must have JSDoc:
```typescript
/**
 * Query transcripts using natural language via AskFred.
 *
 * @param params - Query parameters
 * @returns Answer with confidence score and source citations
 * @throws {AskFredError} If the AskFred service is unavailable
 * @throws {RateLimitError} If rate limit exceeded
 *
 * @example
 * ```typescript
 * const result = await client.askFred.query({
 *   question: "What action items were assigned?",
 *   fromDate: "2024-01-01",
 * });
 * console.log(result.answer);
 * ```
 */
```

---

## Progress Integration

CLI should use `withProgress` from previous implementation:
```typescript
// src/cli/commands/ask.ts
import { withProgress } from '../utils/progress.js';

const result = await withProgress(
  { enabled: showProgress, text: 'Querying AskFred...' },
  async () => client.askFred.query(params)
);
```

---

## Backward Compatibility

- `client.askFred.query()` is a new method - no breaking changes
- New `AskFredError` class extends existing `FirefliesError`
- No changes to existing client methods or types

---

## Test Fixtures

Create test fixtures in `test/fixtures/askfred/`:
- `response-with-sources.json` - Typical response with multiple sources
- `response-no-results.json` - Empty answer response
- `response-high-confidence.json` - High confidence answer
- `response-low-confidence.json` - Low confidence answer

---

## Code Patterns to Follow

Based on existing codebase patterns:

```typescript
// 1. Options with defaults at function start
export function askFredQuery(
  params: AskFredQueryParams,
  options: AskFredOptions = {}
): Promise<AskFredResponse> {
  const {
    timeout = 30000,
    retryOnRateLimit = true,
    maxRetries = 3,
  } = options;
  // ...
}

// 2. Empty state handling - return valid empty object, not null
function emptyResponse(): AskFredResponse {
  return {
    answer: '',
    confidence: 0,
    sources: [],
  };
}

// 3. Guard clauses for early returns
if (!params.question || params.question.trim().length === 0) {
  throw new ValidationError('Question is required');
}

// 4. Error messages with context
throw new AskFredError(
  `AskFred query failed: ${error.message}`,
  error.code
);

// 5. Interface fields with JSDoc
export interface AskFredResponse {
  /** Natural language answer to the question */
  answer: string;
  /** Confidence score from 0 (no confidence) to 1 (high confidence) */
  confidence: number;
  /** Source citations from transcripts */
  sources: AskFredSource[];
}
```

---

## References

- ROADMAP.md Future Considerations
- Fireflies.ai documentation (needs research)
- `src/errors.ts` - Existing error classes
- `src/utils/retry.ts` - Retry logic
