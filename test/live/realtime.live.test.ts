import { beforeAll, describe, expect, it } from 'vitest';
import { FirefliesClient } from '../../src/client.js';
import type { TranscriptionChunk } from '../../src/realtime/types.js';

/**
 * Live E2E tests for the realtime API.
 *
 * These tests require:
 * - LIVE_TEST=1 environment variable
 * - FIREFLIES_API_KEY environment variable
 * - FIREFLIES_MEETING_ID environment variable (active meeting ID)
 *
 * Run with: FIREFLIES_MEETING_ID=xxx npm run test:live
 *
 * NOTE: These tests are read-only and non-destructive.
 * They only listen to an active stream without modifying any data.
 */

const API_KEY = process.env.FIREFLIES_API_KEY;
const MEETING_ID = process.env.FIREFLIES_MEETING_ID;
const SHOULD_RUN = process.env.LIVE_TEST === '1' && !!API_KEY && !!MEETING_ID;

describe.skipIf(!SHOULD_RUN)('realtime (live)', () => {
  let client: FirefliesClient;
  let meetingId: string;

  beforeAll(() => {
    if (!API_KEY) {
      throw new Error('FIREFLIES_API_KEY is required for live tests');
    }
    if (!MEETING_ID) {
      throw new Error('FIREFLIES_MEETING_ID is required for realtime tests');
    }
    client = new FirefliesClient({ apiKey: API_KEY });
    meetingId = MEETING_ID;
  });

  it('connects to realtime stream', async () => {
    const stream = await client.realtime.connect(meetingId);

    expect(stream.connected).toBe(true);

    stream.close();
  });

  it('receives at least one chunk', async () => {
    const stream = await client.realtime.connect(meetingId);

    const chunks: TranscriptionChunk[] = [];

    // Set up a timeout promise
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('No chunks received within 30 seconds')), 30000)
    );

    // Set up chunk listener
    const chunkPromise = new Promise<void>((resolve) => {
      stream.on('chunk', (chunk) => {
        chunks.push(chunk);
        resolve();
      });
    });

    try {
      await Promise.race([chunkPromise, timeout]);

      expect(chunks.length).toBeGreaterThan(0);
      expect(typeof chunks[0]?.chunk_id).toBe('string');
      expect(typeof chunks[0]?.speaker_name).toBe('string');
      expect(typeof chunks[0]?.text).toBe('string');
      expect(typeof chunks[0]?.start_time).toBe('number');
      expect(typeof chunks[0]?.end_time).toBe('number');
    } finally {
      stream.close();
    }
  });

  it('uses async iterator to receive chunks', async () => {
    const chunks: TranscriptionChunk[] = [];
    const maxChunks = 3;

    // Set timeout to avoid hanging
    const timeout = setTimeout(() => {
      throw new Error('Async iterator timeout - no chunks received');
    }, 30000);

    try {
      for await (const chunk of client.realtime.stream(meetingId)) {
        chunks.push(chunk);
        if (chunks.length >= maxChunks) break;
      }
    } finally {
      clearTimeout(timeout);
    }

    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });
});
