import { describe, expect, it } from 'vitest';
import {
  NormalizedMeetingSchema,
  NormalizedSentenceSchema,
  NormalizedSpeakerSchema,
  NormalizedSummarySchema,
  parseNormalizedMeeting,
  safeParseNormalizedMeeting,
} from '../../src/schemas/index.js';

describe('NormalizedSpeakerSchema', () => {
  it('validates correct speaker', () => {
    const speaker = { id: 'spk-1', name: 'Alice' };
    const result = NormalizedSpeakerSchema.safeParse(speaker);
    expect(result.success).toBe(true);
  });

  it('rejects missing id', () => {
    const speaker = { name: 'Alice' };
    const result = NormalizedSpeakerSchema.safeParse(speaker);
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    const speaker = { id: 'spk-1' };
    const result = NormalizedSpeakerSchema.safeParse(speaker);
    expect(result.success).toBe(false);
  });
});

describe('NormalizedSentenceSchema', () => {
  const validSentence = {
    index: 0,
    speakerId: 'spk-1',
    speakerName: 'Alice',
    text: 'Hello world',
    rawText: 'Hello world',
    startTime: 0,
    endTime: 5,
  };

  it('validates correct sentence', () => {
    const result = NormalizedSentenceSchema.safeParse(validSentence);
    expect(result.success).toBe(true);
  });

  it('validates sentence with optional fields', () => {
    const sentence = {
      ...validSentence,
      sentiment: 'positive',
      isQuestion: true,
      isActionItem: false,
    };
    const result = NormalizedSentenceSchema.safeParse(sentence);
    expect(result.success).toBe(true);
  });

  it('rejects negative index', () => {
    const sentence = { ...validSentence, index: -1 };
    const result = NormalizedSentenceSchema.safeParse(sentence);
    expect(result.success).toBe(false);
  });

  it('rejects negative startTime', () => {
    const sentence = { ...validSentence, startTime: -1 };
    const result = NormalizedSentenceSchema.safeParse(sentence);
    expect(result.success).toBe(false);
  });

  it('rejects invalid sentiment', () => {
    const sentence = { ...validSentence, sentiment: 'happy' };
    const result = NormalizedSentenceSchema.safeParse(sentence);
    expect(result.success).toBe(false);
  });
});

describe('NormalizedSummarySchema', () => {
  it('validates empty summary', () => {
    const result = NormalizedSummarySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('validates full summary', () => {
    const summary = {
      overview: 'Meeting overview',
      keyPoints: ['Point 1', 'Point 2'],
      actionItems: 'Follow up on X',
      outline: 'Structured outline',
      topics: ['topic1', 'topic2'],
    };
    const result = NormalizedSummarySchema.safeParse(summary);
    expect(result.success).toBe(true);
  });

  it('validates partial summary', () => {
    const summary = { overview: 'Just an overview' };
    const result = NormalizedSummarySchema.safeParse(summary);
    expect(result.success).toBe(true);
  });
});

describe('NormalizedMeetingSchema', () => {
  const validMeeting = {
    id: 'fireflies:abc123',
    title: 'Team Meeting',
    date: new Date('2024-01-15T10:00:00Z'),
    duration: 3600,
    url: 'https://app.fireflies.ai/transcript/abc123',
    speakers: [{ id: 'spk-1', name: 'Alice' }],
    sentences: [
      {
        index: 0,
        speakerId: 'spk-1',
        speakerName: 'Alice',
        text: 'Hello',
        rawText: 'Hello',
        startTime: 0,
        endTime: 1,
      },
    ],
    participants: [{ name: 'Alice', email: 'alice@example.com', role: 'organizer' }],
    source: {
      provider: 'fireflies',
      originalId: 'abc123',
    },
  };

  it('validates correct normalized meeting', () => {
    const result = NormalizedMeetingSchema.safeParse(validMeeting);
    expect(result.success).toBe(true);
  });

  it('rejects invalid id prefix', () => {
    const meeting = { ...validMeeting, id: 'invalid:abc123' };
    const result = NormalizedMeetingSchema.safeParse(meeting);
    expect(result.success).toBe(false);
  });

  it('rejects non-positive duration', () => {
    const meeting = { ...validMeeting, duration: 0 };
    const result = NormalizedMeetingSchema.safeParse(meeting);
    expect(result.success).toBe(false);
  });

  it('rejects negative duration', () => {
    const meeting = { ...validMeeting, duration: -100 };
    const result = NormalizedMeetingSchema.safeParse(meeting);
    expect(result.success).toBe(false);
  });

  it('validates meeting with all optional fields', () => {
    const meeting = {
      ...validMeeting,
      summary: { overview: 'Test overview' },
      attendees: [{ name: 'Bob', joinTime: new Date(), leaveTime: new Date() }],
      channels: [{ id: 'ch-1', title: 'General', isPrivate: false }],
      analytics: { sentiments: { positive: 50, neutral: 30, negative: 20 } },
    };
    const result = NormalizedMeetingSchema.safeParse(meeting);
    expect(result.success).toBe(true);
  });

  it('allows optional fields to be missing', () => {
    const meeting = {
      id: 'fireflies:minimal',
      title: 'Minimal Meeting',
      date: new Date(),
      duration: 60,
      url: 'https://app.fireflies.ai/transcript/minimal',
      speakers: [],
      sentences: [],
      participants: [],
      source: { provider: 'fireflies', originalId: 'minimal' },
    };
    const result = NormalizedMeetingSchema.safeParse(meeting);
    expect(result.success).toBe(true);
  });

  it('validates nested arrays', () => {
    const meeting = {
      ...validMeeting,
      speakers: [
        { id: 'spk-1', name: 'Alice' },
        { id: 'spk-2', name: 'Bob' },
      ],
    };
    const result = NormalizedMeetingSchema.safeParse(meeting);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.speakers).toHaveLength(2);
    }
  });

  it('rejects invalid nested speaker', () => {
    const meeting = {
      ...validMeeting,
      speakers: [{ id: 'spk-1' }], // missing name
    };
    const result = NormalizedMeetingSchema.safeParse(meeting);
    expect(result.success).toBe(false);
  });
});

describe('parseNormalizedMeeting', () => {
  const validMeeting = {
    id: 'fireflies:parse-test',
    title: 'Parse Test',
    date: new Date(),
    duration: 60,
    url: 'https://app.fireflies.ai/transcript/parse-test',
    speakers: [],
    sentences: [],
    participants: [],
    source: { provider: 'fireflies', originalId: 'parse-test' },
  };

  it('returns validated meeting on success', () => {
    const result = parseNormalizedMeeting(validMeeting);
    expect(result.id).toBe('fireflies:parse-test');
  });

  it('throws on invalid data', () => {
    expect(() => parseNormalizedMeeting({ invalid: true })).toThrow();
  });
});

describe('safeParseNormalizedMeeting', () => {
  const validMeeting = {
    id: 'fireflies:safe-parse',
    title: 'Safe Parse Test',
    date: new Date(),
    duration: 60,
    url: 'https://app.fireflies.ai/transcript/safe-parse',
    speakers: [],
    sentences: [],
    participants: [],
    source: { provider: 'fireflies', originalId: 'safe-parse' },
  };

  it('returns success result on valid data', () => {
    const result = safeParseNormalizedMeeting(validMeeting);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('fireflies:safe-parse');
    }
  });

  it('returns error result on invalid data', () => {
    const result = safeParseNormalizedMeeting({ invalid: true });
    expect(result.success).toBe(false);
  });
});
