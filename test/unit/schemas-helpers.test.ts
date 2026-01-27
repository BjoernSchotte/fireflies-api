import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ActionItemSchema,
  ActionItemsResultSchema,
  parseActionItemsResult,
  parseSpeakerAnalytics,
  SpeakerAnalyticsSchema,
  SpeakerStatsSchema,
  safeParseActionItemsResult,
  safeParseSpeakerAnalytics,
} from '../../src/schemas/helpers.js';

describe('ActionItemSchema', () => {
  it('validates with required fields only', () => {
    const item = { text: 'Review PR', lineNumber: 1 };
    expect(ActionItemSchema.parse(item)).toEqual(item);
  });

  it('validates with all optional fields', () => {
    const item = {
      text: 'Review PR',
      assignee: 'Alice',
      dueDate: 'Friday',
      lineNumber: 3,
      sourceSentence: {
        speakerName: 'Bob',
        text: 'Alice should review the PR by Friday',
        startTime: 125.5,
      },
    };
    expect(ActionItemSchema.parse(item)).toEqual(item);
  });

  it('rejects lineNumber less than 1', () => {
    const item = { text: 'Do something', lineNumber: 0 };
    expect(() => ActionItemSchema.parse(item)).toThrow(z.ZodError);
  });

  it('rejects negative lineNumber', () => {
    const item = { text: 'Do something', lineNumber: -1 };
    expect(() => ActionItemSchema.parse(item)).toThrow(z.ZodError);
  });

  it('rejects without text', () => {
    const item = { lineNumber: 1 };
    expect(() => ActionItemSchema.parse(item)).toThrow(z.ZodError);
  });
});

describe('ActionItemsResultSchema', () => {
  const validResult = {
    items: [{ text: 'Do task', lineNumber: 1 }],
    totalItems: 1,
    assignedItems: 0,
    datedItems: 0,
    assignees: [],
  };

  it('validates valid result', () => {
    expect(ActionItemsResultSchema.parse(validResult)).toEqual(validResult);
  });

  it('validates empty result', () => {
    const empty = {
      items: [],
      totalItems: 0,
      assignedItems: 0,
      datedItems: 0,
      assignees: [],
    };
    expect(ActionItemsResultSchema.parse(empty)).toEqual(empty);
  });

  it('validates result with assignees', () => {
    const result = {
      items: [
        { text: 'Task for Alice', lineNumber: 1, assignee: 'Alice' },
        { text: 'Task for Bob', lineNumber: 2, assignee: 'Bob' },
      ],
      totalItems: 2,
      assignedItems: 2,
      datedItems: 0,
      assignees: ['Alice', 'Bob'],
    };
    expect(ActionItemsResultSchema.parse(result)).toEqual(result);
  });

  it('rejects negative totalItems', () => {
    const result = { ...validResult, totalItems: -1 };
    expect(() => ActionItemsResultSchema.parse(result)).toThrow(z.ZodError);
  });

  it('rejects negative assignedItems', () => {
    const result = { ...validResult, assignedItems: -1 };
    expect(() => ActionItemsResultSchema.parse(result)).toThrow(z.ZodError);
  });
});

describe('SpeakerStatsSchema', () => {
  const validStats = {
    name: 'Alice',
    id: 'speaker1',
    talkTime: 120.5,
    talkTimePercentage: 45,
    sentenceCount: 20,
    wordCount: 500,
    wordsPerMinute: 150,
    averageSentenceLength: 25,
    turnCount: 8,
  };

  it('validates valid stats', () => {
    expect(SpeakerStatsSchema.parse(validStats)).toEqual(validStats);
  });

  it('validates with zero values', () => {
    const stats = {
      name: 'Silent',
      id: 'speaker2',
      talkTime: 0,
      talkTimePercentage: 0,
      sentenceCount: 0,
      wordCount: 0,
      wordsPerMinute: 0,
      averageSentenceLength: 0,
      turnCount: 0,
    };
    expect(SpeakerStatsSchema.parse(stats)).toEqual(stats);
  });

  it('rejects talkTimePercentage over 100', () => {
    const stats = { ...validStats, talkTimePercentage: 101 };
    expect(() => SpeakerStatsSchema.parse(stats)).toThrow(z.ZodError);
  });

  it('rejects negative talkTime', () => {
    const stats = { ...validStats, talkTime: -10 };
    expect(() => SpeakerStatsSchema.parse(stats)).toThrow(z.ZodError);
  });

  it('rejects non-integer sentenceCount', () => {
    const stats = { ...validStats, sentenceCount: 20.5 };
    expect(() => SpeakerStatsSchema.parse(stats)).toThrow(z.ZodError);
  });

  it('rejects without required name', () => {
    const { name, ...noName } = validStats;
    expect(() => SpeakerStatsSchema.parse(noName)).toThrow(z.ZodError);
  });
});

