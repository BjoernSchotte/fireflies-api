import { describe, expect, it } from 'vitest';
import {
  aggregateActionItemsForDigest,
  aggregateParticipants,
  buildDigest,
  calculateStats,
  extractHighlights,
} from '../../src/helpers/digest.js';
import type { Transcript } from '../../src/types/transcript.js';

/**
 * Factory function to create test transcripts.
 */
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

describe('calculateStats', () => {
  describe('totals and averages', () => {
    it('calculates total meetings count', () => {
      const transcripts = [createTranscript(), createTranscript(), createTranscript()];

      const stats = calculateStats(transcripts);

      expect(stats.totalMeetings).toBe(3);
    });

    it('calculates total duration in minutes', () => {
      const transcripts = [
        createTranscript({ duration: 30 }),
        createTranscript({ duration: 60 }),
        createTranscript({ duration: 45 }),
      ];

      const stats = calculateStats(transcripts);

      expect(stats.totalMinutes).toBe(135);
    });

    it('calculates average duration', () => {
      const transcripts = [
        createTranscript({ duration: 30 }),
        createTranscript({ duration: 60 }),
        createTranscript({ duration: 90 }),
      ];

      const stats = calculateStats(transcripts);

      expect(stats.averageDuration).toBe(60);
    });

    it('handles empty array', () => {
      const stats = calculateStats([]);

      expect(stats.totalMeetings).toBe(0);
      expect(stats.totalMinutes).toBe(0);
      expect(stats.averageDuration).toBe(0);
      expect(stats.busiestDay).toBe('');
      expect(stats.meetingsByDay).toEqual({});
    });

    it('handles transcripts with zero duration', () => {
      const transcripts = [createTranscript({ duration: 0 }), createTranscript({ duration: 60 })];

      const stats = calculateStats(transcripts);

      expect(stats.totalMinutes).toBe(60);
      expect(stats.averageDuration).toBe(30);
    });
  });

  describe('meetings by day of week', () => {
    it('groups meetings by day of week', () => {
      const transcripts = [
        // Monday (Jan 15, 2024)
        createTranscript({ dateString: '2024-01-15T10:00:00Z' }),
        createTranscript({ dateString: '2024-01-15T14:00:00Z' }),
        // Tuesday (Jan 16, 2024)
        createTranscript({ dateString: '2024-01-16T10:00:00Z' }),
        // Wednesday (Jan 17, 2024)
        createTranscript({ dateString: '2024-01-17T10:00:00Z' }),
      ];

      const stats = calculateStats(transcripts);

      expect(stats.meetingsByDay.monday).toBe(2);
      expect(stats.meetingsByDay.tuesday).toBe(1);
      expect(stats.meetingsByDay.wednesday).toBe(1);
    });

    it('only includes days with meetings', () => {
      const transcripts = [
        // Monday only
        createTranscript({ dateString: '2024-01-15T10:00:00Z' }),
      ];

      const stats = calculateStats(transcripts);

      expect(stats.meetingsByDay).toEqual({ monday: 1 });
      expect(stats.meetingsByDay.friday).toBeUndefined();
    });
  });

  describe('busiest day', () => {
    it('identifies the busiest day', () => {
      const transcripts = [
        // Monday: 2 meetings
        createTranscript({ dateString: '2024-01-15T10:00:00Z' }),
        createTranscript({ dateString: '2024-01-15T14:00:00Z' }),
        // Tuesday: 3 meetings (busiest)
        createTranscript({ dateString: '2024-01-16T09:00:00Z' }),
        createTranscript({ dateString: '2024-01-16T11:00:00Z' }),
        createTranscript({ dateString: '2024-01-16T15:00:00Z' }),
        // Wednesday: 1 meeting
        createTranscript({ dateString: '2024-01-17T10:00:00Z' }),
      ];

      const stats = calculateStats(transcripts);

      expect(stats.busiestDay).toBe('tuesday');
    });

    it('returns first day alphabetically when tied', () => {
      const transcripts = [
        // Friday: 2 meetings
        createTranscript({ dateString: '2024-01-19T10:00:00Z' }),
        createTranscript({ dateString: '2024-01-19T14:00:00Z' }),
        // Monday: 2 meetings (same count, but monday < friday alphabetically)
        createTranscript({ dateString: '2024-01-15T10:00:00Z' }),
        createTranscript({ dateString: '2024-01-15T14:00:00Z' }),
      ];

      const stats = calculateStats(transcripts);

      // When tied, should return consistently (first alphabetically)
      expect(['friday', 'monday']).toContain(stats.busiestDay);
    });
  });

  describe('edge cases', () => {
    it('handles malformed date strings gracefully', () => {
      const transcripts = [
        createTranscript({ dateString: 'invalid-date' }),
        createTranscript({ dateString: '2024-01-15T10:00:00Z' }),
      ];

      const stats = calculateStats(transcripts);

      // Should still count meetings, but invalid date won't contribute to day stats
      expect(stats.totalMeetings).toBe(2);
      expect(stats.meetingsByDay.monday).toBe(1);
    });

    it('handles undefined duration as zero', () => {
      const transcripts = [createTranscript({ duration: undefined as unknown as number })];

      const stats = calculateStats(transcripts);

      expect(stats.totalMinutes).toBe(0);
    });
  });
});

