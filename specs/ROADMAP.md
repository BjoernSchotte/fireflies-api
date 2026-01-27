# Roadmap

This is the authoritative roadmap for the fireflies-api package. Development follows vertical slicing - each milestone delivers complete, usable functionality end-to-end.

## Testing Strategy

We avoid mocks because they lie. Instead:

```
                    ┌─────────────┐
                    │   Live E2E  │  ← Manual, validates fixtures match reality
                    │  (optional) │
                    └─────────────┘
               ┌─────────────────────┐
               │  Recorded Fixtures  │  ← Real API responses, replayed in CI
               │   (contract-ish)    │
               └─────────────────────┘
          ┌───────────────────────────────┐
          │         Unit Tests            │  ← Pure functions, zero mocks
          │  (retry, dedup, error parse)  │
          └───────────────────────────────┘
```

- **Unit tests**: Pure functions only (retry logic, deduplication, error parsing). No mocks.
- **Recorded fixtures**: Real Fireflies API responses captured in `test/fixtures/`, replayed via msw or nock. Re-record periodically to catch API drift.
- **Live E2E** (optional): `FIREFLIES_API_KEY=xxx npm run test:live` - validates fixtures, skipped in CI.

## Milestone 1: Foundation + Transcripts (v0.1.0) ✅

**Goal:** Working package that can fetch transcripts. Validates project setup and API design.

- [x] Project setup
  - [x] package.json with correct exports config
  - [x] tsconfig.json (strict, ESM)
  - [x] tsup.config.ts (ESM + CJS dual output)
  - [x] biome.json
  - [x] vitest.config.ts (separate configs for unit/integration/live)
  - [x] `test/fixtures/` directory structure
  - [x] Scripts: `test`, `test:live`, `test:record`
- [x] Core infrastructure
  - [x] `src/client.ts` - FirefliesClient entry point
  - [x] `src/graphql/client.ts` - GraphQL executor with native fetch
  - [x] `src/errors.ts` - Error classes (FirefliesError, AuthenticationError, RateLimitError, NotFoundError)
  - [x] `src/utils/retry.ts` - Exponential backoff
- [x] Transcripts vertical
  - [x] `src/types/transcript.ts` - Transcript, Sentence, Speaker, Summary types
  - [x] `src/types/params.ts` - TranscriptsQueryParams
  - [x] `src/graphql/queries/transcripts.ts` - get, list queries
  - [x] `src/helpers/pagination.ts` - listAll async iterator
- [x] Tests
  - [x] Unit tests for retry logic, error parsing
  - [x] Record fixtures from real Fireflies API (`test/fixtures/transcripts/`)
  - [x] Integration tests using recorded fixtures
  - [x] Optional live E2E test (`npm run test:live`)
- [x] `src/index.ts` - Public exports

**Deliverable:** `npm install && npm run build` works. Can fetch transcripts from Fireflies API.

---

## Milestone 2: Realtime API (v0.2.0) ✅

**Goal:** Live transcription streaming - the key differentiator.

- [x] Realtime infrastructure
  - [x] `src/realtime/types.ts` - TranscriptChunk, RealtimeEvents
  - [x] `src/realtime/client.ts` - Socket.IO connection management
  - [x] `src/realtime/stream.ts` - AsyncIterable wrapper
  - [x] `src/utils/dedup.ts` - Chunk deduplication by chunk_id
- [x] Features
  - [x] Event-based API (`stream.on('chunk', ...)`)
  - [x] Async iterator API (`for await (const chunk of stream)`)
  - [x] Auto-reconnect with exponential backoff
  - [x] Connection timeout handling
- [x] Tests
  - [x] Unit tests for deduplication, reconnection logic
  - [x] Socket.IO test server for integration tests (real protocol, controlled responses)
  - [x] Record realtime fixtures from live meeting
  - [x] Optional live E2E with active meeting

**Deliverable:** Can stream live transcription from active Fireflies meetings.

---

## Milestone 3: Full GraphQL Coverage (v0.3.0) ✅

**Goal:** Feature parity with official SDK for GraphQL operations.

- [x] Users vertical
  - [x] `src/types/user.ts`
  - [x] `src/graphql/queries/users.ts` - get, list, me
  - [x] `src/graphql/mutations/users.ts` - setRole
- [x] Bites vertical
  - [x] `src/types/bite.ts`
  - [x] `src/graphql/queries/bites.ts` - get, list
  - [x] `src/graphql/mutations/bites.ts` - create
- [x] Meetings vertical
  - [x] `src/types/meeting.ts`
  - [x] `src/graphql/queries/meetings.ts` - active
  - [x] `src/graphql/mutations/meetings.ts` - addBot
- [x] Audio vertical
  - [x] `src/graphql/mutations/audio.ts` - upload
- [x] Transcripts mutations
  - [x] `src/graphql/mutations/transcripts.ts` - delete
- [x] AI Apps
  - [x] `src/types/ai-app.ts`
  - [x] `src/graphql/queries/ai-apps.ts` - list

**Deliverable:** Full GraphQL API coverage matching official SDK.

---

## Milestone 4: Convenience Helpers (v0.4.0) ✅

**Goal:** Power-user features that go beyond the official SDK.

- [x] Multi-user operations
  - [x] `src/helpers/multi-user.ts` - getMeetingsForMultipleUsers with deduplication
  - [x] `src/helpers/batch.ts` - Batch processor with rate limiting
- [x] Analysis helpers
  - [x] `src/helpers/external-questions.ts` - findExternalParticipantQuestions
  - [x] `src/helpers/videos.ts` - getMeetingVideos

**Deliverable:** All convenience features from official SDK plus improvements.

---

## Milestone 5: Release Readiness (v1.0.0)

**Goal:** Production-ready, publishable package.

- [x] Documentation
  - [x] README.md with examples
  - [ ] API documentation (TypeDoc or similar)
  - [x] Migration guide from official SDK
- [ ] Examples
  - [ ] `examples/basic-usage.ts`
  - [ ] `examples/realtime-stream.ts`
  - [ ] `examples/multi-user.ts`
- [x] CI/CD
  - [x] GitHub Actions for test/lint/build
  - [x] npm publish workflow
  - [x] Changesets or similar for versioning
- [x] Final polish
  - [x] 100% type coverage
  - [x] JSDoc comments on public API
  - [x] License file

**Deliverable:** Published to npm, ready for production use.

---

## Future Considerations (post v1.0.0)

- AskFred API integration (conversational AI queries)
- Webhook helpers
- Rate limit tracking and adaptive throttling
- Browser bundle (if demand exists)
- Speaker analytics helper (talk time %, participation metrics, interruption counts) ✅
- Action item extractor helper (parse action items from summary with assignees/due dates) ✅
- CLI transcript search command (`fireflies search <query>` across all transcripts)
- CLI meeting insights command (quick stats: avg duration, busiest days, top participants)
- CLI `--last-month` shortcut for transcripts list
- CLI action items Markdown export (checklist format for Notion/docs)
- Examples completion (`basic-usage.ts`, `realtime-stream.ts`, `multi-user.ts`)
