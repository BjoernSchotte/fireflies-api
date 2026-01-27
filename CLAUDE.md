# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical Rules

- **NEVER commit or push without explicit user approval.** Always ask first before any git commit or push operation.
- **ALWAYS follow TDD and the test pyramid in `specs/ROADMAP.md`.** Write failing tests first, then implement. No mocks, no fakes - use unit tests for pure functions, recorded fixtures for API integration, and E2E tests only when user requests.
- **Conventional commits required.** Format: `type(scope): description`. Types: feat, fix, docs, refactor, test, chore. Always include `Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>` footer.
- **No `any` types** without explicit justification in a comment explaining why.
- **Types exported from index.ts only.** Consumers import from `'fireflies-api'`, never from internal paths.
- **Functional core, imperative shell.** Pure business logic in core modules, I/O and side effects at the edges.
- **Package functions are first-class. CLI wraps package functions.** All business logic lives in the SDK package—never in the CLI. A developer using `npm install fireflies-api` must get 100% of the functionality. CLI commands are thin wrappers: parse args → call SDK/helpers → format output. No feature should require using the CLI to access it.
  - **SDK methods** (`client.transcripts.search()`): Orchestration, API calls, data aggregation
  - **Helpers** (`searchTranscript()`, `analyzeSpeakers()`): Pure business logic, reusable, fully testable
  - **CLI**: Just one consumer of the SDK, not a privileged one
- **New code placement decision tree:**
  1. Is it pure logic with no API calls? → `src/helpers/` as exported function
  2. Does it call Fireflies API? → SDK method in `src/graphql/queries/` or `src/graphql/mutations/`
  3. Is it CLI-specific (arg parsing, output formatting)? → `src/cli/`
  4. **NEVER put helper functions inline in SDK methods.** Extract to `src/helpers/` so they can be tested independently.
- **Live E2E tests require user approval.** Before running, present tests grouped by: (1) read-only and (2) write operations. Ask user which to run. Never list or run delete tests unless user explicitly asks.

## Test-Driven Development (TDD) - Mandatory

**STOP. Before writing ANY implementation code, ask yourself:**
1. Have I written a failing test for this? If NO → write the test first.
2. Have I run the test and seen it fail? If NO → run it now.
3. Does it fail for the expected reason? If NO → fix the test.

**The Red-Green-Refactor cycle is non-negotiable:**

1. **RED:** Write a failing test first. Run it. Confirm it fails for the expected reason.
2. **GREEN:** Write the *minimum* code to make the test pass.
3. **REFACTOR:** Clean up while keeping tests green.

**Strict ordering:**
- Tests MUST be written before implementation code
- Never write implementation code "to be tested later"
- If you find yourself writing code without a failing test, STOP IMMEDIATELY and write the test first
- This applies to ALL code: helpers, SDK methods, CLI commands, bug fixes

**No mocks. No fakes. Tests must not lie.**
- Unit tests: Test pure functions with real inputs/outputs
- Integration tests: Use recorded fixtures (real API responses captured once)
- E2E tests: Hit real services. Present tests grouped by read-only and write operations, ask user for approval. Never list or run delete tests unless user explicitly asks.
- If no compliant approach seems possible, explain the constraint and ask the user before proceeding

**Why no mocks?**
- Mocks can pass while production breaks (interface drift)
- Mocks test implementation details, not behavior
- Mocks make refactoring painful
- A passing mock-heavy test suite provides false confidence

**Test file naming:** `*.test.ts` colocated with source, or in `__tests__/` directory.

## New Feature Workflow (MANDATORY)

When implementing any new feature, follow this exact sequence:

### Step 1: Identify the layers needed
- [ ] What helpers (pure functions) are needed? List them.
- [ ] What SDK method changes are needed?
- [ ] What CLI changes are needed?

### Step 2: Implement helpers FIRST (TDD)
For each helper function:
1. [ ] Create test file `test/unit/<helper-name>.test.ts`
2. [ ] Write failing tests covering edge cases
3. [ ] Run tests, confirm they fail: `npm test -- <helper-name>`
4. [ ] Implement helper in `src/helpers/<helper-name>.ts`
5. [ ] Run tests, confirm they pass
6. [ ] Export from `src/index.ts` if public API