describe('extractHighlights', () => {
  describe('key points extraction', () => {
    it('extracts key points from summary overview', () => {
      const transcripts = [
        createTranscript({
          id: 'meeting-1',
          title: 'Team Standup',
          dateString: '2024-01-15T10:00:00Z',
          summary: {
            overview:
              'The team discussed project progress. Key decisions were made about the timeline.',
          },
        }),
      ];

      const highlights = extractHighlights(transcripts);

      expect(highlights).toHaveLength(1);
      expect(highlights[0]?.meetingId).toBe('meeting-1');
      expect(highlights[0]?.meetingTitle).toBe('Team Standup');
      expect(highlights[0]?.keyPoints.length).toBeGreaterThan(0);
    });

    it('splits overview into sentences as key points', () => {
      const transcripts = [
        createTranscript({
          summary: {
            overview: 'First point. Second point. Third point.',
          },
        }),
      ];

      const highlights = extractHighlights(transcripts);

      expect(highlights[0]?.keyPoints).toHaveLength(3);
      expect(highlights[0]?.keyPoints[0]).toBe('First point');
      expect(highlights[0]?.keyPoints[1]).toBe('Second point');
      expect(highlights[0]?.keyPoints[2]).toBe('Third point');
    });

    it('returns empty array for transcripts without summary', () => {
      const transcripts = [createTranscript({ summary: undefined })];

      const highlights = extractHighlights(transcripts);

      expect(highlights).toHaveLength(0);
    });

    it('returns empty array for transcripts with empty overview', () => {
      const transcripts = [createTranscript({ summary: { overview: '' } })];

      const highlights = extractHighlights(transcripts);

      expect(highlights).toHaveLength(0);
    });

    it('limits key points per meeting', () => {
      const transcripts = [
        createTranscript({
          summary: {
            overview:
              'Point 1. Point 2. Point 3. Point 4. Point 5. Point 6. Point 7. Point 8. Point 9. Point 10.',
          },
        }),
      ];

      const highlights = extractHighlights(transcripts);

      // Should limit to reasonable number (e.g., 5)
      expect(highlights[0]?.keyPoints.length).toBeLessThanOrEqual(5);
    });
  });

  describe('decisions extraction', () => {
    it('extracts decisions from keywords or action items', () => {
      const transcripts = [
        createTranscript({
          summary: {
            overview: 'The team decided to proceed with option A.',
            keywords: 'decision, timeline, budget',
          },
        }),
      ];

      const highlights = extractHighlights(transcripts);

      expect(highlights[0]?.decisions).toBeDefined();
    });
  });

  describe('multiple transcripts', () => {
    it('extracts highlights from multiple transcripts', () => {
      const transcripts = [
        createTranscript({
          id: 'meeting-1',
          title: 'Meeting 1',
          summary: { overview: 'First meeting summary.' },
        }),
        createTranscript({
          id: 'meeting-2',
          title: 'Meeting 2',
          summary: { overview: 'Second meeting summary.' },
        }),
      ];

      const highlights = extractHighlights(transcripts);

      expect(highlights).toHaveLength(2);
      expect(highlights[0]?.meetingId).toBe('meeting-1');
      expect(highlights[1]?.meetingId).toBe('meeting-2');
    });

    it('skips transcripts without valid summaries', () => {
      const transcripts = [
        createTranscript({
          id: 'meeting-1',
          summary: { overview: 'Valid summary.' },
        }),
        createTranscript({
          id: 'meeting-2',
          summary: undefined,
        }),
        createTranscript({
          id: 'meeting-3',
          summary: { overview: '' },
        }),
      ];

      const highlights = extractHighlights(transcripts);

      expect(highlights).toHaveLength(1);
      expect(highlights[0]?.meetingId).toBe('meeting-1');
    });
  });
});

