import { describe, expect, it } from 'vitest';
import { analyzeMeetings } from '../../src/helpers/meeting-insights.js';
import type { Sentence, Transcript } from '../../src/types/transcript.js';

function createTranscript(overrides: Partial<Transcript> = {}): Transcript {
  return {
    id: 'test-id',
    title: 'Test Meeting',
    organizer_email: 'host@company.com',
    speakers: [],
    transcript_url: 'https://app.fireflies.ai/transcript/test-id',
    participants: [],
    meeting_attendees: [],
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
    speaker_name: 'Speaker 1',
    ...overrides,
  };
}

describe('analyzeMeetings', () => {
  describe('summary stats', () => {
    it('calculates total and average duration', () => {
      const transcripts = [
        createTranscript({ duration: 60 }), // 60 min
        createTranscript({ duration: 30 }), // 30 min
        createTranscript({ duration: 90 }), // 90 min
      ];

      const insights = analyzeMeetings(transcripts);

      expect(insights.totalDurationMinutes).toBe(180);
      expect(insights.averageDurationMinutes).toBe(60);
    });

    it('counts total meetings', () => {
      const transcripts = [createTranscript(), createTranscript(), createTranscript()];

      const insights = analyzeMeetings(transcripts);

      expect(insights.totalMeetings).toBe(3);
    });

    it('handles empty array', () => {
      const insights = analyzeMeetings([]);

      expect(insights.totalMeetings).toBe(0);
      expect(insights.totalDurationMinutes).toBe(0);
      expect(insights.averageDurationMinutes).toBe(0);
      expect(insights.totalUniqueParticipants).toBe(0);
      expect(insights.totalUniqueSpeakers).toBe(0);
      expect(insights.earliestMeeting).toBe('');
      expect(insights.latestMeeting).toBe('');
    });
  });

  describe('day of week distribution', () => {
    it('groups meetings by day of week', () => {
      const transcripts = [
        // Monday
        createTranscript({ dateString: '2024-01-15T10:00:00Z', duration: 60 }),
        createTranscript({ dateString: '2024-01-15T14:00:00Z', duration: 30 }),
        // Tuesday
        createTranscript({ dateString: '2024-01-16T10:00:00Z', duration: 45 }),
        // Wednesday
        createTranscript({ dateString: '2024-01-17T10:00:00Z', duration: 60 }),
      ];

      const insights = analyzeMeetings(transcripts);

      expect(insights.byDayOfWeek.monday.count).toBe(2);
      expect(insights.byDayOfWeek.tuesday.count).toBe(1);
      expect(insights.byDayOfWeek.wednesday.count).toBe(1);
      expect(insights.byDayOfWeek.thursday.count).toBe(0);
      expect(insights.byDayOfWeek.friday.count).toBe(0);
      expect(insights.byDayOfWeek.saturday.count).toBe(0);
      expect(insights.byDayOfWeek.sunday.count).toBe(0);
    });

    it('sums duration per day', () => {
      const transcripts = [
        // Monday
        createTranscript({ dateString: '2024-01-15T10:00:00Z', duration: 60 }),
        createTranscript({ dateString: '2024-01-15T14:00:00Z', duration: 30 }),
        // Tuesday
        createTranscript({ dateString: '2024-01-16T10:00:00Z', duration: 45 }),
      ];

      const insights = analyzeMeetings(transcripts);

      expect(insights.byDayOfWeek.monday.totalMinutes).toBe(90);
      expect(insights.byDayOfWeek.tuesday.totalMinutes).toBe(45);
    });
  });

  describe('time grouping', () => {
    it('groups by day when groupBy=day', () => {
      const transcripts = [
        createTranscript({ dateString: '2024-01-15T10:00:00Z', duration: 60 }),
        createTranscript({ dateString: '2024-01-15T14:00:00Z', duration: 30 }),
        createTranscript({ dateString: '2024-01-16T10:00:00Z', duration: 45 }),
      ];

      const insights = analyzeMeetings(transcripts, { groupBy: 'day' });

      expect(insights.byTimeGroup).toBeDefined();
      expect(insights.byTimeGroup).toHaveLength(2);

      const jan15 = insights.byTimeGroup?.find((g) => g.period === '2024-01-15');
      const jan16 = insights.byTimeGroup?.find((g) => g.period === '2024-01-16');

      expect(jan15?.count).toBe(2);
      expect(jan15?.totalMinutes).toBe(90);
      expect(jan15?.averageMinutes).toBe(45);

      expect(jan16?.count).toBe(1);
      expect(jan16?.totalMinutes).toBe(45);
      expect(jan16?.averageMinutes).toBe(45);
    });

    it('groups by ISO week when groupBy=week', () => {
      const transcripts = [
        // Week 3 of 2024 (Jan 15-21)
        createTranscript({ dateString: '2024-01-15T10:00:00Z', duration: 60 }),
        createTranscript({ dateString: '2024-01-16T10:00:00Z', duration: 30 }),
        // Week 4 of 2024 (Jan 22-28)
        createTranscript({ dateString: '2024-01-22T10:00:00Z', duration: 45 }),
      ];

      const insights = analyzeMeetings(transcripts, { groupBy: 'week' });

      expect(insights.byTimeGroup).toBeDefined();
      expect(insights.byTimeGroup).toHaveLength(2);

      const week3 = insights.byTimeGroup?.find((g) => g.period === '2024-W03');
      const week4 = insights.byTimeGroup?.find((g) => g.period === '2024-W04');

      expect(week3?.count).toBe(2);
      expect(week3?.totalMinutes).toBe(90);

      expect(week4?.count).toBe(1);
      expect(week4?.totalMinutes).toBe(45);
    });

    it('groups by month when groupBy=month', () => {
      const transcripts = [
        // January
        createTranscript({ dateString: '2024-01-15T10:00:00Z', duration: 60 }),
        createTranscript({ dateString: '2024-01-20T10:00:00Z', duration: 30 }),
        // February
        createTranscript({ dateString: '2024-02-10T10:00:00Z', duration: 45 }),
      ];

      const insights = analyzeMeetings(transcripts, { groupBy: 'month' });

      expect(insights.byTimeGroup).toBeDefined();
      expect(insights.byTimeGroup).toHaveLength(2);

      const jan = insights.byTimeGroup?.find((g) => g.period === '2024-01');
      const feb = insights.byTimeGroup?.find((g) => g.period === '2024-02');

      expect(jan?.count).toBe(2);
      expect(jan?.totalMinutes).toBe(90);
      expect(jan?.averageMinutes).toBe(45);

      expect(feb?.count).toBe(1);
      expect(feb?.totalMinutes).toBe(45);
    });

    it('returns undefined byTimeGroup when no groupBy specified', () => {
      const transcripts = [createTranscript()];

      const insights = analyzeMeetings(transcripts);

      expect(insights.byTimeGroup).toBeUndefined();
    });

    it('sorts time groups chronologically', () => {
      const transcripts = [
        createTranscript({ dateString: '2024-02-10T10:00:00Z' }),
        createTranscript({ dateString: '2024-01-15T10:00:00Z' }),
        createTranscript({ dateString: '2024-03-05T10:00:00Z' }),
      ];

      const insights = analyzeMeetings(transcripts, { groupBy: 'month' });

      expect(insights.byTimeGroup?.[0]?.period).toBe('2024-01');
      expect(insights.byTimeGroup?.[1]?.period).toBe('2024-02');
      expect(insights.byTimeGroup?.[2]?.period).toBe('2024-03');
    });
  });

  describe('participant stats', () => {
    it('counts unique participants', () => {
      const transcripts = [
        createTranscript({
          participants: ['alice@company.com', 'bob@company.com'],
        }),
        createTranscript({
          participants: ['alice@company.com', 'charlie@company.com'],
        }),
      ];

      const insights = analyzeMeetings(transcripts);

      expect(insights.totalUniqueParticipants).toBe(3); // alice, bob, charlie
    });

    it('calculates average participants per meeting', () => {
      const transcripts = [
        createTranscript({
          participants: ['alice@company.com', 'bob@company.com'],
        }), // 2
        createTranscript({
          participants: ['alice@company.com', 'bob@company.com', 'charlie@company.com'],
        }), // 3
      ];

      const insights = analyzeMeetings(transcripts);

      expect(insights.averageParticipantsPerMeeting).toBe(2.5);
    });

    it('ranks participants by meeting count', () => {
      const transcripts = [
        createTranscript({
          participants: ['alice@company.com', 'bob@company.com'],
          duration: 60,
        }),
        createTranscript({
          participants: ['alice@company.com', 'charlie@company.com'],
          duration: 30,
        }),
        createTranscript({
          participants: ['alice@company.com'],
          duration: 45,
        }),
      ];

      const insights = analyzeMeetings(transcripts);

      expect(insights.topParticipants[0]?.email).toBe('alice@company.com');
      expect(insights.topParticipants[0]?.meetingCount).toBe(3);
      expect(insights.topParticipants[0]?.totalMinutes).toBe(135);

      expect(insights.topParticipants[1]?.meetingCount).toBe(1);
    });

    it('respects topParticipantsCount limit', () => {
      const transcripts = [
        createTranscript({
          participants: [
            'a@company.com',
            'b@company.com',
            'c@company.com',
            'd@company.com',
            'e@company.com',
          ],
        }),
      ];

      const insights = analyzeMeetings(transcripts, { topParticipantsCount: 3 });

      expect(insights.topParticipants).toHaveLength(3);
    });

    it('uses default topParticipantsCount of 10', () => {
      const participants = Array.from({ length: 15 }, (_, i) => `user${i}@company.com`);
      const transcripts = [createTranscript({ participants })];

      const insights = analyzeMeetings(transcripts);

      expect(insights.topParticipants).toHaveLength(10);
    });
  });

  describe('speaker stats', () => {
    it('aggregates talk time from sentences', () => {
      const transcripts = [
        createTranscript({
          sentences: [
            createSentence({
              speaker_name: 'Alice',
              start_time: '0.0',
              end_time: '30.0',
            }), // 30s
            createSentence({
              speaker_name: 'Alice',
              start_time: '30.0',
              end_time: '60.0',
            }), // 30s
            createSentence({
              speaker_name: 'Bob',
              start_time: '60.0',
              end_time: '90.0',
            }), // 30s
          ],
        }),
      ];

      const insights = analyzeMeetings(transcripts);

      const alice = insights.topSpeakers.find((s) => s.name === 'Alice');
      const bob = insights.topSpeakers.find((s) => s.name === 'Bob');

      expect(alice?.totalTalkTimeSeconds).toBe(60);
      expect(bob?.totalTalkTimeSeconds).toBe(30);
    });

    it('counts meetings per speaker', () => {
      const transcripts = [
        createTranscript({
          id: 'meeting-1',
          sentences: [
            createSentence({ speaker_name: 'Alice', start_time: '0.0', end_time: '10.0' }),
          ],
        }),
        createTranscript({
          id: 'meeting-2',
          sentences: [
            createSentence({ speaker_name: 'Alice', start_time: '0.0', end_time: '10.0' }),
            createSentence({ speaker_name: 'Bob', start_time: '10.0', end_time: '20.0' }),
          ],
        }),
      ];

      const insights = analyzeMeetings(transcripts);

      const alice = insights.topSpeakers.find((s) => s.name === 'Alice');
      const bob = insights.topSpeakers.find((s) => s.name === 'Bob');

      expect(alice?.meetingCount).toBe(2);
      expect(bob?.meetingCount).toBe(1);
    });

    it('calculates average talk time per meeting', () => {
      const transcripts = [
        createTranscript({
          id: 'meeting-1',
          sentences: [
            createSentence({ speaker_name: 'Alice', start_time: '0.0', end_time: '60.0' }), // 60s
          ],
        }),
        createTranscript({
          id: 'meeting-2',
          sentences: [
            createSentence({ speaker_name: 'Alice', start_time: '0.0', end_time: '30.0' }), // 30s
          ],
        }),
      ];

      const insights = analyzeMeetings(transcripts);

      const alice = insights.topSpeakers.find((s) => s.name === 'Alice');

      expect(alice?.totalTalkTimeSeconds).toBe(90);
      expect(alice?.meetingCount).toBe(2);
      expect(alice?.averageTalkTimeSeconds).toBe(45);
    });

    it('filters by speakers option', () => {
      const transcripts = [
        createTranscript({
          sentences: [
            createSentence({ speaker_name: 'Alice', start_time: '0.0', end_time: '60.0' }),
            createSentence({ speaker_name: 'Bob', start_time: '60.0', end_time: '120.0' }),
            createSentence({ speaker_name: 'Charlie', start_time: '120.0', end_time: '180.0' }),
          ],
        }),
      ];

      const insights = analyzeMeetings(transcripts, { speakers: ['Alice', 'Charlie'] });

      expect(insights.topSpeakers).toHaveLength(2);
      expect(insights.topSpeakers.some((s) => s.name === 'Alice')).toBe(true);
      expect(insights.topSpeakers.some((s) => s.name === 'Charlie')).toBe(true);
      expect(insights.topSpeakers.some((s) => s.name === 'Bob')).toBe(false);
    });

    it('respects topSpeakersCount limit', () => {
      const sentences = Array.from({ length: 15 }, (_, i) =>
        createSentence({
          speaker_name: `Speaker${i}`,
          start_time: `${i * 10}.0`,
          end_time: `${(i + 1) * 10}.0`,
        })
      );
      const transcripts = [createTranscript({ sentences })];

      const insights = analyzeMeetings(transcripts, { topSpeakersCount: 5 });

      expect(insights.topSpeakers).toHaveLength(5);
    });

    it('uses default topSpeakersCount of 10', () => {
      const sentences = Array.from({ length: 15 }, (_, i) =>
        createSentence({
          speaker_name: `Speaker${i}`,
          start_time: `${i * 10}.0`,
          end_time: `${(i + 1) * 10}.0`,
        })
      );
      const transcripts = [createTranscript({ sentences })];

      const insights = analyzeMeetings(transcripts);

      expect(insights.topSpeakers).toHaveLength(10);
    });

    it('counts unique speakers correctly', () => {
      const transcripts = [
        createTranscript({
          sentences: [
            createSentence({ speaker_name: 'Alice' }),
            createSentence({ speaker_name: 'Bob' }),
          ],
        }),
        createTranscript({
          sentences: [
            createSentence({ speaker_name: 'Alice' }),
            createSentence({ speaker_name: 'Charlie' }),
          ],
        }),
      ];

      const insights = analyzeMeetings(transcripts);

      expect(insights.totalUniqueSpeakers).toBe(3); // Alice, Bob, Charlie
    });

    it('handles transcripts without sentences', () => {
      const transcripts = [
        createTranscript({ sentences: [] }),
        createTranscript({ sentences: undefined as unknown as Sentence[] }),
      ];

      const insights = analyzeMeetings(transcripts);

      expect(insights.totalUniqueSpeakers).toBe(0);
      expect(insights.topSpeakers).toHaveLength(0);
    });

    it('sorts speakers by total talk time descending', () => {
      const transcripts = [
        createTranscript({
          sentences: [
            createSentence({ speaker_name: 'Alice', start_time: '0.0', end_time: '10.0' }), // 10s
            createSentence({ speaker_name: 'Bob', start_time: '10.0', end_time: '50.0' }), // 40s
            createSentence({ speaker_name: 'Charlie', start_time: '50.0', end_time: '70.0' }), // 20s
          ],
        }),
      ];

      const insights = analyzeMeetings(transcripts);

      expect(insights.topSpeakers[0]?.name).toBe('Bob');
      expect(insights.topSpeakers[1]?.name).toBe('Charlie');
      expect(insights.topSpeakers[2]?.name).toBe('Alice');
    });
  });

  describe('date range', () => {
    it('finds earliest and latest meeting dates', () => {
      const transcripts = [
        createTranscript({ dateString: '2024-02-15T10:00:00Z' }),
        createTranscript({ dateString: '2024-01-10T10:00:00Z' }),
        createTranscript({ dateString: '2024-03-20T10:00:00Z' }),
      ];

      const insights = analyzeMeetings(transcripts);

      expect(insights.earliestMeeting).toBe('2024-01-10');
      expect(insights.latestMeeting).toBe('2024-03-20');
    });

    it('handles single meeting', () => {
      const transcripts = [createTranscript({ dateString: '2024-01-15T10:00:00Z' })];

      const insights = analyzeMeetings(transcripts);

      expect(insights.earliestMeeting).toBe('2024-01-15');
      expect(insights.latestMeeting).toBe('2024-01-15');
    });

    it('handles meetings on same day', () => {
      const transcripts = [
        createTranscript({ dateString: '2024-01-15T09:00:00Z' }),
        createTranscript({ dateString: '2024-01-15T14:00:00Z' }),
      ];

      const insights = analyzeMeetings(transcripts);

      expect(insights.earliestMeeting).toBe('2024-01-15');
      expect(insights.latestMeeting).toBe('2024-01-15');
    });
  });

  describe('edge cases', () => {
    it('handles transcript with zero duration', () => {
      const transcripts = [createTranscript({ duration: 0 }), createTranscript({ duration: 60 })];

      const insights = analyzeMeetings(transcripts);

      expect(insights.totalDurationMinutes).toBe(60);
      expect(insights.averageDurationMinutes).toBe(30);
    });

    it('handles transcript with no participants', () => {
      const transcripts = [createTranscript({ participants: [] })];

      const insights = analyzeMeetings(transcripts);

      expect(insights.totalUniqueParticipants).toBe(0);
      expect(insights.averageParticipantsPerMeeting).toBe(0);
    });

    it('handles duplicate participant emails (case insensitive)', () => {
      const transcripts = [
        createTranscript({
          participants: ['Alice@Company.com', 'alice@company.com', 'bob@company.com'],
        }),
      ];

      const insights = analyzeMeetings(transcripts);

      // Should deduplicate case-insensitively
      expect(insights.totalUniqueParticipants).toBe(2);
    });

    it('handles malformed date strings gracefully', () => {
      const transcripts = [
        createTranscript({ dateString: 'invalid-date' }),
        createTranscript({ dateString: '2024-01-15T10:00:00Z' }),
      ];

      const insights = analyzeMeetings(transcripts);

      // Should still work with valid dates
      expect(insights.earliestMeeting).toBe('2024-01-15');
      expect(insights.latestMeeting).toBe('2024-01-15');
    });

    it('handles negative sentence duration as zero', () => {
      const transcripts = [
        createTranscript({
          sentences: [
            createSentence({
              speaker_name: 'Alice',
              start_time: '30.0',
              end_time: '10.0', // end before start
            }),
          ],
        }),
      ];

      const insights = analyzeMeetings(transcripts);

      const alice = insights.topSpeakers.find((s) => s.name === 'Alice');
      expect(alice?.totalTalkTimeSeconds).toBe(0);
    });
  });
});
