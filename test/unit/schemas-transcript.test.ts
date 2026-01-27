import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  AIAppOutputSchema,
  AIFilterSchema,
  AppsPreviewSchema,
  ChannelMemberSchema,
  ChannelSchema,
  MeetingAnalyticsSchema,
  MeetingAttendanceSchema,
  MeetingAttendeeSchema,
  MeetingInfoSchema,
  parseTranscript,
  SentenceSchema,
  SentimentsSchema,
  SpeakerSchema,
  SummarySchema,
  SummarySectionSchema,
  safeParseTranscript,
  TranscriptSchema,
  UserSchema,
} from '../../src/schemas/transcript.js';

describe('SpeakerSchema', () => {
  it('validates a valid speaker', () => {
    const speaker = { id: 'speaker1', name: 'Alice' };
    expect(SpeakerSchema.parse(speaker)).toEqual(speaker);
  });

  it('rejects speaker without id', () => {
    const speaker = { name: 'Alice' };
    expect(() => SpeakerSchema.parse(speaker)).toThrow(z.ZodError);
  });

  it('rejects speaker without name', () => {
    const speaker = { id: 'speaker1' };
    expect(() => SpeakerSchema.parse(speaker)).toThrow(z.ZodError);
  });
});

describe('AIFilterSchema', () => {
  it('validates with all optional fields', () => {
    const filter = {
      task: 'Review PR',
      pricing: '100 USD',
      metric: '50% improvement',
      question: 'Is this ready?',
      date_and_time: 'Friday at 3pm',
      text_cleanup: 'cleaned text',
      sentiment: 'positive',
    };
    expect(AIFilterSchema.parse(filter)).toEqual(filter);
  });

  it('validates empty object', () => {
    expect(AIFilterSchema.parse({})).toEqual({});
  });

  it('validates with partial fields', () => {
    const filter = { task: 'Do something', sentiment: 'negative' };
    expect(AIFilterSchema.parse(filter)).toEqual(filter);
  });
});

describe('SentenceSchema', () => {
  const validSentence = {
    index: 0,
    text: 'Hello, world!',
    raw_text: 'hello world',
    start_time: '0.5',
    end_time: '2.5',
    speaker_id: 'speaker1',
    speaker_name: 'Alice',
  };

  it('validates a valid sentence', () => {
    expect(SentenceSchema.parse(validSentence)).toEqual(validSentence);
  });

  it('validates sentence with ai_filters', () => {
    const sentence = {
      ...validSentence,
      ai_filters: { task: 'Review code', sentiment: 'neutral' },
    };
    expect(SentenceSchema.parse(sentence)).toEqual(sentence);
  });

  it('rejects sentence with negative index', () => {
    const sentence = { ...validSentence, index: -1 };
    expect(() => SentenceSchema.parse(sentence)).toThrow(z.ZodError);
  });

  it('rejects sentence without required fields', () => {
    const { text, ...incomplete } = validSentence;
    expect(() => SentenceSchema.parse(incomplete)).toThrow(z.ZodError);
  });
});

describe('SummarySectionSchema', () => {
  it('validates valid section', () => {
    const section = { title: 'Key Points', content: 'Some content' };
    expect(SummarySectionSchema.parse(section)).toEqual(section);
  });

  it('rejects section without title', () => {
    expect(() => SummarySectionSchema.parse({ content: 'text' })).toThrow(z.ZodError);
  });
});

describe('SummarySchema', () => {
  it('validates with all optional fields', () => {
    const summary = {
      action_items: '- Do something',
      keywords: 'key, words',
      outline: '1. First\n2. Second',
      overview: 'Meeting overview',
      shorthand_bullet: '- Bullet point',
      notes: 'Detailed notes',
      gist: 'Brief gist',
      bullet_gist: '- Quick point',
      short_summary: 'Short summary',
      short_overview: 'Short overview',
      meeting_type: 'standup',
      topics_discussed: ['topic1', 'topic2'],
      transcript_chapters: ['intro', 'main'],
      extended_sections: [{ title: 'Custom', content: 'Data' }],
    };
    expect(SummarySchema.parse(summary)).toEqual(summary);
  });

  it('validates empty summary', () => {
    expect(SummarySchema.parse({})).toEqual({});
  });
});

