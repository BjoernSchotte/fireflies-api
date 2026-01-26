import { beforeAll, describe, expect, it } from 'vitest';
import { FirefliesClient } from '../../src/client.js';

/**
 * Live E2E tests for the transcripts API.
 *
 * These tests require:
 * - LIVE_TEST=1 environment variable
 * - FIREFLIES_API_KEY environment variable
 *
 * Run with: npm run test:live
 */

const API_KEY = process.env.FIREFLIES_API_KEY;
const SHOULD_RUN = process.env.LIVE_TEST === '1' && !!API_KEY;

describe.skipIf(!SHOULD_RUN)('transcripts (live)', () => {
  let client: FirefliesClient;

  beforeAll(() => {
    if (!API_KEY) {
      throw new Error('FIREFLIES_API_KEY is required for live tests');
    }
    client = new FirefliesClient({ apiKey: API_KEY });
  });

  it('lists transcripts', async () => {
    const transcripts = await client.transcripts.list({ limit: 5 });

    expect(Array.isArray(transcripts)).toBe(true);

    if (transcripts.length > 0) {
      const first = transcripts[0];
      expect(first).toBeDefined();
      expect(typeof first?.id).toBe('string');
      expect(typeof first?.title).toBe('string');
      expect(typeof first?.duration).toBe('number');
      expect(typeof first?.date).toBe('number');
    }
  });

  it('gets a single transcript', async () => {
    const transcripts = await client.transcripts.list({ limit: 1 });

    if (transcripts.length === 0) {
      console.log('No transcripts available, skipping get test');
      return;
    }

    const id = transcripts[0]?.id;
    if (!id) return;

    const transcript = await client.transcripts.get(id);

    expect(transcript.id).toBe(id);
    expect(typeof transcript.title).toBe('string');
    expect(Array.isArray(transcript.speakers)).toBe(true);
    expect(Array.isArray(transcript.sentences)).toBe(true);
    expect(Array.isArray(transcript.participants)).toBe(true);
  });

  it('gets transcript summary', async () => {
    const transcripts = await client.transcripts.list({ limit: 1 });

    if (transcripts.length === 0) {
      console.log('No transcripts available, skipping summary test');
      return;
    }

    const id = transcripts[0]?.id;
    if (!id) return;

    const summary = await client.transcripts.getSummary(id);

    // Summary might be null if not yet processed
    if (summary) {
      expect(typeof summary).toBe('object');
      // At least one summary field should be present
      const hasContent =
        summary.overview || summary.action_items || summary.keywords || summary.gist;
      expect(hasContent).toBeTruthy();
    }
  });

  it('filters transcripts by date range', async () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const transcripts = await client.transcripts.list({
      fromDate: thirtyDaysAgo.toISOString(),
      toDate: now.toISOString(),
      limit: 5,
    });

    expect(Array.isArray(transcripts)).toBe(true);

    for (const t of transcripts) {
      const date = new Date(t.dateString);
      expect(date.getTime()).toBeGreaterThanOrEqual(thirtyDaysAgo.getTime());
      expect(date.getTime()).toBeLessThanOrEqual(now.getTime());
    }
  });

  it('paginates through transcripts with listAll', async () => {
    const transcripts: Array<{ id: string }> = [];
    let count = 0;
    const maxCount = 10; // Limit to avoid long test times

    for await (const t of client.transcripts.listAll()) {
      transcripts.push(t);
      count++;
      if (count >= maxCount) break;
    }

    expect(transcripts.length).toBeLessThanOrEqual(maxCount);

    // Check for unique IDs
    const ids = new Set(transcripts.map((t) => t.id));
    expect(ids.size).toBe(transcripts.length);
  });

  it('handles empty search results', async () => {
    const transcripts = await client.transcripts.list({
      keyword: 'xyznonexistentkeyword12345',
      limit: 5,
    });

    expect(Array.isArray(transcripts)).toBe(true);
    expect(transcripts.length).toBe(0);
  });
});
