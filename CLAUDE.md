# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical Rules

- **NEVER commit or push without explicit user approval.** Always ask first before any git commit or push operation.
- **ALWAYS follow the test pyramid defined in `specs/ROADMAP.md`.** No mocks - use unit tests for pure functions, recorded fixtures for API integration, and optional live E2E tests.
- **Conventional commits required.** Format: `type(scope): description`. Types: feat, fix, docs, refactor, test, chore. Always include `Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>` footer.
- **No `any` types** without explicit justification in a comment explaining why.
- **Types exported from index.ts only.** Consumers import from `'fireflies-api'`, never from internal paths.
- **Functional core, imperative shell.** Pure business logic in core modules, I/O and side effects at the edges.
- **Live tests MUST be non-destructive.** Live E2E tests should only read data, never create/update/delete. This protects real user data when running against production APIs.

## Code Style

- **Function length:** Aim for <50 lines. Hard limit 250 lines - if longer, refactor.
- **Guard clauses:** Early returns over nested conditionals.
- **Error messages include context:** Not "Failed" but "Failed to fetch transcript {id}: {status} {message}".
- **JSDoc on all public APIs:** Shows in IDE tooltips, serves as documentation.

## Quality Gates (before requesting commit approval)

- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run check` (biome) passes
- [ ] No `any` without justification
- [ ] Public API changes have JSDoc updates
- [ ] Changelog updated if user-facing change

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
