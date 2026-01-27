import { describe, expect, it } from 'vitest';
import { searchTranscript } from '../../src/helpers/search.js';
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
    duration: 60,
    dateString: '2024-01-15T10:00:00Z',
    date: 1705312800000,
    sentences: [],
    channels: [],
    ...overrides,
  };
}

describe('searchTranscript', () => {
  describe('basic text matching', () => {
    it('finds case-insensitive matches by default', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'The budget discussion is important.',
            raw_text: 'The budget discussion is important.',
            start_time: '10.0',
            end_time: '15.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
          {
            index: 1,
            text: 'I agree about the timeline.',
            raw_text: 'I agree about the timeline.',
            start_time: '15.0',
            end_time: '20.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          },
        ],
      });

      const matches = searchTranscript(transcript, { query: 'BUDGET' });

      expect(matches).toHaveLength(1);
      expect(matches[0].sentence.text).toBe('The budget discussion is important.');
    });

    it('respects caseSensitive option when true', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'The Budget discussion is important.',
            raw_text: 'The Budget discussion is important.',
            start_time: '10.0',
            end_time: '15.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
          {
            index: 1,
            text: 'The budget needs review.',
            raw_text: 'The budget needs review.',
            start_time: '15.0',
            end_time: '20.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          },
        ],
      });

      const matches = searchTranscript(transcript, {
        query: 'Budget',
        caseSensitive: true,
      });

      expect(matches).toHaveLength(1);
      expect(matches[0].sentence.text).toBe('The Budget discussion is important.');
    });

    it('finds multiple matches across sentences', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'The deadline is Friday.',
            raw_text: 'The deadline is Friday.',
            start_time: '10.0',
            end_time: '15.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
          {
            index: 1,
            text: 'Can we extend the deadline?',
            raw_text: 'Can we extend the deadline?',
            start_time: '15.0',
            end_time: '20.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          },
          {
            index: 2,
            text: 'Let me check the schedule.',
            raw_text: 'Let me check the schedule.',
            start_time: '20.0',
            end_time: '25.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
        ],
      });

      const matches = searchTranscript(transcript, { query: 'deadline' });

      expect(matches).toHaveLength(2);
      expect(matches[0].sentence.index).toBe(0);
      expect(matches[1].sentence.index).toBe(1);
    });
  });

  describe('speaker filtering', () => {
    it('filters by speaker name (case-insensitive)', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'The budget looks good.',
            raw_text: 'The budget looks good.',
            start_time: '10.0',
            end_time: '15.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
          {
            index: 1,
            text: 'The budget needs revision.',
            raw_text: 'The budget needs revision.',
            start_time: '15.0',
            end_time: '20.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          },
        ],
      });

      const matches = searchTranscript(transcript, {
        query: 'budget',
        speakers: ['ALICE'],
      });

      expect(matches).toHaveLength(1);
      expect(matches[0].sentence.speakerName).toBe('Alice');
    });

    it('filters by multiple speakers', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'The project is on track.',
            raw_text: 'The project is on track.',
            start_time: '10.0',
            end_time: '15.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
          {
            index: 1,
            text: 'The project needs resources.',
            raw_text: 'The project needs resources.',
            start_time: '15.0',
            end_time: '20.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          },
          {
            index: 2,
            text: 'The project timeline is tight.',
            raw_text: 'The project timeline is tight.',
            start_time: '20.0',
            end_time: '25.0',
            speaker_id: '3',
            speaker_name: 'Charlie',
          },
        ],
      });

      const matches = searchTranscript(transcript, {
        query: 'project',
        speakers: ['Alice', 'Charlie'],
      });

      expect(matches).toHaveLength(2);
      expect(matches[0].sentence.speakerName).toBe('Alice');
      expect(matches[1].sentence.speakerName).toBe('Charlie');
    });
  });

  describe('AI filter filtering', () => {
    it('filters by questions when filterQuestions is true', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'What is the budget?',
            raw_text: 'What is the budget?',
            start_time: '10.0',
            end_time: '15.0',
            speaker_id: '1',
            speaker_name: 'Alice',
            ai_filters: { question: 'What is the budget?' },
          },
          {
            index: 1,
            text: 'The budget is approved.',
            raw_text: 'The budget is approved.',
            start_time: '15.0',
            end_time: '20.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          },
        ],
      });

      const matches = searchTranscript(transcript, {
        query: 'budget',
        filterQuestions: true,
      });

      expect(matches).toHaveLength(1);
      expect(matches[0].sentence.text).toBe('What is the budget?');
      expect(matches[0].sentence.isQuestion).toBe(true);
    });

    it('filters by tasks when filterTasks is true', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'Review the budget by Friday.',
            raw_text: 'Review the budget by Friday.',
            start_time: '10.0',
            end_time: '15.0',
            speaker_id: '1',
            speaker_name: 'Alice',
            ai_filters: { task: 'Review the budget by Friday.' },
          },
          {
            index: 1,
            text: 'The budget discussion went well.',
            raw_text: 'The budget discussion went well.',
            start_time: '15.0',
            end_time: '20.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          },
        ],
      });

      const matches = searchTranscript(transcript, {
        query: 'budget',
        filterTasks: true,
      });

      expect(matches).toHaveLength(1);
      expect(matches[0].sentence.text).toBe('Review the budget by Friday.');
      expect(matches[0].sentence.isTask).toBe(true);
    });

    it('can filter by both questions and tasks', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'What is the deadline?',
            raw_text: 'What is the deadline?',
            start_time: '10.0',
            end_time: '15.0',
            speaker_id: '1',
            speaker_name: 'Alice',
            ai_filters: { question: 'What is the deadline?' },
          },
          {
            index: 1,
            text: 'Update the deadline tracker.',
            raw_text: 'Update the deadline tracker.',
            start_time: '15.0',
            end_time: '20.0',
            speaker_id: '2',
            speaker_name: 'Bob',
            ai_filters: { task: 'Update the deadline tracker.' },
          },
          {
            index: 2,
            text: 'The deadline is next week.',
            raw_text: 'The deadline is next week.',
            start_time: '20.0',
            end_time: '25.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
        ],
      });

      // When both are true, matches sentences with either question OR task
      const matches = searchTranscript(transcript, {
        query: 'deadline',
        filterQuestions: true,
        filterTasks: true,
      });

      expect(matches).toHaveLength(2);
    });
  });

  describe('context extraction', () => {
    it('extracts N context sentences before and after', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'Hello everyone.',
            raw_text: 'Hello everyone.',
            start_time: '0.0',
            end_time: '5.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
          {
            index: 1,
            text: 'Let us discuss the budget.',
            raw_text: 'Let us discuss the budget.',
            start_time: '5.0',
            end_time: '10.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          },
          {
            index: 2,
            text: 'The budget looks reasonable.',
            raw_text: 'The budget looks reasonable.',
            start_time: '10.0',
            end_time: '15.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
          {
            index: 3,
            text: 'I agree completely.',
            raw_text: 'I agree completely.',
            start_time: '15.0',
            end_time: '20.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          },
          {
            index: 4,
            text: 'Goodbye.',
            raw_text: 'Goodbye.',
            start_time: '20.0',
            end_time: '25.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
        ],
      });

      const matches = searchTranscript(transcript, {
        query: 'budget looks',
        contextLines: 2,
      });

      expect(matches).toHaveLength(1);
      expect(matches[0].context.before).toHaveLength(2);
      expect(matches[0].context.before[0].text).toBe('Hello everyone.');
      expect(matches[0].context.before[1].text).toBe('Let us discuss the budget.');
      expect(matches[0].context.after).toHaveLength(2);
      expect(matches[0].context.after[0].text).toBe('I agree completely.');
      expect(matches[0].context.after[1].text).toBe('Goodbye.');
    });

    it('handles first sentence with limited before context', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'The budget is important.',
            raw_text: 'The budget is important.',
            start_time: '0.0',
            end_time: '5.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
          {
            index: 1,
            text: 'I agree.',
            raw_text: 'I agree.',
            start_time: '5.0',
            end_time: '10.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          },
        ],
      });

      const matches = searchTranscript(transcript, {
        query: 'budget',
        contextLines: 2,
      });

      expect(matches).toHaveLength(1);
      expect(matches[0].context.before).toHaveLength(0);
      expect(matches[0].context.after).toHaveLength(1);
    });

    it('handles last sentence with limited after context', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'Hello everyone.',
            raw_text: 'Hello everyone.',
            start_time: '0.0',
            end_time: '5.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
          {
            index: 1,
            text: 'The budget is approved.',
            raw_text: 'The budget is approved.',
            start_time: '5.0',
            end_time: '10.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          },
        ],
      });

      const matches = searchTranscript(transcript, {
        query: 'budget',
        contextLines: 2,
      });

      expect(matches).toHaveLength(1);
      expect(matches[0].context.before).toHaveLength(1);
      expect(matches[0].context.after).toHaveLength(0);
    });

    it('uses default contextLines of 1', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'First sentence.',
            raw_text: 'First sentence.',
            start_time: '0.0',
            end_time: '5.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
          {
            index: 1,
            text: 'The budget discussion.',
            raw_text: 'The budget discussion.',
            start_time: '5.0',
            end_time: '10.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          },
          {
            index: 2,
            text: 'Third sentence.',
            raw_text: 'Third sentence.',
            start_time: '10.0',
            end_time: '15.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
          {
            index: 3,
            text: 'Fourth sentence.',
            raw_text: 'Fourth sentence.',
            start_time: '15.0',
            end_time: '20.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          },
        ],
      });

      const matches = searchTranscript(transcript, { query: 'budget' });

      expect(matches).toHaveLength(1);
      expect(matches[0].context.before).toHaveLength(1);
      expect(matches[0].context.after).toHaveLength(1);
    });

    it('includes speaker names in context', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'Hello everyone.',
            raw_text: 'Hello everyone.',
            start_time: '0.0',
            end_time: '5.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
          {
            index: 1,
            text: 'The budget is ready.',
            raw_text: 'The budget is ready.',
            start_time: '5.0',
            end_time: '10.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          },
          {
            index: 2,
            text: 'Great news!',
            raw_text: 'Great news!',
            start_time: '10.0',
            end_time: '15.0',
            speaker_id: '3',
            speaker_name: 'Charlie',
          },
        ],
      });

      const matches = searchTranscript(transcript, { query: 'budget' });

      expect(matches[0].context.before[0].speakerName).toBe('Alice');
      expect(matches[0].context.after[0].speakerName).toBe('Charlie');
    });
  });

  describe('match result structure', () => {
    it('includes all transcript metadata in match', () => {
      const transcript = createTranscript({
        id: 'abc123',
        title: 'Q4 Budget Review',
        dateString: '2024-03-15T14:00:00Z',
        transcript_url: 'https://app.fireflies.ai/transcript/abc123',
        sentences: [
          {
            index: 0,
            text: 'The budget is finalized.',
            raw_text: 'The budget is finalized.',
            start_time: '10.5',
            end_time: '15.25',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
        ],
      });

      const matches = searchTranscript(transcript, { query: 'budget' });

      expect(matches[0].transcriptId).toBe('abc123');
      expect(matches[0].transcriptTitle).toBe('Q4 Budget Review');
      expect(matches[0].transcriptDate).toBe('2024-03-15T14:00:00Z');
      expect(matches[0].transcriptUrl).toBe('https://app.fireflies.ai/transcript/abc123');
    });

    it('includes sentence details with correct types', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 5,
            text: 'What about the budget?',
            raw_text: 'What about the budget?',
            start_time: '120.5',
            end_time: '125.75',
            speaker_id: '1',
            speaker_name: 'Alice',
            ai_filters: { question: 'What about the budget?', task: 'Review budget' },
          },
        ],
      });

      const matches = searchTranscript(transcript, { query: 'budget' });

      expect(matches[0].sentence).toEqual({
        index: 5,
        text: 'What about the budget?',
        speakerName: 'Alice',
        startTime: 120.5,
        endTime: 125.75,
        isQuestion: true,
        isTask: true,
      });
    });

    it('sets isQuestion and isTask to false when ai_filters missing', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'The budget is ready.',
            raw_text: 'The budget is ready.',
            start_time: '10.0',
            end_time: '15.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
        ],
      });

      const matches = searchTranscript(transcript, { query: 'budget' });

      expect(matches[0].sentence.isQuestion).toBe(false);
      expect(matches[0].sentence.isTask).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns empty for no matches', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'The project is on track.',
            raw_text: 'The project is on track.',
            start_time: '10.0',
            end_time: '15.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
        ],
      });

      const matches = searchTranscript(transcript, { query: 'budget' });

      expect(matches).toEqual([]);
    });

    it('handles transcript with no sentences', () => {
      const transcript = createTranscript({ sentences: [] });

      const matches = searchTranscript(transcript, { query: 'budget' });

      expect(matches).toEqual([]);
    });

    it('handles empty query string', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'Some text here.',
            raw_text: 'Some text here.',
            start_time: '10.0',
            end_time: '15.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
        ],
      });

      const matches = searchTranscript(transcript, { query: '' });

      // Empty query should match nothing or everything - we'll return nothing
      expect(matches).toEqual([]);
    });

    it('handles sentences with undefined ai_filters', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'The budget is approved.',
            raw_text: 'The budget is approved.',
            start_time: '10.0',
            end_time: '15.0',
            speaker_id: '1',
            speaker_name: 'Alice',
            ai_filters: undefined,
          },
        ],
      });

      const matches = searchTranscript(transcript, {
        query: 'budget',
        filterQuestions: true,
      });

      // With filterQuestions true, should not match since no question
      expect(matches).toEqual([]);
    });

    it('handles special regex characters in query', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'The cost is $100.00 (plus tax).',
            raw_text: 'The cost is $100.00 (plus tax).',
            start_time: '10.0',
            end_time: '15.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
        ],
      });

      // Query contains regex special chars: $ . ( )
      const matches = searchTranscript(transcript, { query: '$100.00' });

      expect(matches).toHaveLength(1);
    });

    it('handles contextLines of 0', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'Before sentence.',
            raw_text: 'Before sentence.',
            start_time: '0.0',
            end_time: '5.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
          {
            index: 1,
            text: 'The budget is ready.',
            raw_text: 'The budget is ready.',
            start_time: '5.0',
            end_time: '10.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          },
          {
            index: 2,
            text: 'After sentence.',
            raw_text: 'After sentence.',
            start_time: '10.0',
            end_time: '15.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
        ],
      });

      const matches = searchTranscript(transcript, {
        query: 'budget',
        contextLines: 0,
      });

      expect(matches).toHaveLength(1);
      expect(matches[0].context.before).toHaveLength(0);
      expect(matches[0].context.after).toHaveLength(0);
    });
  });

  describe('combined filters', () => {
    it('applies speaker and question filter together', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'What is the deadline?',
            raw_text: 'What is the deadline?',
            start_time: '10.0',
            end_time: '15.0',
            speaker_id: '1',
            speaker_name: 'Alice',
            ai_filters: { question: 'What is the deadline?' },
          },
          {
            index: 1,
            text: 'What is the deadline for phase 2?',
            raw_text: 'What is the deadline for phase 2?',
            start_time: '15.0',
            end_time: '20.0',
            speaker_id: '2',
            speaker_name: 'Bob',
            ai_filters: { question: 'What is the deadline for phase 2?' },
          },
          {
            index: 2,
            text: 'The deadline is Friday.',
            raw_text: 'The deadline is Friday.',
            start_time: '20.0',
            end_time: '25.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
        ],
      });

      const matches = searchTranscript(transcript, {
        query: 'deadline',
        speakers: ['Alice'],
        filterQuestions: true,
      });

      expect(matches).toHaveLength(1);
      expect(matches[0].sentence.speakerName).toBe('Alice');
      expect(matches[0].sentence.isQuestion).toBe(true);
    });
  });
});