describe('SpeakerAnalyticsSchema', () => {
  const validAnalytics = {
    speakers: [
      {
        name: 'Alice',
        id: 's1',
        talkTime: 60,
        talkTimePercentage: 50,
        sentenceCount: 10,
        wordCount: 250,
        wordsPerMinute: 150,
        averageSentenceLength: 25,
        turnCount: 5,
      },
      {
        name: 'Bob',
        id: 's2',
        talkTime: 60,
        talkTimePercentage: 50,
        sentenceCount: 10,
        wordCount: 250,
        wordsPerMinute: 150,
        averageSentenceLength: 25,
        turnCount: 5,
      },
    ],
    totalDuration: 180,
    totalTalkTime: 120,
    totalSentences: 20,
    totalWords: 500,
    dominantSpeaker: 'Alice',
    dominantSpeakerPercentage: 50,
    balance: 'balanced',
  };

  it('validates valid analytics', () => {
    expect(SpeakerAnalyticsSchema.parse(validAnalytics)).toEqual(validAnalytics);
  });

  it('validates all balance values', () => {
    for (const balance of ['balanced', 'unbalanced', 'dominated']) {
      const analytics = { ...validAnalytics, balance };
      expect(SpeakerAnalyticsSchema.parse(analytics).balance).toBe(balance);
    }
  });

  it('validates empty speakers array', () => {
    const analytics = {
      speakers: [],
      totalDuration: 0,
      totalTalkTime: 0,
      totalSentences: 0,
      totalWords: 0,
      dominantSpeaker: '',
      dominantSpeakerPercentage: 0,
      balance: 'balanced',
    };
    expect(SpeakerAnalyticsSchema.parse(analytics)).toEqual(analytics);
  });

  it('rejects invalid balance value', () => {
    const analytics = { ...validAnalytics, balance: 'invalid' };
    expect(() => SpeakerAnalyticsSchema.parse(analytics)).toThrow(z.ZodError);
  });

  it('rejects dominantSpeakerPercentage over 100', () => {
    const analytics = { ...validAnalytics, dominantSpeakerPercentage: 105 };
    expect(() => SpeakerAnalyticsSchema.parse(analytics)).toThrow(z.ZodError);
  });

  it('rejects negative totalDuration', () => {
    const analytics = { ...validAnalytics, totalDuration: -10 };
    expect(() => SpeakerAnalyticsSchema.parse(analytics)).toThrow(z.ZodError);
  });
});

describe('parseActionItemsResult', () => {
  const validResult = {
    items: [],
    totalItems: 0,
    assignedItems: 0,
    datedItems: 0,
    assignees: [],
  };

  it('returns parsed result for valid data', () => {
    const result = parseActionItemsResult(validResult);
    expect(result.totalItems).toBe(0);
  });

  it('throws ZodError for invalid data', () => {
    expect(() => parseActionItemsResult({ invalid: 'data' })).toThrow(z.ZodError);
  });
});

describe('safeParseActionItemsResult', () => {
  const validResult = {
    items: [],
    totalItems: 0,
    assignedItems: 0,
    datedItems: 0,
    assignees: [],
  };

  it('returns success for valid data', () => {
    const result = safeParseActionItemsResult(validResult);
    expect(result.success).toBe(true);
  });

  it('returns error for invalid data', () => {
    const result = safeParseActionItemsResult({ invalid: 'data' });
    expect(result.success).toBe(false);
  });
});

describe('parseSpeakerAnalytics', () => {
  const validAnalytics = {
    speakers: [],
    totalDuration: 0,
    totalTalkTime: 0,
    totalSentences: 0,
    totalWords: 0,
    dominantSpeaker: '',
    dominantSpeakerPercentage: 0,
    balance: 'balanced',
  };

  it('returns parsed analytics for valid data', () => {
    const result = parseSpeakerAnalytics(validAnalytics);
    expect(result.totalDuration).toBe(0);
  });

  it('throws ZodError for invalid data', () => {
    expect(() => parseSpeakerAnalytics({ invalid: 'data' })).toThrow(z.ZodError);
  });
});

describe('safeParseSpeakerAnalytics', () => {
  const validAnalytics = {
    speakers: [],
    totalDuration: 0,
    totalTalkTime: 0,
    totalSentences: 0,
    totalWords: 0,
    dominantSpeaker: '',
    dominantSpeakerPercentage: 0,
    balance: 'balanced',
  };

  it('returns success for valid data', () => {
    const result = safeParseSpeakerAnalytics(validAnalytics);
    expect(result.success).toBe(true);
  });

  it('returns error for invalid data', () => {
    const result = safeParseSpeakerAnalytics({ invalid: 'data' });
    expect(result.success).toBe(false);
  });
});
