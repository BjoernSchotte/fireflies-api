import { describe, expect, it } from 'vitest';
import { createNormalizer, normalizeTranscript } from '../../src/helpers/normalize.js';
import type { Sentence, Transcript } from '../../src/types/transcript.js';

function createTranscript(overrides: Partial<Transcript> = {}): Transcript {
  return {
    id: 'test-id',
    title: 'Test Meeting',
    organizer_email: 'host@company.com',
    speakers: [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ],
    transcript_url: 'https://app.fireflies.ai/transcript/test-id',
    participants: ['host@company.com', 'guest@company.com'],
    meeting_attendees: [
      { displayName: 'Host User', email: 'host@company.com', name: 'Host User', phoneNumber: '' },
      {
        displayName: 'Guest User',
        email: 'guest@company.com',
        name: 'Guest User',
        phoneNumber: '',
      },
    ],
    meeting_attendance: [],
    fireflies_users: [],
    workspace_users: [],
    duration: 60, // 60 minutes
    dateString: '2024-01-15T10:00:00Z',
    date: 1705312800000,
    sentences: [],
    channels: [],
    ...overrides,
  };
}

function createSentence(overrides: Partial<Sentence> = {}): Sentence {
  return {
    index: 0,
    text: 'Hello world.',
    raw_text: 'Hello world.',
    start_time: '0.0',
    end_time: '5.0',
    speaker_id: '1',
    speaker_name: 'Alice',
    ...overrides,
  };
}