### Step 3: Implement SDK method (uses helpers)
1. [ ] Add/update types in `src/types/`
2. [ ] Implement SDK method that calls helpers
3. [ ] SDK method should be thin: fetch data → call helper → return result

### Step 4: Implement CLI (thin wrapper)
1. [ ] Add CLI command/flag
2. [ ] CLI only does: parse args → call SDK → format output
3. [ ] No business logic in CLI

### Step 5: E2E verification
1. [ ] Build: `npm run build`
2. [ ] Run CLI command manually to verify

**If you skip any step, STOP and go back.** The architecture exists to keep code testable and maintainable.

## Code Style

- **Function length:** Aim for <50 lines. Over 100 lines requires refactoring.
- **File length:** Aim for <400 lines. Over 600 lines requires refactoring.
- **Single responsibility:** Each function/module does ONE thing. If you need "and" to describe it, split it.
- **Low complexity:** Minimize nesting and branches. Cyclomatic complexity >10 is a smell.
- **Readable without scrolling:** A function should be understandable without jumping around.
- **Guard clauses:** Early returns over nested conditionals.
- **Error messages include context:** Not "Failed" but "Failed to fetch transcript {id}: {status} {message}".
- **JSDoc on all public APIs:** Shows in IDE tooltips, serves as documentation.

## Quality Gates (before requesting commit approval)

- [ ] TDD followed (red-green-refactor cycle)
- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run check` (biome) passes
- [ ] Pre-existing lint warnings in modified files are fixed
- [ ] No `any` without justification
- [ ] No mocks or fakes in test code
- [ ] Public API changes have JSDoc updates
- [ ] Changelog updated if user-facing change

**Boy Scout Rule:** When modifying a file, fix pre-existing lint warnings and obvious mechanical issues (unused imports, typos in comments). Don't refactor, rename, or restructure—those deserve separate commits. If unsure whether a fix is mechanical, ask first.

## Runtime

- **Node.js 18+** (native fetch). Must also be Bun-compatible.
- **ESM only.** No CommonJS in source (tsup handles CJS output).

## Project Overview

TypeScript SDK for Fireflies.ai API with Realtime WebSocket support. Key differentiator from official SDK: live transcription streaming via Socket.IO.

## Commands

```bash
npm run build      # Build with tsup (ESM + CJS)
npm run test       # Run tests with vitest
npm run test:watch # Run tests in watch mode
npm run check      # Lint + format check with biome
npm run fix        # Auto-fix lint + format with biome
npm run typecheck  # TypeScript type checking
```

## Live E2E Tests

Before running E2E tests:
1. Present tests in two groups:
   - **Read-only:** list, get, fetch operations (non-destructive)
   - **Write:** create, update operations
2. Ask the user which groups/tests to run
3. Never list or run delete tests unless user explicitly requests them

```bash
# Ensure .env contains FIREFLIES_API_KEY (user provides their key)
export $(grep -v '^#' .env | xargs) && LIVE_TEST=1 npm run test:live
```

**Requirements:**
- `.env` file with `FIREFLIES_API_KEY=your-api-key`
- User approval required before running any E2E tests
- Delete tests: hidden by default, only shown/run when user explicitly asks
- Some tests may be skipped based on account plan (e.g., video requires Business+)

## Architecture

**Two API surfaces:**
- `src/graphql/` - GraphQL client wrapping `https://api.fireflies.ai/graphql`
- `src/realtime/` - Socket.IO client for `wss://api.fireflies.ai/ws/realtime`

**Client pattern:** `FirefliesClient` in `src/client.ts` exposes resource-based API:
- `client.transcripts.*` - queries/mutations for transcripts
- `client.users.*` - user management
- `client.bites.*` - clips/highlights
- `client.meetings.*` - active meetings, add bot
- `client.realtime.*` - live transcription streaming

**Realtime WebSocket auth:**
```typescript
auth: {
  token: `Bearer ${apiKey}`,
  transcriptId: meetingId
}
```

Events: `connect` → `auth.success` → `connection.established` → `transcription.broadcast` (chunks) → `disconnect`

**Helpers** in `src/helpers/`: convenience features like multi-user fetch with deduplication, auto-pagination.

## Key Documentation

- `specs/ARCHITECTURE.md` - Full design specification and API design
- `specs/ROADMAP.md` - **Authoritative roadmap** with milestones (vertical slices)