describe('MeetingAttendeeSchema', () => {
  it('validates with required fields', () => {
    const attendee = {
      displayName: 'Alice Smith',
      email: 'alice@example.com',
      name: 'Alice',
    };
    expect(MeetingAttendeeSchema.parse(attendee)).toEqual(attendee);
  });

  it('validates with optional fields', () => {
    const attendee = {
      displayName: 'Alice Smith',
      email: 'alice@example.com',
      name: 'Alice',
      phoneNumber: '+1234567890',
      location: 'New York',
    };
    expect(MeetingAttendeeSchema.parse(attendee)).toEqual(attendee);
  });

  it('rejects without required name', () => {
    const attendee = { displayName: 'Alice', email: 'alice@example.com' };
    expect(() => MeetingAttendeeSchema.parse(attendee)).toThrow(z.ZodError);
  });
});

describe('MeetingAttendanceSchema', () => {
  it('validates with required fields', () => {
    const attendance = {
      name: 'Alice',
      join_time: '2024-01-15T10:00:00Z',
    };
    expect(MeetingAttendanceSchema.parse(attendance)).toEqual(attendance);
  });

  it('validates with optional leave_time', () => {
    const attendance = {
      name: 'Alice',
      join_time: '2024-01-15T10:00:00Z',
      leave_time: '2024-01-15T11:00:00Z',
    };
    expect(MeetingAttendanceSchema.parse(attendance)).toEqual(attendance);
  });
});

describe('MeetingInfoSchema', () => {
  it('validates with valid summary status', () => {
    const info = {
      fred_joined: true,
      silent_meeting: false,
      summary_status: 'processed',
    };
    expect(MeetingInfoSchema.parse(info)).toEqual(info);
  });

  it('validates all summary status values', () => {
    for (const status of ['processing', 'processed', 'failed', 'skipped']) {
      const info = { fred_joined: true, silent_meeting: false, summary_status: status };
      expect(MeetingInfoSchema.parse(info)).toEqual(info);
    }
  });

  it('rejects invalid summary status', () => {
    const info = { fred_joined: true, silent_meeting: false, summary_status: 'invalid' };
    expect(() => MeetingInfoSchema.parse(info)).toThrow(z.ZodError);
  });
});

describe('ChannelMemberSchema', () => {
  it('validates valid channel member', () => {
    const member = {
      user_id: 'user123',
      email: 'user@example.com',
      name: 'User Name',
    };
    expect(ChannelMemberSchema.parse(member)).toEqual(member);
  });
});

describe('ChannelSchema', () => {
  it('validates with required fields', () => {
    const channel = { id: 'channel1', title: 'General' };
    expect(ChannelSchema.parse(channel)).toEqual(channel);
  });

  it('validates with all optional fields', () => {
    const channel = {
      id: 'channel1',
      title: 'General',
      is_private: true,
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-16T12:00:00Z',
      created_by: 'user123',
      members: [{ user_id: 'u1', email: 'a@b.com', name: 'Alice' }],
    };
    expect(ChannelSchema.parse(channel)).toEqual(channel);
  });
});

describe('AIAppOutputSchema', () => {
  it('validates with all optional fields', () => {
    const output = {
      transcript_id: 't123',
      user_id: 'u456',
      app_id: 'app789',
      created_at: 1705320000,
      title: 'App Title',
      prompt: 'Generate summary',
      response: 'Here is the summary...',
    };
    expect(AIAppOutputSchema.parse(output)).toEqual(output);
  });

  it('validates empty object', () => {
    expect(AIAppOutputSchema.parse({})).toEqual({});
  });
});

describe('AppsPreviewSchema', () => {
  it('validates with outputs array', () => {
    const preview = {
      outputs: [{ title: 'App1', response: 'Response1' }],
    };
    expect(AppsPreviewSchema.parse(preview)).toEqual(preview);
  });

  it('validates with empty outputs', () => {
    const preview = { outputs: [] };
    expect(AppsPreviewSchema.parse(preview)).toEqual(preview);
  });
});

describe('SentimentsSchema', () => {
  it('validates valid percentages', () => {
    const sentiments = {
      negative_pct: 10,
      neutral_pct: 60,
      positive_pct: 30,
    };
    expect(SentimentsSchema.parse(sentiments)).toEqual(sentiments);
  });

  it('validates boundary values (0 and 100)', () => {
    const sentiments = { negative_pct: 0, neutral_pct: 0, positive_pct: 100 };
    expect(SentimentsSchema.parse(sentiments)).toEqual(sentiments);
  });

  it('rejects negative percentage', () => {
    const sentiments = { negative_pct: -5, neutral_pct: 50, positive_pct: 55 };
    expect(() => SentimentsSchema.parse(sentiments)).toThrow(z.ZodError);
  });

  it('rejects percentage over 100', () => {
    const sentiments = { negative_pct: 10, neutral_pct: 50, positive_pct: 101 };
    expect(() => SentimentsSchema.parse(sentiments)).toThrow(z.ZodError);
  });
});

