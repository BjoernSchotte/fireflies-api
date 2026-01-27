import { describe, expect, it } from 'vitest';
import { extractActionItems } from '../../src/helpers/action-items.js';
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
    duration: 3600,
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

describe('extractActionItems', () => {
  describe('basic parsing', () => {
    it('parses newline-separated action items', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Complete API docs\nReview PR\nSchedule follow-up',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items).toHaveLength(3);
      expect(result.items[0]?.text).toBe('Complete API docs');
      expect(result.items[1]?.text).toBe('Review PR');
      expect(result.items[2]?.text).toBe('Schedule follow-up');
    });

    it('handles items with leading dashes', () => {
      const transcript = createTranscript({
        summary: {
          action_items: '- Complete API docs\n- Review PR\n- Schedule call',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items).toHaveLength(3);
      expect(result.items[0]?.text).toBe('Complete API docs');
      expect(result.items[1]?.text).toBe('Review PR');
      expect(result.items[2]?.text).toBe('Schedule call');
    });

    it('handles items with leading bullets', () => {
      const transcript = createTranscript({
        summary: {
          action_items: '• Complete API docs\n• Review PR',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items).toHaveLength(2);
      expect(result.items[0]?.text).toBe('Complete API docs');
      expect(result.items[1]?.text).toBe('Review PR');
    });

    it('handles items with leading asterisks', () => {
      const transcript = createTranscript({
        summary: {
          action_items: '* Complete API docs\n* Review PR',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items).toHaveLength(2);
      expect(result.items[0]?.text).toBe('Complete API docs');
    });

    it('returns empty result for missing action_items', () => {
      const transcript = createTranscript({
        summary: {},
      });

      const result = extractActionItems(transcript);

      expect(result.items).toHaveLength(0);
      expect(result.totalItems).toBe(0);
    });

    it('returns empty result for undefined summary', () => {
      const transcript = createTranscript();

      const result = extractActionItems(transcript);

      expect(result.items).toHaveLength(0);
      expect(result.totalItems).toBe(0);
    });

    it('returns empty result for empty string', () => {
      const transcript = createTranscript({
        summary: {
          action_items: '',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items).toHaveLength(0);
    });

    it('trims whitespace from items', () => {
      const transcript = createTranscript({
        summary: {
          action_items: '  Complete API docs  \n  Review PR  ',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items[0]?.text).toBe('Complete API docs');
      expect(result.items[1]?.text).toBe('Review PR');
    });

    it('filters out empty lines', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Complete API docs\n\n\nReview PR\n\n',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items).toHaveLength(2);
    });

    it('assigns correct line numbers (1-indexed)', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'First item\n\nSecond item\nThird item',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items[0]?.lineNumber).toBe(1);
      expect(result.items[1]?.lineNumber).toBe(3);
      expect(result.items[2]?.lineNumber).toBe(4);
    });
  });

  describe('assignee detection', () => {
    it('detects @mentions', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Complete API docs @Alice\nReview PR @Bob',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items[0]?.assignee).toBe('Alice');
      expect(result.items[1]?.assignee).toBe('Bob');
    });

    it('detects "Name:" prefix', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Alice: Complete API docs\nBob: Review PR',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items[0]?.assignee).toBe('Alice');
      expect(result.items[1]?.assignee).toBe('Bob');
    });

    it('detects "assigned to Name"', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Complete API docs assigned to Alice',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items[0]?.assignee).toBe('Alice');
    });

    it('detects "Name will"', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Alice will complete the API docs',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items[0]?.assignee).toBe('Alice');
    });

    it('detects "Name to" (e.g., "Alice to complete")', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Alice to complete the API docs',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items[0]?.assignee).toBe('Alice');
    });

    it('detects "... - Name" suffix', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Complete API docs - Alice',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items[0]?.assignee).toBe('Alice');
    });

    it('limits to participantNames when provided', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Alice will complete the API docs\nBob will review',
        },
      });

      const result = extractActionItems(transcript, {
        participantNames: ['Alice'],
      });

      expect(result.items[0]?.assignee).toBe('Alice');
      expect(result.items[1]?.assignee).toBeUndefined();
    });

    it('skips detection when detectAssignees: false', () => {
      const transcript = createTranscript({
        summary: {
          action_items: '@Alice Complete API docs',
        },
      });

      const result = extractActionItems(transcript, { detectAssignees: false });

      expect(result.items[0]?.assignee).toBeUndefined();
    });

    it('uses highest priority pattern when multiple match', () => {
      // @mention should win over "Name will"
      const transcript = createTranscript({
        summary: {
          action_items: 'Bob will complete the docs @Alice',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items[0]?.assignee).toBe('Alice');
    });
  });

  describe('due date detection', () => {
    it('detects "by Friday"', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Complete API docs by Friday',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items[0]?.dueDate).toBe('Friday');
    });

    it('detects "by tomorrow"', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Complete API docs by tomorrow',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items[0]?.dueDate).toBe('tomorrow');
    });

    it('detects "by today"', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Complete API docs by today',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items[0]?.dueDate).toBe('today');
    });

    it('detects "due 2024-01-15"', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Complete API docs due 2024-01-15',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items[0]?.dueDate).toBe('2024-01-15');
    });

    it('detects "due Jan 15"', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Complete API docs due Jan 15',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items[0]?.dueDate).toBe('Jan 15');
    });

    it('detects "EOD" and "end of day"', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Complete API docs by EOD\nReview PR by end of day',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items[0]?.dueDate).toBe('EOD');
      expect(result.items[1]?.dueDate).toBe('end of day');
    });

    it('detects "EOW" and "end of week"', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Complete API docs by EOW\nReview PR by end of week',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items[0]?.dueDate).toBe('EOW');
      expect(result.items[1]?.dueDate).toBe('end of week');
    });

    it('detects "by 1/15" date format', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Complete API docs by 1/15',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items[0]?.dueDate).toBe('1/15');
    });

    it('skips detection when detectDueDates: false', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Complete API docs by Friday',
        },
      });

      const result = extractActionItems(transcript, { detectDueDates: false });

      expect(result.items[0]?.dueDate).toBeUndefined();
    });
  });

  describe('source sentence matching', () => {
    it('matches items to AIFilter.task sentences when enabled', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Complete API documentation',
        },
        sentences: [
          createSentence({
            index: 0,
            text: 'We need to complete the API documentation.',
            speaker_name: 'Alice',
            start_time: '10.5',
            ai_filters: {
              task: 'complete API documentation',
            },
          }),
          createSentence({
            index: 1,
            text: 'I think so too.',
            speaker_name: 'Bob',
            start_time: '15.0',
          }),
        ],
      });

      const result = extractActionItems(transcript, { includeSourceSentences: true });

      expect(result.items[0]?.sourceSentence).toBeDefined();
      expect(result.items[0]?.sourceSentence?.speakerName).toBe('Alice');
      expect(result.items[0]?.sourceSentence?.text).toBe(
        'We need to complete the API documentation.'
      );
      expect(result.items[0]?.sourceSentence?.startTime).toBe(10.5);
    });

    it('skips source matching when includeSourceSentences: false (default)', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Complete API docs',
        },
        sentences: [
          createSentence({
            text: 'Complete the API docs.',
            ai_filters: { task: 'Complete API docs' },
          }),
        ],
      });

      const result = extractActionItems(transcript);

      expect(result.items[0]?.sourceSentence).toBeUndefined();
    });

    it('returns undefined source when no matching task sentence found', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Something completely different',
        },
        sentences: [
          createSentence({
            text: 'Complete API docs.',
            ai_filters: { task: 'Complete API docs' },
          }),
        ],
      });

      const result = extractActionItems(transcript, { includeSourceSentences: true });

      expect(result.items[0]?.sourceSentence).toBeUndefined();
    });
  });

  describe('result aggregation', () => {
    it('counts total items', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Item one\nItem two\nItem three',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.totalItems).toBe(3);
    });

    it('counts assigned items', () => {
      const transcript = createTranscript({
        summary: {
          action_items: '@Alice item one\nItem two\n@Bob item three',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.assignedItems).toBe(2);
    });

    it('counts dated items', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Item one by Friday\nItem two\nItem three by EOD',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.datedItems).toBe(2);
    });

    it('lists unique assignees', () => {
      const transcript = createTranscript({
        summary: {
          action_items: '@Alice item one\n@Bob item two\n@Alice item three',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.assignees).toEqual(['Alice', 'Bob']);
    });

    it('returns empty assignees array when no assignees detected', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Item one\nItem two',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.assignees).toEqual([]);
    });
  });

  describe('Fireflies section header format', () => {
    it('detects **Name** as section header and applies to following items', () => {
      const transcript = createTranscript({
        summary: {
          action_items: '**Alice**\nComplete API docs\nReview PR\n\n**Bob**\nSchedule call',
        },
      });

      const result = extractActionItems(transcript);

      // Should not include the **Name** headers as action items
      expect(result.items).toHaveLength(3);
      expect(result.items[0]?.text).toBe('Complete API docs');
      expect(result.items[0]?.assignee).toBe('Alice');
      expect(result.items[1]?.text).toBe('Review PR');
      expect(result.items[1]?.assignee).toBe('Alice');
      expect(result.items[2]?.text).toBe('Schedule call');
      expect(result.items[2]?.assignee).toBe('Bob');
    });

    it('handles **Unassigned** section', () => {
      const transcript = createTranscript({
        summary: {
          action_items: '**Alice**\nTask one\n\n**Unassigned**\nTask two',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items).toHaveLength(2);
      expect(result.items[0]?.assignee).toBe('Alice');
      expect(result.items[1]?.assignee).toBeUndefined();
    });

    it('handles multi-word names in section headers', () => {
      const transcript = createTranscript({
        summary: {
          action_items: '**Johann Peter Hartmann**\nComplete docs',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.assignee).toBe('Johann Peter Hartmann');
    });

    it('combines section header assignee with inline detection', () => {
      // If an item has inline assignee, it should override the section header
      const transcript = createTranscript({
        summary: {
          action_items: '**Alice**\n@Bob complete the docs',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items).toHaveLength(1);
      // @mention takes priority over section header
      expect(result.items[0]?.assignee).toBe('Bob');
    });
  });

  describe('edge cases', () => {
    it('handles mixed formatting in same list', () => {
      const transcript = createTranscript({
        summary: {
          action_items: '- First item\n• Second item\n* Third item\nFourth item',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items).toHaveLength(4);
      expect(result.items.map((i) => i.text)).toEqual([
        'First item',
        'Second item',
        'Third item',
        'Fourth item',
      ]);
    });

    it('handles numbered list format', () => {
      const transcript = createTranscript({
        summary: {
          action_items: '1. First item\n2. Second item\n3. Third item',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items).toHaveLength(3);
      expect(result.items[0]?.text).toBe('First item');
    });

    it('preserves original text when cleaning assignee patterns', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Complete the API docs @Alice by Friday',
        },
      });

      const result = extractActionItems(transcript);

      // Text should still contain the full original content
      expect(result.items[0]?.text).toBe('Complete the API docs @Alice by Friday');
      expect(result.items[0]?.assignee).toBe('Alice');
      expect(result.items[0]?.dueDate).toBe('Friday');
    });

    it('handles very long action items', () => {
      const longText = 'A'.repeat(500);
      const transcript = createTranscript({
        summary: {
          action_items: longText,
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items[0]?.text).toBe(longText);
    });

    it('handles special characters in text', () => {
      const transcript = createTranscript({
        summary: {
          action_items: 'Fix bug #123 & update docs (urgent!)',
        },
      });

      const result = extractActionItems(transcript);

      expect(result.items[0]?.text).toBe('Fix bug #123 & update docs (urgent!)');
    });
  });
});
