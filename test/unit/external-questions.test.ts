import { describe, expect, it } from 'vitest';
import { findExternalParticipantQuestions } from '../../src/helpers/external-questions.js';
import type { Transcript } from '../../src/types/transcript.js';

function createTranscript(overrides: Partial<Transcript> = {}): Transcript {
  return {
    id: 'test-id',
    title: 'Test Meeting',
    organizer_email: 'host@internal.com',
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

describe('findExternalParticipantQuestions', () => {
  describe('domain normalization', () => {
    it('handles domain with @ prefix', () => {
      const transcript = createTranscript({
        meeting_attendees: [
          { displayName: 'External User', email: 'user@external.com', name: 'External User' },
        ],
        sentences: [
          {
            index: 0,
            text: 'What is the timeline?',
            raw_text: 'What is the timeline?',
            start_time: '10.5',
            end_time: '12.0',
            speaker_id: '1',
            speaker_name: 'External User',
            ai_filters: { question: 'What is the timeline?' },
          },
        ],
      });

      const result = findExternalParticipantQuestions(transcript, '@internal.com');

      expect(result.totalQuestions).toBe(1);
      expect(result.questions[0].speakerName).toBe('External User');
    });

    it('handles domain without @ prefix', () => {
      const transcript = createTranscript({
        meeting_attendees: [
          { displayName: 'External User', email: 'user@external.com', name: 'External User' },
        ],
        sentences: [
          {
            index: 0,
            text: 'What is the timeline?',
            raw_text: 'What is the timeline?',
            start_time: '10.5',
            end_time: '12.0',
            speaker_id: '1',
            speaker_name: 'External User',
            ai_filters: { question: 'What is the timeline?' },
          },
        ],
      });

      const result = findExternalParticipantQuestions(transcript, 'internal.com');

      expect(result.totalQuestions).toBe(1);
    });

    it('handles multiple domains', () => {
      const transcript = createTranscript({
        meeting_attendees: [
          { displayName: 'Internal A', email: 'user@company.com', name: 'Internal A' },
          { displayName: 'Internal B', email: 'user@subsidiary.com', name: 'Internal B' },
          { displayName: 'External', email: 'user@external.com', name: 'External' },
        ],
        sentences: [
          {
            index: 0,
            text: 'Question from company?',
            raw_text: 'Question from company?',
            start_time: '10.0',
            end_time: '12.0',
            speaker_id: '1',
            speaker_name: 'Internal A',
            ai_filters: { question: 'Question from company?' },
          },
          {
            index: 1,
            text: 'Question from external?',
            raw_text: 'Question from external?',
            start_time: '15.0',
            end_time: '17.0',
            speaker_id: '3',
            speaker_name: 'External',
            ai_filters: { question: 'Question from external?' },
          },
        ],
      });

      const result = findExternalParticipantQuestions(transcript, [
        '@company.com',
        '@subsidiary.com',
      ]);

      expect(result.totalQuestions).toBe(1);
      expect(result.questions[0].speakerName).toBe('External');
    });

    it('handles case-insensitive domain matching', () => {
      const transcript = createTranscript({
        meeting_attendees: [{ displayName: 'User', email: 'User@INTERNAL.COM', name: 'User' }],
        sentences: [
          {
            index: 0,
            text: 'A question?',
            raw_text: 'A question?',
            start_time: '10.0',
            end_time: '12.0',
            speaker_id: '1',
            speaker_name: 'User',
            ai_filters: { question: 'A question?' },
          },
        ],
      });

      const result = findExternalParticipantQuestions(transcript, '@internal.com');

      // Should be internal, so no questions
      expect(result.totalQuestions).toBe(0);
      expect(result.externalParticipants).toHaveLength(0);
    });
  });

  describe('speaker email mapping', () => {
    it('maps by displayName', () => {
      const transcript = createTranscript({
        meeting_attendees: [
          { displayName: 'John Doe', email: 'john@external.com', name: 'John D.' },
        ],
        sentences: [
          {
            index: 0,
            text: 'What is this?',
            raw_text: 'What is this?',
            start_time: '10.0',
            end_time: '12.0',
            speaker_id: '1',
            speaker_name: 'John Doe',
            ai_filters: { question: 'What is this?' },
          },
        ],
      });

      const result = findExternalParticipantQuestions(transcript, '@internal.com');

      expect(result.questions[0].speakerEmail).toBe('john@external.com');
    });

    it('maps by name field', () => {
      const transcript = createTranscript({
        meeting_attendees: [
          { displayName: 'Different Name', email: 'john@external.com', name: 'John Doe' },
        ],
        sentences: [
          {
            index: 0,
            text: 'What is this?',
            raw_text: 'What is this?',
            start_time: '10.0',
            end_time: '12.0',
            speaker_id: '1',
            speaker_name: 'John Doe',
            ai_filters: { question: 'What is this?' },
          },
        ],
      });

      const result = findExternalParticipantQuestions(transcript, '@internal.com');

      expect(result.questions[0].speakerEmail).toBe('john@external.com');
    });

    it('handles speaker without email mapping', () => {
      const transcript = createTranscript({
        meeting_attendees: [],
        sentences: [
          {
            index: 0,
            text: 'Unknown speaker question?',
            raw_text: 'Unknown speaker question?',
            start_time: '10.0',
            end_time: '12.0',
            speaker_id: '1',
            speaker_name: 'Unknown Speaker',
            ai_filters: { question: 'Unknown speaker question?' },
          },
        ],
      });

      const result = findExternalParticipantQuestions(transcript, '@internal.com');

      // Speaker without email is considered external (conservative default)
      expect(result.totalQuestions).toBe(1);
      expect(result.questions[0].speakerEmail).toBeUndefined();
    });
  });

  describe('question filtering', () => {
    it('only includes sentences with ai_filters.question set', () => {
      const transcript = createTranscript({
        meeting_attendees: [
          { displayName: 'External', email: 'user@external.com', name: 'External' },
        ],
        sentences: [
          {
            index: 0,
            text: 'This is a statement.',
            raw_text: 'This is a statement.',
            start_time: '10.0',
            end_time: '12.0',
            speaker_id: '1',
            speaker_name: 'External',
            ai_filters: {},
          },
          {
            index: 1,
            text: 'This is a question?',
            raw_text: 'This is a question?',
            start_time: '15.0',
            end_time: '17.0',
            speaker_id: '1',
            speaker_name: 'External',
            ai_filters: { question: 'This is a question?' },
          },
          {
            index: 2,
            text: 'Another statement.',
            raw_text: 'Another statement.',
            start_time: '20.0',
            end_time: '22.0',
            speaker_id: '1',
            speaker_name: 'External',
          },
        ],
      });

      const result = findExternalParticipantQuestions(transcript, '@internal.com');

      expect(result.totalQuestions).toBe(1);
      expect(result.questions[0].sentenceIndex).toBe(1);
    });

    it('excludes questions from internal participants', () => {
      const transcript = createTranscript({
        meeting_attendees: [
          { displayName: 'Internal User', email: 'user@internal.com', name: 'Internal User' },
          { displayName: 'External User', email: 'user@external.com', name: 'External User' },
        ],
        sentences: [
          {
            index: 0,
            text: 'Internal question?',
            raw_text: 'Internal question?',
            start_time: '10.0',
            end_time: '12.0',
            speaker_id: '1',
            speaker_name: 'Internal User',
            ai_filters: { question: 'Internal question?' },
          },
          {
            index: 1,
            text: 'External question?',
            raw_text: 'External question?',
            start_time: '15.0',
            end_time: '17.0',
            speaker_id: '2',
            speaker_name: 'External User',
            ai_filters: { question: 'External question?' },
          },
        ],
      });

      const result = findExternalParticipantQuestions(transcript, '@internal.com');

      expect(result.totalQuestions).toBe(1);
      expect(result.questions[0].text).toBe('External question?');
    });
  });

  describe('result structure', () => {
    it('returns correct external participants list', () => {
      const transcript = createTranscript({
        meeting_attendees: [
          { displayName: 'Internal', email: 'user@internal.com', name: 'Internal' },
          { displayName: 'External A', email: 'a@external.com', name: 'External A' },
          { displayName: 'External B', email: 'b@external.com', name: 'External B' },
        ],
        sentences: [
          {
            index: 0,
            text: 'Statement',
            raw_text: 'Statement',
            start_time: '10.0',
            end_time: '12.0',
            speaker_id: '1',
            speaker_name: 'Internal',
          },
          {
            index: 1,
            text: 'External statement',
            raw_text: 'External statement',
            start_time: '15.0',
            end_time: '17.0',
            speaker_id: '2',
            speaker_name: 'External A',
          },
          {
            index: 2,
            text: 'Another external',
            raw_text: 'Another external',
            start_time: '20.0',
            end_time: '22.0',
            speaker_id: '3',
            speaker_name: 'External B',
          },
        ],
      });

      const result = findExternalParticipantQuestions(transcript, '@internal.com');

      expect(result.externalParticipants).toHaveLength(2);
      expect(result.externalParticipants.map((p) => p.name).sort()).toEqual([
        'External A',
        'External B',
      ]);
    });

    it('includes all question fields', () => {
      const transcript = createTranscript({
        meeting_attendees: [
          { displayName: 'External', email: 'user@external.com', name: 'External' },
        ],
        sentences: [
          {
            index: 5,
            text: 'What is the cost?',
            raw_text: 'what is the cost',
            start_time: '120.5',
            end_time: '123.25',
            speaker_id: '1',
            speaker_name: 'External',
            ai_filters: { question: 'What is the cost?' },
          },
        ],
      });

      const result = findExternalParticipantQuestions(transcript, '@internal.com');

      expect(result.questions[0]).toEqual({
        text: 'What is the cost?',
        speakerName: 'External',
        speakerEmail: 'user@external.com',
        sentenceIndex: 5,
        startTime: '120.5',
        endTime: '123.25',
      });
    });
  });

  describe('edge cases', () => {
    it('handles empty sentences array', () => {
      const transcript = createTranscript({
        sentences: [],
      });

      const result = findExternalParticipantQuestions(transcript, '@internal.com');

      expect(result.totalQuestions).toBe(0);
      expect(result.questions).toEqual([]);
      expect(result.externalParticipants).toEqual([]);
    });

    it('handles transcript with no questions', () => {
      const transcript = createTranscript({
        meeting_attendees: [
          { displayName: 'External', email: 'user@external.com', name: 'External' },
        ],
        sentences: [
          {
            index: 0,
            text: 'Just a statement.',
            raw_text: 'Just a statement.',
            start_time: '10.0',
            end_time: '12.0',
            speaker_id: '1',
            speaker_name: 'External',
            ai_filters: {},
          },
        ],
      });

      const result = findExternalParticipantQuestions(transcript, '@internal.com');

      expect(result.totalQuestions).toBe(0);
      expect(result.externalParticipants).toHaveLength(1);
    });

    it('handles transcript with only internal participants', () => {
      const transcript = createTranscript({
        meeting_attendees: [
          { displayName: 'Internal A', email: 'a@internal.com', name: 'Internal A' },
          { displayName: 'Internal B', email: 'b@internal.com', name: 'Internal B' },
        ],
        sentences: [
          {
            index: 0,
            text: 'Question?',
            raw_text: 'Question?',
            start_time: '10.0',
            end_time: '12.0',
            speaker_id: '1',
            speaker_name: 'Internal A',
            ai_filters: { question: 'Question?' },
          },
        ],
      });

      const result = findExternalParticipantQuestions(transcript, '@internal.com');

      expect(result.totalQuestions).toBe(0);
      expect(result.externalParticipants).toHaveLength(0);
    });
  });
});