describe('aggregateParticipants', () => {
  describe('participant counting', () => {
    it('counts unique participants across meetings', () => {
      const transcripts = [
        createTranscript({
          participants: ['alice@company.com', 'bob@company.com'],
          duration: 60,
        }),
        createTranscript({
          participants: ['alice@company.com', 'charlie@company.com'],
          duration: 30,
        }),
      ];

      const participants = aggregateParticipants(transcripts);

      expect(participants).toHaveLength(3); // alice, bob, charlie
    });

    it('counts meeting attendance per participant', () => {
      const transcripts = [
        createTranscript({ participants: ['alice@company.com'] }),
        createTranscript({ participants: ['alice@company.com'] }),
        createTranscript({ participants: ['alice@company.com', 'bob@company.com'] }),
      ];

      const participants = aggregateParticipants(transcripts);

      const alice = participants.find((p) => p.email === 'alice@company.com');
      const bob = participants.find((p) => p.email === 'bob@company.com');

      expect(alice?.meetingCount).toBe(3);
      expect(bob?.meetingCount).toBe(1);
    });

    it('sums total minutes per participant', () => {
      const transcripts = [
        createTranscript({
          participants: ['alice@company.com'],
          duration: 60,
        }),
        createTranscript({
          participants: ['alice@company.com'],
          duration: 30,
        }),
        createTranscript({
          participants: ['bob@company.com'],
          duration: 45,
        }),
      ];

      const participants = aggregateParticipants(transcripts);

      const alice = participants.find((p) => p.email === 'alice@company.com');
      const bob = participants.find((p) => p.email === 'bob@company.com');

      expect(alice?.totalMinutes).toBe(90);
      expect(bob?.totalMinutes).toBe(45);
    });
  });

  describe('email normalization', () => {
    it('deduplicates participants by normalized email (case-insensitive)', () => {
      const transcripts = [
        createTranscript({
          participants: ['Alice@Company.com', 'alice@company.com'],
        }),
      ];

      const participants = aggregateParticipants(transcripts);

      expect(participants).toHaveLength(1);
      expect(participants[0]?.email).toBe('alice@company.com');
    });

    it('handles mixed case across different meetings', () => {
      const transcripts = [
        createTranscript({ participants: ['Alice@COMPANY.com'] }),
        createTranscript({ participants: ['alice@company.com'] }),
      ];

      const participants = aggregateParticipants(transcripts);

      expect(participants).toHaveLength(1);
      expect(participants[0]?.meetingCount).toBe(2);
    });
  });

  describe('sorting', () => {
    it('sorts participants by meeting count descending', () => {
      const transcripts = [
        createTranscript({ participants: ['alice@company.com'] }),
        createTranscript({ participants: ['bob@company.com'] }),
        createTranscript({ participants: ['alice@company.com', 'bob@company.com'] }),
        createTranscript({ participants: ['alice@company.com'] }),
      ];

      const participants = aggregateParticipants(transcripts);

      expect(participants[0]?.email).toBe('alice@company.com');
      expect(participants[0]?.meetingCount).toBe(3);
      expect(participants[1]?.email).toBe('bob@company.com');
      expect(participants[1]?.meetingCount).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty input', () => {
      const participants = aggregateParticipants([]);

      expect(participants).toEqual([]);
    });

    it('handles transcripts with no participants', () => {
      const transcripts = [createTranscript({ participants: [] })];

      const participants = aggregateParticipants(transcripts);

      expect(participants).toEqual([]);
    });

    it('extracts name from email when no attendee info available', () => {
      const transcripts = [createTranscript({ participants: ['john.doe@company.com'] })];

      const participants = aggregateParticipants(transcripts);

      // Should derive name from email
      expect(participants[0]?.name).toBe('john.doe');
    });

    it('looks up participant names from meeting_attendees', () => {
      const transcripts = [
        createTranscript({
          participants: ['alice@company.com', 'bob@company.com'],
          meeting_attendees: [
            { displayName: 'Alice Smith', email: 'alice@company.com', name: 'Alice Smith' },
            { displayName: '', email: 'bob@company.com', name: 'Bob Jones' },
          ],
        }),
      ];

      const participants = aggregateParticipants(transcripts);

      // Should use displayName first, then name from meeting_attendees
      expect(participants.find((p) => p.email === 'alice@company.com')?.name).toBe('Alice Smith');
      expect(participants.find((p) => p.email === 'bob@company.com')?.name).toBe('Bob Jones');
    });

    it('uses name from meeting_attendees across multiple transcripts', () => {
      const transcripts = [
        createTranscript({
          participants: ['alice@company.com'],
          meeting_attendees: [],
        }),
        createTranscript({
          participants: ['alice@company.com'],
          meeting_attendees: [
            { displayName: 'Alice Smith', email: 'alice@company.com', name: 'Alice Smith' },
          ],
        }),
      ];

      const participants = aggregateParticipants(transcripts);

      // Should find name from second transcript's meeting_attendees
      expect(participants.find((p) => p.email === 'alice@company.com')?.name).toBe('Alice Smith');
    });
  });
});

