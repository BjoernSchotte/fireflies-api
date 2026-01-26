import { describe, expect, it, vi } from 'vitest';
import { getMeetingVideos, hasVideo } from '../../src/helpers/videos.js';
import type { Transcript } from '../../src/types/transcript.js';

function createTranscript(overrides: Partial<Transcript> = {}): Transcript {
  return {
    id: 'test-id',
    title: 'Test Meeting',
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

describe('hasVideo', () => {
  it('returns true when video_url is set', () => {
    const transcript = createTranscript({ video_url: 'https://example.com/video.mp4' });
    expect(hasVideo(transcript)).toBe(true);
  });

  it('returns false when video_url is undefined', () => {
    const transcript = createTranscript({ video_url: undefined });
    expect(hasVideo(transcript)).toBe(false);
  });

  it('returns false when video_url is empty string', () => {
    const transcript = createTranscript({ video_url: '' });
    expect(hasVideo(transcript)).toBe(false);
  });

  it('narrows type when true', () => {
    const transcript = createTranscript({ video_url: 'https://example.com/video.mp4' });

    if (hasVideo(transcript)) {
      // TypeScript should allow this without type assertion
      const url: string = transcript.video_url;
      expect(url).toBe('https://example.com/video.mp4');
    }
  });
});

describe('getMeetingVideos', () => {
  it('yields transcripts with video URLs', async () => {
    const transcripts = [
      createTranscript({ id: '1', title: 'Meeting 1', video_url: 'https://example.com/1.mp4' }),
      createTranscript({ id: '2', title: 'Meeting 2' }), // No video
      createTranscript({ id: '3', title: 'Meeting 3', video_url: 'https://example.com/3.mp4' }),
    ];

    const mockClient = {
      transcripts: {
        listAll: vi.fn().mockImplementation(async function* () {
          for (const t of transcripts) {
            yield t;
          }
        }),
      },
    };

    const results: Array<{ transcript: Transcript; videoUrl: string }> = [];
    // Type cast to satisfy the function signature while using mock
    for await (const item of getMeetingVideos(
      mockClient as Parameters<typeof getMeetingVideos>[0]
    )) {
      results.push(item);
    }

    expect(results).toHaveLength(2);
    expect(results[0].transcript.id).toBe('1');
    expect(results[0].videoUrl).toBe('https://example.com/1.mp4');
    expect(results[1].transcript.id).toBe('3');
    expect(results[1].videoUrl).toBe('https://example.com/3.mp4');
  });

  it('passes filter options to listAll', async () => {
    const mockClient = {
      transcripts: {
        listAll: vi.fn().mockImplementation(async function* () {
          // Empty generator
        }),
      },
    };

    const filter = { fromDate: '2024-01-01', mine: true };

    // Collect all results (will be empty)
    const results = [];
    for await (const item of getMeetingVideos(
      mockClient as Parameters<typeof getMeetingVideos>[0],
      filter
    )) {
      results.push(item);
    }

    expect(mockClient.transcripts.listAll).toHaveBeenCalledWith(filter);
  });

  it('handles empty transcript list', async () => {
    const mockClient = {
      transcripts: {
        listAll: vi.fn().mockImplementation(async function* () {
          // Empty generator
        }),
      },
    };

    const results = [];
    for await (const item of getMeetingVideos(
      mockClient as Parameters<typeof getMeetingVideos>[0]
    )) {
      results.push(item);
    }

    expect(results).toHaveLength(0);
  });

  it('filters out transcripts with empty video_url', async () => {
    const transcripts = [
      createTranscript({ id: '1', video_url: '' }),
      createTranscript({ id: '2', video_url: 'https://example.com/video.mp4' }),
    ];

    const mockClient = {
      transcripts: {
        listAll: vi.fn().mockImplementation(async function* () {
          for (const t of transcripts) {
            yield t;
          }
        }),
      },
    };

    const results = [];
    for await (const item of getMeetingVideos(
      mockClient as Parameters<typeof getMeetingVideos>[0]
    )) {
      results.push(item);
    }

    expect(results).toHaveLength(1);
    expect(results[0].transcript.id).toBe('2');
  });
});
