import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getMeetingsForMultipleUsers,
  type MultiUserTranscript,
} from '../../src/helpers/multi-user.js';
import type { Transcript } from '../../src/types/transcript.js';

// Mock the client module
vi.mock('../../src/client.js', () => ({
  FirefliesClient: vi.fn(),
}));

import { FirefliesClient } from '../../src/client.js';

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

describe('getMeetingsForMultipleUsers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches transcripts from all API keys', async () => {
    const user1Transcripts = [createTranscript({ id: '1', title: 'User 1 Meeting' })];
    const user2Transcripts = [createTranscript({ id: '2', title: 'User 2 Meeting' })];

    const MockFirefliesClient = FirefliesClient as unknown as ReturnType<typeof vi.fn>;
    MockFirefliesClient.mockImplementation((config: { apiKey: string }) => ({
      transcripts: {
        listAll: async function* () {
          if (config.apiKey === 'key1') {
            for (const t of user1Transcripts) yield t;
          } else {
            for (const t of user2Transcripts) yield t;
          }
        },
      },
    }));

    vi.useRealTimers();

    const results: MultiUserTranscript[] = [];
    for await (const result of getMeetingsForMultipleUsers(['key1', 'key2'], { delayMs: 0 })) {
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

    const MockFirefliesClient = FirefliesClient as unknown as ReturnType<typeof vi.fn>;
    MockFirefliesClient.mockImplementation((config: { apiKey: string }) => ({
      transcripts: {
        listAll: async function* () {
          // Both users have the shared transcript
          yield sharedTranscript;
          if (config.apiKey === 'key2') {
            yield uniqueTranscript;
          }
        },
      },
    }));

    vi.useRealTimers();

    const results: MultiUserTranscript[] = [];
    for await (const result of getMeetingsForMultipleUsers(['key1', 'key2'], {
      deduplicate: true,
      delayMs: 0,
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

    const MockFirefliesClient = FirefliesClient as unknown as ReturnType<typeof vi.fn>;
    MockFirefliesClient.mockImplementation(() => ({
      transcripts: {
        listAll: async function* () {
          yield sharedTranscript;
        },
      },
    }));

    vi.useRealTimers();

    const results: MultiUserTranscript[] = [];
    for await (const result of getMeetingsForMultipleUsers(['key1', 'key2'], {
      deduplicate: false,
      delayMs: 0,
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
    const listAllMock = vi.fn().mockImplementation(async function* () {
      // Empty generator
    });

    const MockFirefliesClient = FirefliesClient as unknown as ReturnType<typeof vi.fn>;
    MockFirefliesClient.mockImplementation(() => ({
      transcripts: {
        listAll: listAllMock,
      },
    }));

    vi.useRealTimers();

    const filter = { fromDate: '2024-01-01', mine: true };
    const results = [];
    for await (const result of getMeetingsForMultipleUsers(['key1'], {
      filter,
      delayMs: 0,
    })) {
      results.push(result);
    }

    expect(listAllMock).toHaveBeenCalledWith(filter);
  });

  it('applies delay between iterations', async () => {
    const MockFirefliesClient = FirefliesClient as unknown as ReturnType<typeof vi.fn>;
    MockFirefliesClient.mockImplementation(() => ({
      transcripts: {
        listAll: async function* () {
          yield createTranscript({ id: '1' });
          yield createTranscript({ id: '2' });
        },
      },
    }));

    const results: MultiUserTranscript[] = [];
    const generator = getMeetingsForMultipleUsers(['key1'], { delayMs: 100 });
    const iterator = generator[Symbol.asyncIterator]();

    // First item - no delay
    const first = iterator.next();
    await vi.advanceTimersByTimeAsync(0);
    const { value: firstValue } = await first;
    results.push(firstValue);

    // Second item - should have 100ms delay
    const secondPromise = iterator.next();
    await vi.advanceTimersByTimeAsync(100);
    const { value: secondValue } = await secondPromise;
    results.push(secondValue);

    expect(results).toHaveLength(2);
  });

  it('handles empty API keys array', async () => {
    vi.useRealTimers();

    const results: MultiUserTranscript[] = [];
    for await (const result of getMeetingsForMultipleUsers([])) {
      results.push(result);
    }

    expect(results).toHaveLength(0);
  });

  it('handles users with no transcripts', async () => {
    const MockFirefliesClient = FirefliesClient as unknown as ReturnType<typeof vi.fn>;
    MockFirefliesClient.mockImplementation(() => ({
      transcripts: {
        listAll: async function* () {
          // Empty generator
        },
      },
    }));

    vi.useRealTimers();

    const results: MultiUserTranscript[] = [];
    for await (const result of getMeetingsForMultipleUsers(['key1', 'key2'], { delayMs: 0 })) {
      results.push(result);
    }

    expect(results).toHaveLength(0);
  });

  it('tracks correct source index for each transcript', async () => {
    const MockFirefliesClient = FirefliesClient as unknown as ReturnType<typeof vi.fn>;
    MockFirefliesClient.mockImplementation((config: { apiKey: string }) => ({
      transcripts: {
        listAll: async function* () {
          // Yield transcripts with IDs matching the key index
          const index = config.apiKey.replace('key', '');
          yield createTranscript({ id: `transcript-${index}` });
        },
      },
    }));

    vi.useRealTimers();

    const results: MultiUserTranscript[] = [];
    for await (const result of getMeetingsForMultipleUsers(['key0', 'key1', 'key2'], {
      delayMs: 0,
    })) {
      results.push(result);
    }

    expect(results).toHaveLength(3);
    expect(results[0].sourceIndex).toBe(0);
    expect(results[1].sourceIndex).toBe(1);
    expect(results[2].sourceIndex).toBe(2);
  });
});