describe('aggregateActionItemsForDigest', () => {
  describe('action item grouping', () => {
    it('groups action items by assignee', () => {
      const transcripts = [
        createTranscript({
          summary: {
            action_items: '**Alice**\n- Task 1\n- Task 2\n**Bob**\n- Task 3',
          },
        }),
      ];

      const result = aggregateActionItemsForDigest(transcripts);

      expect(result.byAssignee.Alice).toHaveLength(2);
      expect(result.byAssignee.Bob).toHaveLength(1);
    });

    it('collects unassigned items separately', () => {
      const transcripts = [
        createTranscript({
          summary: {
            action_items: '- Unassigned task 1\n- Unassigned task 2',
          },
        }),
      ];

      const result = aggregateActionItemsForDigest(transcripts);

      expect(result.unassigned.length).toBeGreaterThanOrEqual(2);
    });

    it('identifies items with due dates', () => {
      const transcripts = [
        createTranscript({
          summary: {
            action_items: '- Task 1 by Friday\n- Task 2\n- Task 3 due 2024-01-20',
          },
        }),
      ];

      const result = aggregateActionItemsForDigest(transcripts);

      expect(result.withDueDates.length).toBeGreaterThanOrEqual(2);
    });

    it('calculates total count', () => {
      const transcripts = [
        createTranscript({
          summary: { action_items: '- Task 1\n- Task 2' },
        }),
        createTranscript({
          summary: { action_items: '- Task 3' },
        }),
      ];

      const result = aggregateActionItemsForDigest(transcripts);

      expect(result.total).toBe(3);
    });
  });

  describe('transcript context', () => {
    it('attaches transcript metadata to each action item', () => {
      const transcripts = [
        createTranscript({
          id: 'meeting-123',
          title: 'Sprint Planning',
          dateString: '2024-01-15T10:00:00Z',
          summary: { action_items: '- Task 1' },
        }),
      ];

      const result = aggregateActionItemsForDigest(transcripts);

      const item =
        result.unassigned[0] || result.byAssignee[Object.keys(result.byAssignee)[0] ?? '']?.[0];
      expect(item?.transcriptId).toBe('meeting-123');
      expect(item?.transcriptTitle).toBe('Sprint Planning');
      expect(item?.transcriptDate).toBe('2024-01-15T10:00:00Z');
    });
  });

  describe('edge cases', () => {
    it('returns empty result for empty input', () => {
      const result = aggregateActionItemsForDigest([]);

      expect(result.total).toBe(0);
      expect(result.byAssignee).toEqual({});
      expect(result.unassigned).toEqual([]);
      expect(result.withDueDates).toEqual([]);
    });

    it('handles transcripts without action items', () => {
      const transcripts = [
        createTranscript({ summary: { action_items: '' } }),
        createTranscript({ summary: undefined }),
      ];

      const result = aggregateActionItemsForDigest(transcripts);

      expect(result.total).toBe(0);
    });
  });

  describe('byMeeting grouping', () => {
    it('groups action items by meeting with participant info', () => {
      const transcripts = [
        createTranscript({
          id: 'meeting-1',
          title: 'Sprint Planning',
          dateString: '2024-01-15T10:00:00Z',
          duration: 45,
          participants: ['alice@company.com', 'bob@company.com'],
          meeting_attendees: [
            { displayName: 'Alice Smith', email: 'alice@company.com', name: 'Alice Smith' },
            { displayName: 'Bob Jones', email: 'bob@company.com', name: 'Bob Jones' },
          ],
          summary: { action_items: '- Task 1\n- Task 2' },
        }),
      ];

      const result = aggregateActionItemsForDigest(transcripts);

      expect(result.byMeeting).toHaveLength(1);
      expect(result.byMeeting[0]).toEqual({
        id: 'meeting-1',
        title: 'Sprint Planning',
        date: '2024-01-15T10:00:00Z',
        duration: 45,
        participants: [
          { email: 'alice@company.com', name: 'Alice Smith' },
          { email: 'bob@company.com', name: 'Bob Jones' },
        ],
        items: expect.any(Array),
      });
    });

    it('falls back to email local part when attendee name not found', () => {
      const transcripts = [
        createTranscript({
          participants: ['unknown@company.com', 'alice@company.com'],
          meeting_attendees: [
            { displayName: 'Alice Smith', email: 'alice@company.com', name: 'Alice Smith' },
            // unknown@company.com not in meeting_attendees
          ],
          summary: { action_items: '- Task 1' },
        }),
      ];

      const result = aggregateActionItemsForDigest(transcripts);

      const meeting = result.byMeeting[0];
      expect(meeting?.participants).toContainEqual({
        email: 'unknown@company.com',
        name: 'unknown',
      });
      expect(meeting?.participants).toContainEqual({
        email: 'alice@company.com',
        name: 'Alice Smith',
      });
    });

    it('handles case-insensitive email lookup', () => {
      const transcripts = [
        createTranscript({
          participants: ['ALICE@Company.com'],
          meeting_attendees: [
            { displayName: 'Alice Smith', email: 'alice@company.com', name: 'Alice Smith' },
          ],
          summary: { action_items: '- Task 1' },
        }),
      ];

      const result = aggregateActionItemsForDigest(transcripts);

      expect(result.byMeeting[0]?.participants).toContainEqual({
        email: 'alice@company.com',
        name: 'Alice Smith',
      });
    });
  });
});