describe('normalizeTranscript', () => {
  describe('basic normalization', () => {
    it('creates prefixed ID', () => {
      const transcript = createTranscript({ id: 'abc123' });
      const normalized = normalizeTranscript(transcript);
      expect(normalized.id).toBe('fireflies:abc123');
    });

    it('normalizes title', () => {
      const transcript = createTranscript({ title: 'Weekly Standup' });
      const normalized = normalizeTranscript(transcript);
      expect(normalized.title).toBe('Weekly Standup');
    });

    it('converts date from Unix timestamp', () => {
      const timestamp = 1705312800000; // 2024-01-15T10:00:00Z
      const transcript = createTranscript({ date: timestamp });
      const normalized = normalizeTranscript(transcript);
      expect(normalized.date).toBeInstanceOf(Date);
      expect(normalized.date.getTime()).toBe(timestamp);
    });

    it('converts duration from minutes to seconds', () => {
      const transcript = createTranscript({ duration: 45 }); // 45 minutes
      const normalized = normalizeTranscript(transcript);
      expect(normalized.duration).toBe(2700); // 45 * 60 seconds
    });

    it('normalizes transcript URL', () => {
      const transcript = createTranscript({
        transcript_url: 'https://app.fireflies.ai/transcript/xyz',
      });
      const normalized = normalizeTranscript(transcript);
      expect(normalized.url).toBe('https://app.fireflies.ai/transcript/xyz');
    });

    it('sets source provider to fireflies', () => {
      const transcript = createTranscript({ id: 'original-123' });
      const normalized = normalizeTranscript(transcript);
      expect(normalized.source.provider).toBe('fireflies');
      expect(normalized.source.originalId).toBe('original-123');
    });
  });

  describe('speakers normalization', () => {
    it('normalizes speakers array', () => {
      const transcript = createTranscript({
        speakers: [
          { id: 'spk-1', name: 'Alice Johnson' },
          { id: 'spk-2', name: 'Bob Smith' },
        ],
      });
      const normalized = normalizeTranscript(transcript);

      expect(normalized.speakers).toHaveLength(2);
      expect(normalized.speakers[0]).toEqual({ id: 'spk-1', name: 'Alice Johnson' });
      expect(normalized.speakers[1]).toEqual({ id: 'spk-2', name: 'Bob Smith' });
    });

    it('handles empty speakers array', () => {
      const transcript = createTranscript({ speakers: [] });
      const normalized = normalizeTranscript(transcript);
      expect(normalized.speakers).toEqual([]);
    });

    it('applies custom resolveSpeakerName', () => {
      const transcript = createTranscript({
        speakers: [{ id: '1', name: 'Speaker 1' }],
      });
      const normalized = normalizeTranscript(transcript, {
        resolveSpeakerName: (speaker) => (speaker.name === 'Speaker 1' ? 'John Doe' : speaker.name),
      });
      expect(normalized.speakers[0]?.name).toBe('John Doe');
    });
  });

  describe('sentences normalization', () => {
    it('normalizes sentence fields', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            index: 0,
            text: 'Processed text',
            raw_text: 'Raw text',
            start_time: '10.5',
            end_time: '15.25',
            speaker_id: '1',
            speaker_name: 'Alice',
          }),
        ],
      });
      const normalized = normalizeTranscript(transcript);

      expect(normalized.sentences).toHaveLength(1);
      expect(normalized.sentences[0]).toMatchObject({
        index: 0,
        text: 'Processed text',
        rawText: 'Raw text',
        startTime: 10.5,
        endTime: 15.25,
        speakerId: '1',
        speakerName: 'Alice',
      });
    });

    it('converts timestamps to seconds by default', () => {
      const transcript = createTranscript({
        sentences: [createSentence({ start_time: '30.5', end_time: '45.75' })],
      });
      const normalized = normalizeTranscript(transcript);
      expect(normalized.sentences[0]?.startTime).toBe(30.5);
      expect(normalized.sentences[0]?.endTime).toBe(45.75);
    });

    it('converts timestamps to milliseconds when specified', () => {
      const transcript = createTranscript({
        sentences: [createSentence({ start_time: '30.5', end_time: '45.75' })],
      });
      const normalized = normalizeTranscript(transcript, { timeUnit: 'milliseconds' });
      expect(normalized.sentences[0]?.startTime).toBe(30500);
      expect(normalized.sentences[0]?.endTime).toBe(45750);
    });

    it('handles empty sentences array', () => {
      const transcript = createTranscript({ sentences: [] });
      const normalized = normalizeTranscript(transcript);
      expect(normalized.sentences).toEqual([]);
    });
  });

  describe('AI filters in sentences', () => {
    it('includes AI filters by default', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            ai_filters: {
              sentiment: 'positive',
              question: 'yes',
              task: 'Follow up on this',
            },
          }),
        ],
      });
      const normalized = normalizeTranscript(transcript);

      expect(normalized.sentences[0]?.sentiment).toBe('positive');
      expect(normalized.sentences[0]?.isQuestion).toBe(true);
      expect(normalized.sentences[0]?.isActionItem).toBe(true);
    });

    it('normalizes sentiment values', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({ ai_filters: { sentiment: 'negative' } }),
          createSentence({ ai_filters: { sentiment: 'neutral' } }),
          createSentence({ ai_filters: { sentiment: 'positive' } }),
        ],
      });
      const normalized = normalizeTranscript(transcript);

      expect(normalized.sentences[0]?.sentiment).toBe('negative');
      expect(normalized.sentences[1]?.sentiment).toBe('neutral');
      expect(normalized.sentences[2]?.sentiment).toBe('positive');
    });

    it('excludes AI filters when includeAIFilters is false', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            ai_filters: {
              sentiment: 'positive',
              question: 'yes',
              task: 'Follow up',
            },
          }),
        ],
      });
      const normalized = normalizeTranscript(transcript, { includeAIFilters: false });

      expect(normalized.sentences[0]?.sentiment).toBeUndefined();
      expect(normalized.sentences[0]?.isQuestion).toBeUndefined();
      expect(normalized.sentences[0]?.isActionItem).toBeUndefined();
    });

    it('handles missing ai_filters', () => {
      const transcript = createTranscript({
        sentences: [createSentence({ ai_filters: undefined })],
      });
      const normalized = normalizeTranscript(transcript);

      expect(normalized.sentences[0]?.sentiment).toBeUndefined();
      expect(normalized.sentences[0]?.isQuestion).toBeUndefined();
      expect(normalized.sentences[0]?.isActionItem).toBeUndefined();
    });
  });

  describe('participants normalization', () => {
    it('normalizes participants from email list', () => {
      const transcript = createTranscript({
        organizer_email: 'host@company.com',
        participants: ['host@company.com', 'guest@company.com'],
        meeting_attendees: [],
      });
      const normalized = normalizeTranscript(transcript);

      expect(normalized.participants).toHaveLength(2);
      expect(normalized.participants[0]).toMatchObject({
        email: 'host@company.com',
        role: 'organizer',
      });
      expect(normalized.participants[1]).toMatchObject({
        email: 'guest@company.com',
        role: 'attendee',
      });
    });

    it('enriches participants with meeting_attendees names', () => {
      const transcript = createTranscript({
        organizer_email: 'host@company.com',
        participants: ['host@company.com'],
        meeting_attendees: [
          {
            displayName: 'Host User',
            email: 'host@company.com',
            name: 'Host User',
            phoneNumber: '',
          },
        ],
      });
      const normalized = normalizeTranscript(transcript);

      expect(normalized.participants[0]?.name).toBe('Host User');
    });

    it('applies custom enrichParticipant callback', () => {
      const transcript = createTranscript({
        participants: ['host@company.com'],
      });
      const normalized = normalizeTranscript(transcript, {
        enrichParticipant: (email) => ({
          name: email === 'host@company.com' ? 'Custom Name' : undefined,
        }),
      });

      expect(normalized.participants[0]?.name).toBe('Custom Name');
    });

    it('handles empty participants', () => {
      const transcript = createTranscript({ participants: [] });
      const normalized = normalizeTranscript(transcript);
      expect(normalized.participants).toEqual([]);
    });
  });

  describe('summary normalization', () => {
    it('normalizes summary fields', () => {
      const transcript = createTranscript({
        summary: {
          overview: 'Meeting overview',
          shorthand_bullet: '- Point 1\n- Point 2',
          action_items: 'Follow up on X',
          outline: 'Meeting outline',
          topics_discussed: ['topic1', 'topic2'],
        },
      });
      const normalized = normalizeTranscript(transcript);

      expect(normalized.summary).toBeDefined();
      expect(normalized.summary?.overview).toBe('Meeting overview');
      expect(normalized.summary?.keyPoints).toEqual(['Point 1', 'Point 2']);
      expect(normalized.summary?.actionItems).toBe('Follow up on X');
      expect(normalized.summary?.outline).toBe('Meeting outline');
      expect(normalized.summary?.topics).toEqual(['topic1', 'topic2']);
    });

    it('excludes summary when includeSummary is false', () => {
      const transcript = createTranscript({
        summary: { overview: 'Test overview' },
      });
      const normalized = normalizeTranscript(transcript, { includeSummary: false });
      expect(normalized.summary).toBeUndefined();
    });

    it('handles missing summary', () => {
      const transcript = createTranscript({ summary: undefined });
      const normalized = normalizeTranscript(transcript);
      expect(normalized.summary).toBeUndefined();
    });

    it('handles empty summary', () => {
      const transcript = createTranscript({ summary: {} });
      const normalized = normalizeTranscript(transcript);
      // Empty summary should still be included but with undefined fields
      expect(normalized.summary).toBeDefined();
    });
  });

  describe('attendees normalization', () => {
    it('normalizes meeting_attendance to attendees', () => {
      const transcript = createTranscript({
        meeting_attendance: [
          { name: 'Alice', join_time: '2024-01-15T10:00:00Z', leave_time: '2024-01-15T11:00:00Z' },
          { name: 'Bob', join_time: '2024-01-15T10:05:00Z' },
        ],
      });
      const normalized = normalizeTranscript(transcript);

      expect(normalized.attendees).toHaveLength(2);
      expect(normalized.attendees?.[0]?.name).toBe('Alice');
      expect(normalized.attendees?.[0]?.joinTime).toBeInstanceOf(Date);
      expect(normalized.attendees?.[0]?.leaveTime).toBeInstanceOf(Date);
      expect(normalized.attendees?.[1]?.name).toBe('Bob');
      expect(normalized.attendees?.[1]?.leaveTime).toBeUndefined();
    });

    it('handles empty meeting_attendance', () => {
      const transcript = createTranscript({ meeting_attendance: [] });
      const normalized = normalizeTranscript(transcript);
      expect(normalized.attendees).toEqual([]);
    });
  });

  describe('channels normalization', () => {
    it('normalizes channels', () => {
      const transcript = createTranscript({
        channels: [
          { id: 'ch-1', title: 'Engineering', is_private: true },
          { id: 'ch-2', title: 'General', is_private: false },
        ],
      });
      const normalized = normalizeTranscript(transcript);

      expect(normalized.channels).toHaveLength(2);
      expect(normalized.channels?.[0]).toEqual({
        id: 'ch-1',
        title: 'Engineering',
        isPrivate: true,
      });
      expect(normalized.channels?.[1]).toEqual({
        id: 'ch-2',
        title: 'General',
        isPrivate: false,
      });
    });

    it('handles undefined is_private as false', () => {
      const transcript = createTranscript({
        channels: [{ id: 'ch-1', title: 'Public' }],
      });
      const normalized = normalizeTranscript(transcript);
      expect(normalized.channels?.[0]?.isPrivate).toBe(false);
    });
  });

  describe('analytics normalization', () => {
    it('normalizes analytics sentiments', () => {
      const transcript = createTranscript({
        analytics: {
          sentiments: {
            positive_pct: 45,
            neutral_pct: 40,
            negative_pct: 15,
          },
        },
      });
      const normalized = normalizeTranscript(transcript);

      expect(normalized.analytics?.sentiments).toEqual({
        positive: 45,
        neutral: 40,
        negative: 15,
      });
    });

    it('handles missing analytics', () => {
      const transcript = createTranscript({ analytics: undefined });
      const normalized = normalizeTranscript(transcript);
      expect(normalized.analytics).toBeUndefined();
    });
  });

  describe('includeRawData option', () => {
    it('excludes rawData by default', () => {
      const transcript = createTranscript();
      const normalized = normalizeTranscript(transcript);
      expect(normalized.source.rawData).toBeUndefined();
    });

    it('includes rawData when includeRawData is true', () => {
      const transcript = createTranscript({ id: 'test-raw' });
      const normalized = normalizeTranscript(transcript, { includeRawData: true });
      expect(normalized.source.rawData).toBeDefined();
      expect(normalized.source.rawData?.id).toBe('test-raw');
    });
  });

  describe('edge cases', () => {
    it('handles transcript with only required fields', () => {
      const minimalTranscript: Transcript = {
        id: 'minimal',
        title: 'Minimal',
        organizer_email: 'test@test.com',
        speakers: [],
        transcript_url: 'https://example.com',
        participants: [],
        meeting_attendees: [],
        meeting_attendance: [],
        fireflies_users: [],
        workspace_users: [],
        duration: 30,
        dateString: '2024-01-01',
        date: 1704067200000,
        sentences: [],
        channels: [],
      };
      const normalized = normalizeTranscript(minimalTranscript);

      expect(normalized.id).toBe('fireflies:minimal');
      expect(normalized.speakers).toEqual([]);
      expect(normalized.sentences).toEqual([]);
      expect(normalized.participants).toEqual([]);
    });

    it('handles transcript with all optional fields', () => {
      const fullTranscript = createTranscript({
        summary: { overview: 'Test' },
        analytics: { sentiments: { positive_pct: 50, neutral_pct: 30, negative_pct: 20 } },
        meeting_attendance: [{ name: 'Test', join_time: '2024-01-01T00:00:00Z' }],
        channels: [{ id: '1', title: 'Test' }],
        sentences: [createSentence({ ai_filters: { sentiment: 'positive' } })],
      });
      const normalized = normalizeTranscript(fullTranscript, { includeRawData: true });

      expect(normalized.summary).toBeDefined();
      expect(normalized.analytics).toBeDefined();
      expect(normalized.attendees).toBeDefined();
      expect(normalized.channels).toBeDefined();
      expect(normalized.source.rawData).toBeDefined();
    });

    it('handles malformed timestamp strings', () => {
      const transcript = createTranscript({
        sentences: [createSentence({ start_time: 'invalid', end_time: 'NaN' })],
      });
      const normalized = normalizeTranscript(transcript);
      // Should handle gracefully - NaN becomes 0 or similar
      expect(Number.isNaN(normalized.sentences[0]?.startTime)).toBe(false);
    });
  });
});

