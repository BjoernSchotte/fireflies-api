import { describe, expect, it } from 'vitest';
import { analyzeSpeakers } from '../../src/helpers/speaker-analytics.js';
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

describe('analyzeSpeakers', () => {
  describe('talk time calculation', () => {
    it('calculates talk time from sentence timestamps', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            start_time: '0.0',
            end_time: '10.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          }),
          createSentence({
            start_time: '10.0',
            end_time: '25.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.speakers).toHaveLength(2);
      const alice = analytics.speakers.find((s) => s.name === 'Alice');
      const bob = analytics.speakers.find((s) => s.name === 'Bob');
      expect(alice?.talkTime).toBe(10);
      expect(bob?.talkTime).toBe(15);
    });

    it('calculates percentage of total talk time', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            start_time: '0.0',
            end_time: '20.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          }),
          createSentence({
            start_time: '20.0',
            end_time: '30.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      const alice = analytics.speakers.find((s) => s.name === 'Alice');
      const bob = analytics.speakers.find((s) => s.name === 'Bob');
      expect(alice?.talkTimePercentage).toBe(67); // 20/30 = 66.67% rounded
      expect(bob?.talkTimePercentage).toBe(33); // 10/30 = 33.33% rounded
    });

    it('handles sentences with same start and end time', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            start_time: '0.0',
            end_time: '0.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.speakers[0]?.talkTime).toBe(0);
    });

    it('handles negative duration (end before start) as zero', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            start_time: '10.0',
            end_time: '5.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.speakers[0]?.talkTime).toBe(0);
    });
  });

  describe('word count', () => {
    it('counts words per speaker', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            text: 'Hello everyone how are you',
            speaker_id: '1',
            speaker_name: 'Alice',
          }),
          createSentence({ text: 'I am fine thanks', speaker_id: '2', speaker_name: 'Bob' }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      const alice = analytics.speakers.find((s) => s.name === 'Alice');
      const bob = analytics.speakers.find((s) => s.name === 'Bob');
      expect(alice?.wordCount).toBe(5);
      expect(bob?.wordCount).toBe(4);
    });

    it('handles empty text', () => {
      const transcript = createTranscript({
        sentences: [createSentence({ text: '', speaker_id: '1', speaker_name: 'Alice' })],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.speakers[0]?.wordCount).toBe(0);
    });

    it('handles multiple spaces', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({ text: 'Hello    world   test', speaker_id: '1', speaker_name: 'Alice' }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.speakers[0]?.wordCount).toBe(3);
    });

    it('handles leading and trailing whitespace', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({ text: '  Hello world  ', speaker_id: '1', speaker_name: 'Alice' }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.speakers[0]?.wordCount).toBe(2);
    });
  });

  describe('words per minute', () => {
    it('calculates words per minute based on talk time', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            text: 'One two three four five six seven eight nine ten', // 10 words
            start_time: '0.0',
            end_time: '30.0', // 30 seconds = 0.5 minutes
            speaker_id: '1',
            speaker_name: 'Alice',
          }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.speakers[0]?.wordsPerMinute).toBe(20); // 10 words / 0.5 min = 20 wpm
    });

    it('returns 0 wpm when talk time is 0', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            text: 'Hello',
            start_time: '0.0',
            end_time: '0.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.speakers[0]?.wordsPerMinute).toBe(0);
    });
  });

  describe('sentence statistics', () => {
    it('counts sentences per speaker', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({ text: 'First.', speaker_id: '1', speaker_name: 'Alice' }),
          createSentence({ text: 'Second.', speaker_id: '1', speaker_name: 'Alice' }),
          createSentence({ text: 'Third.', speaker_id: '2', speaker_name: 'Bob' }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      const alice = analytics.speakers.find((s) => s.name === 'Alice');
      const bob = analytics.speakers.find((s) => s.name === 'Bob');
      expect(alice?.sentenceCount).toBe(2);
      expect(bob?.sentenceCount).toBe(1);
    });

    it('calculates average sentence length', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({ text: 'One two three', speaker_id: '1', speaker_name: 'Alice' }), // 3 words
          createSentence({
            text: 'Four five six seven eight nine',
            speaker_id: '1',
            speaker_name: 'Alice',
          }), // 6 words
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.speakers[0]?.averageSentenceLength).toBe(4.5); // (3+6)/2 = 4.5
    });

    it('returns 0 average sentence length when no sentences', () => {
      const transcript = createTranscript({ sentences: [] });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.speakers).toHaveLength(0);
    });
  });

  describe('turn counting', () => {
    it('counts speaker turns correctly', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({ speaker_id: '1', speaker_name: 'Alice' }),
          createSentence({ speaker_id: '2', speaker_name: 'Bob' }),
          createSentence({ speaker_id: '1', speaker_name: 'Alice' }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      const alice = analytics.speakers.find((s) => s.name === 'Alice');
      const bob = analytics.speakers.find((s) => s.name === 'Bob');
      expect(alice?.turnCount).toBe(2);
      expect(bob?.turnCount).toBe(1);
    });

    it('consecutive sentences from same speaker count as one turn', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({ speaker_id: '1', speaker_name: 'Alice' }),
          createSentence({ speaker_id: '1', speaker_name: 'Alice' }),
          createSentence({ speaker_id: '1', speaker_name: 'Alice' }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.speakers[0]?.turnCount).toBe(1);
    });
  });

  describe('balance classification', () => {
    it('returns balanced for equal participation', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            start_time: '0.0',
            end_time: '10.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          }),
          createSentence({
            start_time: '10.0',
            end_time: '20.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          }),
          createSentence({
            start_time: '20.0',
            end_time: '30.0',
            speaker_id: '3',
            speaker_name: 'Charlie',
          }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.balance).toBe('balanced');
    });

    it('returns unbalanced for 40-60% dominance', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            start_time: '0.0',
            end_time: '50.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          }), // 50%
          createSentence({
            start_time: '50.0',
            end_time: '75.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          }), // 25%
          createSentence({
            start_time: '75.0',
            end_time: '100.0',
            speaker_id: '3',
            speaker_name: 'Charlie',
          }), // 25%
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.balance).toBe('unbalanced');
    });

    it('returns dominated for >60% dominance', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            start_time: '0.0',
            end_time: '70.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          }), // 70%
          createSentence({
            start_time: '70.0',
            end_time: '85.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          }), // 15%
          createSentence({
            start_time: '85.0',
            end_time: '100.0',
            speaker_id: '3',
            speaker_name: 'Charlie',
          }), // 15%
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.balance).toBe('dominated');
    });

    it('returns balanced for 2 or fewer speakers regardless of dominance', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            start_time: '0.0',
            end_time: '90.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          }), // 90%
          createSentence({
            start_time: '90.0',
            end_time: '100.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          }), // 10%
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.balance).toBe('balanced');
    });
  });

  describe('dominant speaker', () => {
    it('identifies speaker with most talk time', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            start_time: '0.0',
            end_time: '60.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          }),
          createSentence({
            start_time: '60.0',
            end_time: '80.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.dominantSpeaker).toBe('Alice');
      expect(analytics.dominantSpeakerPercentage).toBe(75);
    });

    it('sorts speakers by talk time descending', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            start_time: '0.0',
            end_time: '10.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          }),
          createSentence({
            start_time: '10.0',
            end_time: '40.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          }),
          createSentence({
            start_time: '40.0',
            end_time: '60.0',
            speaker_id: '3',
            speaker_name: 'Charlie',
          }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.speakers[0]?.name).toBe('Bob'); // 30s
      expect(analytics.speakers[1]?.name).toBe('Charlie'); // 20s
      expect(analytics.speakers[2]?.name).toBe('Alice'); // 10s
    });
  });

  describe('totals', () => {
    it('calculates total duration from first to last sentence', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            start_time: '5.0',
            end_time: '15.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          }),
          createSentence({
            start_time: '20.0',
            end_time: '50.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.totalDuration).toBe(50); // Last end_time
    });

    it('calculates total talk time across all speakers', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            start_time: '0.0',
            end_time: '10.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          }),
          createSentence({
            start_time: '15.0',
            end_time: '30.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.totalTalkTime).toBe(25); // 10 + 15
    });

    it('calculates total sentences', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({ speaker_id: '1', speaker_name: 'Alice' }),
          createSentence({ speaker_id: '1', speaker_name: 'Alice' }),
          createSentence({ speaker_id: '2', speaker_name: 'Bob' }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.totalSentences).toBe(3);
    });

    it('calculates total words', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({ text: 'Hello world', speaker_id: '1', speaker_name: 'Alice' }),
          createSentence({ text: 'Goodbye everyone here', speaker_id: '2', speaker_name: 'Bob' }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.totalWords).toBe(5);
    });
  });

  describe('edge cases', () => {
    it('returns empty analytics for transcript with no sentences', () => {
      const transcript = createTranscript({ sentences: [] });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.speakers).toHaveLength(0);
      expect(analytics.totalDuration).toBe(0);
      expect(analytics.totalTalkTime).toBe(0);
      expect(analytics.totalSentences).toBe(0);
      expect(analytics.totalWords).toBe(0);
      expect(analytics.dominantSpeaker).toBe('');
      expect(analytics.dominantSpeakerPercentage).toBe(0);
      expect(analytics.balance).toBe('balanced');
    });

    it('handles single speaker meeting', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            start_time: '0.0',
            end_time: '60.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.speakers).toHaveLength(1);
      expect(analytics.speakers[0]?.talkTimePercentage).toBe(100);
      expect(analytics.dominantSpeaker).toBe('Alice');
      expect(analytics.balance).toBe('balanced'); // Single speaker = balanced
    });

    it('handles speakers with no talk time', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            start_time: '0.0',
            end_time: '0.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          }),
          createSentence({
            start_time: '0.0',
            end_time: '10.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      const alice = analytics.speakers.find((s) => s.name === 'Alice');
      expect(alice?.talkTime).toBe(0);
      expect(alice?.talkTimePercentage).toBe(0);
    });

    it('handles undefined sentences array', () => {
      const transcript = createTranscript();
      // Force undefined sentences
      (transcript as unknown as { sentences: undefined }).sentences = undefined;

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.speakers).toHaveLength(0);
      expect(analytics.totalSentences).toBe(0);
    });
  });

  describe('options', () => {
    it('rounds percentages by default', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            start_time: '0.0',
            end_time: '33.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          }),
          createSentence({
            start_time: '33.0',
            end_time: '100.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(Number.isInteger(analytics.speakers[0]?.talkTimePercentage)).toBe(true);
      expect(Number.isInteger(analytics.speakers[1]?.talkTimePercentage)).toBe(true);
    });

    it('preserves decimal percentages when roundPercentages is false', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            start_time: '0.0',
            end_time: '10.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          }),
          createSentence({
            start_time: '10.0',
            end_time: '30.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          }),
          createSentence({
            start_time: '30.0',
            end_time: '60.0',
            speaker_id: '3',
            speaker_name: 'Charlie',
          }),
        ],
      });

      const analytics = analyzeSpeakers(transcript, { roundPercentages: false });

      // 10/60 = 16.666...%, 20/60 = 33.333...%, 30/60 = 50%
      const alice = analytics.speakers.find((s) => s.name === 'Alice');
      const bob = analytics.speakers.find((s) => s.name === 'Bob');
      expect(alice?.talkTimePercentage).toBeCloseTo(16.6667, 3);
      expect(bob?.talkTimePercentage).toBeCloseTo(33.3333, 3);
    });

    it('uses custom unbalancedThreshold', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            start_time: '0.0',
            end_time: '35.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          }), // 35%
          createSentence({
            start_time: '35.0',
            end_time: '70.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          }), // 35%
          createSentence({
            start_time: '70.0',
            end_time: '100.0',
            speaker_id: '3',
            speaker_name: 'Charlie',
          }), // 30%
        ],
      });

      // Default threshold 40% - should be balanced
      expect(analyzeSpeakers(transcript).balance).toBe('balanced');

      // Custom threshold 30% - should be unbalanced
      expect(analyzeSpeakers(transcript, { unbalancedThreshold: 30 }).balance).toBe('unbalanced');
    });

    it('uses custom dominatedThreshold', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            start_time: '0.0',
            end_time: '55.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          }), // 55%
          createSentence({
            start_time: '55.0',
            end_time: '80.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          }), // 25%
          createSentence({
            start_time: '80.0',
            end_time: '100.0',
            speaker_id: '3',
            speaker_name: 'Charlie',
          }), // 20%
        ],
      });

      // Default threshold 60% - should be unbalanced
      expect(analyzeSpeakers(transcript).balance).toBe('unbalanced');

      // Custom threshold 50% - should be dominated
      expect(analyzeSpeakers(transcript, { dominatedThreshold: 50 }).balance).toBe('dominated');
    });
  });

  describe('speaker identification', () => {
    it('includes speaker id in stats', () => {
      const transcript = createTranscript({
        sentences: [createSentence({ speaker_id: 'speaker-123', speaker_name: 'Alice' })],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.speakers[0]?.id).toBe('speaker-123');
    });

    it('groups sentences by speaker_id not speaker_name when mergeSpeakersByName is false', () => {
      // Same name but different IDs - should NOT merge when disabled
      const transcript = createTranscript({
        sentences: [
          createSentence({
            speaker_id: '1',
            speaker_name: 'Alice',
            start_time: '0.0',
            end_time: '10.0',
          }),
          createSentence({
            speaker_id: '2',
            speaker_name: 'Alice',
            start_time: '10.0',
            end_time: '20.0',
          }),
        ],
      });

      const analytics = analyzeSpeakers(transcript, { mergeSpeakersByName: false });

      expect(analytics.speakers).toHaveLength(2);
    });
  });

  describe('mergeSpeakersByName', () => {
    it('merges speakers with identical names by default', () => {
      // Simulates Fireflies diarization bug: same person, different IDs
      const transcript = createTranscript({
        sentences: [
          createSentence({
            speaker_id: '0',
            speaker_name: 'Robert Lippert',
            text: 'Hello',
            start_time: '0.0',
            end_time: '10.0',
          }),
          createSentence({
            speaker_id: '1',
            speaker_name: 'Robert Lippert',
            text: 'world',
            start_time: '10.0',
            end_time: '20.0',
          }),
          createSentence({
            speaker_id: '2',
            speaker_name: 'Alice',
            text: 'Hi there',
            start_time: '20.0',
            end_time: '30.0',
          }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.speakers).toHaveLength(2);
      const robert = analytics.speakers.find((s) => s.name === 'Robert Lippert');
      expect(robert?.talkTime).toBe(20);
      expect(robert?.wordCount).toBe(2);
      expect(robert?.sentenceCount).toBe(2);
    });

    it('combines talk time when merging', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            speaker_id: '0',
            speaker_name: 'Bob',
            start_time: '0.0',
            end_time: '30.0',
          }),
          createSentence({
            speaker_id: '1',
            speaker_name: 'Bob',
            start_time: '30.0',
            end_time: '50.0',
          }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.speakers).toHaveLength(1);
      expect(analytics.speakers[0]?.talkTime).toBe(50);
      expect(analytics.speakers[0]?.talkTimePercentage).toBe(100);
    });

    it('uses first encountered speaker ID when merging', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({ speaker_id: 'first-id', speaker_name: 'Bob' }),
          createSentence({ speaker_id: 'second-id', speaker_name: 'Bob' }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.speakers[0]?.id).toBe('first-id');
    });

    it('correctly counts turns after merging (consecutive same-name = 1 turn)', () => {
      // This is the key diarization fix: alternating IDs for same speaker should be 1 turn
      const transcript = createTranscript({
        sentences: [
          createSentence({ speaker_id: '0', speaker_name: 'Bob' }),
          createSentence({ speaker_id: '1', speaker_name: 'Bob' }), // Same person, diff ID
          createSentence({ speaker_id: '0', speaker_name: 'Bob' }), // Same person, diff ID
          createSentence({ speaker_id: '2', speaker_name: 'Alice' }), // Different person
          createSentence({ speaker_id: '0', speaker_name: 'Bob' }), // Bob again
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      const bob = analytics.speakers.find((s) => s.name === 'Bob');
      const alice = analytics.speakers.find((s) => s.name === 'Alice');
      expect(bob?.turnCount).toBe(2); // Turn 1: sentences 0-2, Turn 2: sentence 4
      expect(alice?.turnCount).toBe(1);
    });

    it('does not merge when mergeSpeakersByName is false', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            speaker_id: '0',
            speaker_name: 'Bob',
            start_time: '0.0',
            end_time: '10.0',
          }),
          createSentence({
            speaker_id: '1',
            speaker_name: 'Bob',
            start_time: '10.0',
            end_time: '20.0',
          }),
        ],
      });

      const analytics = analyzeSpeakers(transcript, { mergeSpeakersByName: false });

      expect(analytics.speakers).toHaveLength(2);
      expect(analytics.speakers[0]?.talkTime).toBe(10);
      expect(analytics.speakers[1]?.talkTime).toBe(10);
    });

    it('handles mix of merged and unmerged speakers', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            speaker_id: '0',
            speaker_name: 'Bob',
            start_time: '0.0',
            end_time: '10.0',
          }),
          createSentence({
            speaker_id: '1',
            speaker_name: 'Bob',
            start_time: '10.0',
            end_time: '20.0',
          }),
          createSentence({
            speaker_id: '2',
            speaker_name: 'Alice',
            start_time: '20.0',
            end_time: '30.0',
          }),
          createSentence({
            speaker_id: '3',
            speaker_name: 'Charlie',
            start_time: '30.0',
            end_time: '40.0',
          }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      expect(analytics.speakers).toHaveLength(3);
      const bob = analytics.speakers.find((s) => s.name === 'Bob');
      expect(bob?.talkTime).toBe(20);
    });

    it('calculates correct WPM after merging', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({
            speaker_id: '0',
            speaker_name: 'Bob',
            text: 'One two three four five', // 5 words
            start_time: '0.0',
            end_time: '30.0', // 30 seconds
          }),
          createSentence({
            speaker_id: '1',
            speaker_name: 'Bob',
            text: 'Six seven eight nine ten', // 5 words
            start_time: '30.0',
            end_time: '60.0', // 30 seconds
          }),
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      // 10 words / 1 minute = 10 WPM
      expect(analytics.speakers[0]?.wordsPerMinute).toBe(10);
    });

    it('calculates correct average sentence length after merging', () => {
      const transcript = createTranscript({
        sentences: [
          createSentence({ speaker_id: '0', speaker_name: 'Bob', text: 'One two' }), // 2 words
          createSentence({ speaker_id: '1', speaker_name: 'Bob', text: 'Three four five six' }), // 4 words
        ],
      });

      const analytics = analyzeSpeakers(transcript);

      // (2 + 4) / 2 = 3
      expect(analytics.speakers[0]?.averageSentenceLength).toBe(3);
    });
  });
});