describe('buildDigest', () => {
  describe('basic aggregation', () => {
    it('combines all aggregators into a digest', () => {
      const transcripts = [
        createTranscript({
          id: 'meeting-1',
          title: 'Meeting 1',
          dateString: '2024-01-15T10:00:00Z',
          duration: 60,
          participants: ['alice@company.com'],
          summary: {
            overview: 'First meeting summary.',
            action_items: '- Task 1',
          },
        }),
      ];

      const digest = buildDigest(transcripts);

      expect(digest.totalMeetings).toBe(1);
      expect(digest.totalDuration).toBe(60);
      expect(digest.stats).toBeDefined();
      expect(digest.actionItems).toBeDefined();
      expect(digest.highlights).toBeDefined();
      expect(digest.participants).toBeDefined();
      expect(digest.meetings).toBeDefined();
    });

    it('calculates period from transcript dates', () => {
      const transcripts = [
        createTranscript({ dateString: '2024-01-10T10:00:00Z' }),
        createTranscript({ dateString: '2024-01-15T10:00:00Z' }),
        createTranscript({ dateString: '2024-01-12T10:00:00Z' }),
      ];

      const digest = buildDigest(transcripts);

      expect(digest.period.from).toBe('2024-01-10');
      expect(digest.period.to).toBe('2024-01-15');
    });

    it('includes meeting list', () => {
      const transcripts = [
        createTranscript({
          id: 'meeting-1',
          title: 'Standup',
          dateString: '2024-01-15T10:00:00Z',
          duration: 30,
          participants: ['alice@company.com', 'bob@company.com'],
        }),
      ];

      const digest = buildDigest(transcripts);

      expect(digest.meetings).toHaveLength(1);
      expect(digest.meetings[0]).toEqual({
        id: 'meeting-1',
        title: 'Standup',
        date: '2024-01-15T10:00:00Z',
        duration: 30,
        participants: 2,
      });
    });
  });

  describe('options', () => {
    it('excludes action items when includeActionItems=false', () => {
      const transcripts = [
        createTranscript({
          summary: { action_items: '- Task 1' },
        }),
      ];

      const digest = buildDigest(transcripts, { includeActionItems: false });

      expect(digest.actionItems.total).toBe(0);
      expect(digest.actionItems.byAssignee).toEqual({});
    });

    it('excludes highlights when includeHighlights=false', () => {
      const transcripts = [
        createTranscript({
          summary: { overview: 'Meeting overview.' },
        }),
      ];

      const digest = buildDigest(transcripts, { includeHighlights: false });

      expect(digest.highlights).toEqual([]);
    });

    it('excludes stats when includeStats=false', () => {
      const transcripts = [createTranscript({ duration: 60 })];

      const digest = buildDigest(transcripts, { includeStats: false });

      expect(digest.stats.totalMeetings).toBe(0);
      expect(digest.stats.totalMinutes).toBe(0);
    });
  });

  describe('empty input', () => {
    it('returns empty digest for empty input', () => {
      const digest = buildDigest([]);

      expect(digest.totalMeetings).toBe(0);
      expect(digest.totalDuration).toBe(0);
      expect(digest.period.from).toBe('');
      expect(digest.period.to).toBe('');
      expect(digest.stats.totalMeetings).toBe(0);
      expect(digest.actionItems.total).toBe(0);
      expect(digest.highlights).toEqual([]);
      expect(digest.participants).toEqual([]);
      expect(digest.meetings).toEqual([]);
    });
  });
});
