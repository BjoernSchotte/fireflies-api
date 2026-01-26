# Roadmap

This is the authoritative roadmap for the fireflies-api package. Development follows vertical slicing - each milestone delivers complete, usable functionality end-to-end.

## Milestone 1: Foundation + Transcripts (v0.1.0)

**Goal:** Working package that can fetch transcripts. Validates project setup and API design.

- [ ] Project setup
  - [ ] package.json with correct exports config
  - [ ] tsconfig.json (strict, ESM)
  - [ ] tsup.config.ts (ESM + CJS dual output)
  - [ ] biome.json
  - [ ] vitest.config.ts
- [ ] Core infrastructure
  - [ ] `src/client.ts` - FirefliesClient entry point
  - [ ] `src/graphql/client.ts` - GraphQL executor with native fetch
  - [ ] `src/errors.ts` - Error classes (FirefliesError, AuthenticationError, RateLimitError, NotFoundError)
  - [ ] `src/utils/retry.ts` - Exponential backoff
- [ ] Transcripts vertical
  - [ ] `src/types/transcript.ts` - Transcript, Sentence, Speaker, Summary types
  - [ ] `src/types/params.ts` - TranscriptsQueryParams
  - [ ] `src/graphql/queries/transcripts.ts` - get, list queries
  - [ ] `src/helpers/pagination.ts` - listAll async iterator
- [ ] Tests
  - [ ] Unit tests for retry logic
  - [ ] Integration tests for transcripts (mocked)
- [ ] `src/index.ts` - Public exports

**Deliverable:** `npm install && npm run build` works. Can fetch transcripts from Fireflies API.

---

## Milestone 2: Realtime API (v0.2.0)

**Goal:** Live transcription streaming - the key differentiator.

- [ ] Realtime infrastructure
  - [ ] `src/realtime/types.ts` - TranscriptChunk, RealtimeEvents
  - [ ] `src/realtime/client.ts` - Socket.IO connection management
  - [ ] `src/realtime/stream.ts` - AsyncIterable wrapper
  - [ ] `src/utils/dedup.ts` - Chunk deduplication by chunk_id
- [ ] Features
  - [ ] Event-based API (`stream.on('chunk', ...)`)
  - [ ] Async iterator API (`for await (const chunk of stream)`)
  - [ ] Auto-reconnect with exponential backoff
  - [ ] Connection timeout handling
- [ ] Tests
  - [ ] Mock Socket.IO server tests
  - [ ] Deduplication tests
  - [ ] Reconnection tests

**Deliverable:** Can stream live transcription from active Fireflies meetings.

---

## Milestone 3: Full GraphQL Coverage (v0.3.0)

**Goal:** Feature parity with official SDK for GraphQL operations.

- [ ] Users vertical
  - [ ] `src/types/user.ts`
  - [ ] `src/graphql/queries/users.ts` - get, list, me
  - [ ] `src/graphql/mutations/users.ts` - setRole
- [ ] Bites vertical
  - [ ] `src/types/bite.ts`
  - [ ] `src/graphql/queries/bites.ts` - get, list
  - [ ] `src/graphql/mutations/bites.ts` - create
- [ ] Meetings vertical
  - [ ] `src/types/meeting.ts`
  - [ ] `src/graphql/queries/meetings.ts` - active
  - [ ] `src/graphql/mutations/meetings.ts` - addBot
- [ ] Audio vertical
  - [ ] `src/graphql/mutations/audio.ts` - upload
- [ ] Transcripts mutations
  - [ ] `src/graphql/mutations/transcripts.ts` - delete
- [ ] AI Apps
  - [ ] `src/types/ai-app.ts`
  - [ ] `src/graphql/queries/ai-apps.ts` - list

**Deliverable:** Full GraphQL API coverage matching official SDK.

---

## Milestone 4: Convenience Helpers (v0.4.0)

**Goal:** Power-user features that go beyond the official SDK.

- [ ] Multi-user operations
  - [ ] `src/helpers/multi-user.ts` - getMeetingsForMultipleUsers with deduplication
  - [ ] `src/helpers/batch.ts` - Batch processor with rate limiting
- [ ] Analysis helpers
  - [ ] `src/helpers/external-questions.ts` - findExternalParticipantQuestions
  - [ ] `src/helpers/videos.ts` - getMeetingVideos

**Deliverable:** All convenience features from official SDK plus improvements.

---

## Milestone 5: Release Readiness (v1.0.0)

**Goal:** Production-ready, publishable package.

- [ ] Documentation
  - [ ] README.md with examples
  - [ ] API documentation (TypeDoc or similar)
  - [ ] Migration guide from official SDK
- [ ] Examples
  - [ ] `examples/basic-usage.ts`
  - [ ] `examples/realtime-stream.ts`
  - [ ] `examples/multi-user.ts`
- [ ] CI/CD
  - [ ] GitHub Actions for test/lint/build
  - [ ] npm publish workflow
  - [ ] Changesets or similar for versioning
- [ ] Final polish
  - [ ] 100% type coverage
  - [ ] JSDoc comments on public API
  - [ ] License file

**Deliverable:** Published to npm, ready for production use.

---

## Future Considerations (post v1.0.0)

- AskFred API integration (conversational AI queries)
- Webhook helpers
- Rate limit tracking and adaptive throttling
- Browser bundle (if demand exists)
