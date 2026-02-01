import { describe, expect, it } from 'vitest';
import {
  type ClientFactory,
  getMeetingsForMultipleUsers,
  type MultiUserTranscript,
} from '../../src/helpers/multi-user.js';
import type { Transcript } from '../../src/types/transcript.js';

function createTranscript(overrides: Partial<Transcript> = {}): Transcript {
  return {
    id: overrides.id ?? 'test-id',
    title: overrides.title ?? 'Test Meeting',
    organizer_email: 'host@example.com',
    speakers: [],
    transcript_url: 'https://app.fireflies.ai/transcript/test-id',
    participants: [],
    meeting_attendees: [],
    meeting_attendance: [],
    fireflies_users: [],
    workspace_users: [],
    duration: 3600,
    dateString: '2024-01-15T10:00:00Z',
    date: 1705312800000,
    sentences: [],
    channels: [],
    ...overrides,
  };
}

/**
 * Create a test client factory that returns predefined transcripts per API key.
 */
function createTestClientFactory(transcriptsByKey: Record<string, Transcript[]>): ClientFactory {
  return (apiKey: string) => ({
    transcripts: {
      listAll: async function* () {
        const transcripts = transcriptsByKey[apiKey] ?? [];
        for (const t of transcripts) {
          yield t;
        }
      },
    },
  });
}

describe('getMeetingsForMultipleUsers', () => {
  it('fetches transcripts from all API keys', async () => {
    const user1Transcripts = [createTranscript({ id: '1', title: 'User 1 Meeting' })];
    const user2Transcripts = [createTranscript({ id: '2', title: 'User 2 Meeting' })];

    const createClient = createTestClientFactory({
      key1: user1Transcripts,
      key2: user2Transcripts,
    });

    const results: MultiUserTranscript[] = [];
    for await (const result of getMeetingsForMultipleUsers(['key1', 'key2'], {
      delayMs: 0,
      createClient,
    })) {
      results.push(result);
    }

    expect(results).toHaveLength(2);
    expect(results[0].transcript.id).toBe('1');
    expect(results[0].sourceApiKey).toBe('key1');
    expect(results[0].sourceIndex).toBe(0);
    expect(results[1].transcript.id).toBe('2');
    expect(results[1].sourceApiKey).toBe('key2');
    expect(results[1].sourceIndex).toBe(1);
  });

  it('deduplicates transcripts by ID when deduplicate is true', async () => {
    const sharedTranscript = createTranscript({ id: 'shared', title: 'Shared Meeting' });
    const uniqueTranscript = createTranscript({ id: 'unique', title: 'Unique Meeting' });

    const createClient = createTestClientFactory({
      key1: [sharedTranscript],
      key2: [sharedTranscript, uniqueTranscript],
    });

    const results: MultiUserTranscript[] = [];
    for await (const result of getMeetingsForMultipleUsers(['key1', 'key2'], {
      deduplicate: true,
      delayMs: 0,
      createClient,
    })) {
      results.push(result);
    }

    // Should only get shared once (from key1) and unique once
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.transcript.id)).toEqual(['shared', 'unique']);
    // Shared should come from first user
    expect(results[0].sourceIndex).toBe(0);
  });

  it('does not deduplicate when deduplicate is false', async () => {
    const sharedTranscript = createTranscript({ id: 'shared', title: 'Shared Meeting' });

    const createClient = createTestClientFactory({
      key1: [sharedTranscript],
      key2: [sharedTranscript],
    });

    const results: MultiUserTranscript[] = [];
    for await (const result of getMeetingsForMultipleUsers(['key1', 'key2'], {
      deduplicate: false,
      delayMs: 0,
      createClient,
    })) {
      results.push(result);
    }

    // Should get the same transcript twice
    expect(results).toHaveLength(2);
    expect(results[0].transcript.id).toBe('shared');
    expect(results[1].transcript.id).toBe('shared');
    expect(results[0].sourceIndex).toBe(0);
    expect(results[1].sourceIndex).toBe(1);
  });

  it('passes filter options to listAll', async () => {
    let receivedFilter: unknown = null;

    const createClient: ClientFactory = () => ({
      transcripts: {
        // biome-ignore lint/correctness/useYield: intentionally empty generator for test
        listAll: async function* (filter) {
          receivedFilter = filter;
        },
      },
    });

    const filter = { fromDate: '2024-01-01', mine: true };
    const results = [];
    for await (const result of getMeetingsForMultipleUsers(['key1'], {
      filter,
      delayMs: 0,
      createClient,
    })) {
      results.push(result);
    }

    expect(receivedFilter).toEqual(filter);
  });

  it('applies delay between iterations', async () => {
    const createClient = createTestClientFactory({
      key1: [createTranscript({ id: '1' }), createTranscript({ id: '2' })],
    });

    const startTime = Date.now();
    const results: MultiUserTranscript[] = [];

    for await (const result of getMeetingsForMultipleUsers(['key1'], {
      delayMs: 50,
      createClient,
    })) {
      results.push(result);
    }

    const elapsed = Date.now() - startTime;

    expect(results).toHaveLength(2);
    // Should have at least one delay of ~50ms between items
    expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some timing variance
  });

  it('handles empty API keys array', async () => {
    const results: MultiUserTranscript[] = [];
    for await (const result of getMeetingsForMultipleUsers([], { delayMs: 0 })) {
      results.push(result);
    }

    expect(results).toHaveLength(0);
  });

  it('handles users with no transcripts', async () => {
    const createClient = createTestClientFactory({
      key1: [],
      key2: [],
    });

    const results: MultiUserTranscript[] = [];
    for await (const result of getMeetingsForMultipleUsers(['key1', 'key2'], {
      delayMs: 0,
      createClient,
    })) {
      results.push(result);
    }

    expect(results).toHaveLength(0);
  });

  it('tracks correct source index for each transcript', async () => {
    const createClient = createTestClientFactory({
      key0: [createTranscript({ id: 'transcript-0' })],
      key1: [createTranscript({ id: 'transcript-1' })],
      key2: [createTranscript({ id: 'transcript-2' })],
    });

    const results: MultiUserTranscript[] = [];
    for await (const result of getMeetingsForMultipleUsers(['key0', 'key1', 'key2'], {
      delayMs: 0,
      createClient,
    })) {
      results.push(result);
    }

    expect(results).toHaveLength(3);
    expect(results[0].sourceIndex).toBe(0);
    expect(results[1].sourceIndex).toBe(1);
    expect(results[2].sourceIndex).toBe(2);
  });
});
