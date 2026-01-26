# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

See `specs/ARCHITECTURE.md` for full design specification.