describe('createNormalizer', () => {
  it('returns a function that normalizes transcripts', () => {
    const normalizer = createNormalizer();
    const transcript = createTranscript({ id: 'factory-test' });
    const normalized = normalizer(transcript);

    expect(normalized.id).toBe('fireflies:factory-test');
  });

  it('creates normalizer with pre-configured options', () => {
    const normalizer = createNormalizer({
      timeUnit: 'milliseconds',
      includeRawData: true,
    });
    const transcript = createTranscript({
      sentences: [createSentence({ start_time: '10.0' })],
    });
    const normalized = normalizer(transcript);

    expect(normalized.sentences[0]?.startTime).toBe(10000);
    expect(normalized.source.rawData).toBeDefined();
  });

  it('reuses same config across multiple calls', () => {
    const normalizer = createNormalizer({ timeUnit: 'milliseconds' });
    const t1 = createTranscript({ sentences: [createSentence({ start_time: '5.0' })] });
    const t2 = createTranscript({ sentences: [createSentence({ start_time: '10.0' })] });

    const n1 = normalizer(t1);
    const n2 = normalizer(t2);

    expect(n1.sentences[0]?.startTime).toBe(5000);
    expect(n2.sentences[0]?.startTime).toBe(10000);
  });

  it('works with custom callbacks', () => {
    const normalizer = createNormalizer({
      resolveSpeakerName: (speaker) => `Resolved: ${speaker.name}`,
    });
    const transcript = createTranscript({
      speakers: [{ id: '1', name: 'Original' }],
    });
    const normalized = normalizer(transcript);

    expect(normalized.speakers[0]?.name).toBe('Resolved: Original');
  });
});