describe('MeetingAnalyticsSchema', () => {
  it('validates with sentiments', () => {
    const analytics = {
      sentiments: { negative_pct: 10, neutral_pct: 60, positive_pct: 30 },
    };
    expect(MeetingAnalyticsSchema.parse(analytics)).toEqual(analytics);
  });

  it('validates empty analytics', () => {
    expect(MeetingAnalyticsSchema.parse({})).toEqual({});
  });
});

describe('UserSchema', () => {
  it('validates with required fields', () => {
    const user = {
      user_id: 'user123',
      email: 'user@example.com',
    };
    expect(UserSchema.parse(user)).toEqual(user);
  });

  it('validates with all optional fields', () => {
    const user = {
      user_id: 'user123',
      email: 'user@example.com',
      name: 'John Doe',
      num_transcripts: 42,
      is_admin: true,
    };
    expect(UserSchema.parse(user)).toEqual(user);
  });
});

describe('TranscriptSchema', () => {
  const minimalTranscript = {
    id: 'transcript123',
    title: 'Team Meeting',
    organizer_email: 'org@example.com',
    speakers: [{ id: 's1', name: 'Alice' }],
    transcript_url: 'https://app.fireflies.ai/view/transcript123',
    participants: ['alice@example.com'],
    meeting_attendees: [],
    meeting_attendance: [],
    fireflies_users: ['u1'],
    workspace_users: [],
    duration: 30,
    dateString: '2024-01-15',
    date: 1705320000000,
    sentences: [],
    channels: [],
  };

  it('validates minimal transcript', () => {
    expect(TranscriptSchema.parse(minimalTranscript)).toEqual(minimalTranscript);
  });

  it('validates transcript with all optional fields', () => {
    const fullTranscript = {
      ...minimalTranscript,
      host_email: 'host@example.com',
      user: { user_id: 'u1', email: 'user@example.com' },
      audio_url: 'https://example.com/audio.mp3',
      video_url: 'https://example.com/video.mp4',
      calendar_id: 'cal123',
      cal_id: 'cal456',
      calendar_type: 'google',
      meeting_link: 'https://meet.google.com/abc',
      summary: { overview: 'Meeting overview' },
      meeting_info: { fred_joined: true, silent_meeting: false, summary_status: 'processed' },
      apps_preview: { outputs: [] },
      analytics: { sentiments: { negative_pct: 10, neutral_pct: 60, positive_pct: 30 } },
    };
    expect(TranscriptSchema.parse(fullTranscript)).toMatchObject(fullTranscript);
  });

  it('validates transcript with sentences', () => {
    const transcript = {
      ...minimalTranscript,
      sentences: [
        {
          index: 0,
          text: 'Hello!',
          raw_text: 'hello',
          start_time: '0.0',
          end_time: '1.0',
          speaker_id: 's1',
          speaker_name: 'Alice',
        },
      ],
    };
    expect(TranscriptSchema.parse(transcript)).toEqual(transcript);
  });

  it('rejects transcript without required id', () => {
    const { id, ...incomplete } = minimalTranscript;
    expect(() => TranscriptSchema.parse(incomplete)).toThrow(z.ZodError);
  });
});

describe('parseTranscript', () => {
  const validTranscript = {
    id: 't1',
    title: 'Test',
    organizer_email: 'test@example.com',
    speakers: [],
    transcript_url: 'https://app.fireflies.ai/view/t1',
    participants: [],
    meeting_attendees: [],
    meeting_attendance: [],
    fireflies_users: [],
    workspace_users: [],
    duration: 10,
    dateString: '2024-01-01',
    date: 1704067200000,
    sentences: [],
    channels: [],
  };

  it('returns parsed transcript for valid data', () => {
    const result = parseTranscript(validTranscript);
    expect(result.id).toBe('t1');
    expect(result.title).toBe('Test');
  });

  it('throws ZodError for invalid data', () => {
    expect(() => parseTranscript({ invalid: 'data' })).toThrow(z.ZodError);
  });
});

describe('safeParseTranscript', () => {
  const validTranscript = {
    id: 't1',
    title: 'Test',
    organizer_email: 'test@example.com',
    speakers: [],
    transcript_url: 'https://app.fireflies.ai/view/t1',
    participants: [],
    meeting_attendees: [],
    meeting_attendance: [],
    fireflies_users: [],
    workspace_users: [],
    duration: 10,
    dateString: '2024-01-01',
    date: 1704067200000,
    sentences: [],
    channels: [],
  };

  it('returns success result for valid data', () => {
    const result = safeParseTranscript(validTranscript);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('t1');
    }
  });

  it('returns error result for invalid data', () => {
    const result = safeParseTranscript({ invalid: 'data' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(z.ZodError);
    }
  });
});
