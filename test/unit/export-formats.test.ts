import { describe, expect, it } from 'vitest';
import {
  createZipArchive,
  exportTranscript,
  generateExportFilename,
  sanitizeFilename,
  transcriptToCsv,
  transcriptToText,
} from '../../src/helpers/export-formats.js';
import type { Transcript } from '../../src/types/transcript.js';

/**
 * Helper to create a minimal transcript for testing.
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
    duration: 3600,
    dateString: '2024-01-15T10:00:00Z',
    date: 1705312800000,
    sentences: [],
    channels: [],
    ...overrides,
  };
}

describe('transcriptToText', () => {
  describe('metadata formatting', () => {
    it('includes title as header', () => {
      const transcript = createTranscript({ title: 'Weekly Standup' });
      const text = transcriptToText(transcript);
      expect(text).toContain('Weekly Standup');
    });

    it('includes formatted date', () => {
      const transcript = createTranscript({ dateString: '2024-01-15T10:00:00Z' });
      const text = transcriptToText(transcript);
      expect(text).toContain('January');
      expect(text).toContain('2024');
    });

    it('includes participants', () => {
      const transcript = createTranscript({
        meeting_attendees: [
          { displayName: 'Alice', email: 'alice@company.com', name: 'Alice A' },
          { displayName: 'Bob', email: 'bob@company.com', name: 'Bob B' },
        ],
      });
      const text = transcriptToText(transcript);
      expect(text).toContain('Alice');
      expect(text).toContain('Bob');
    });

    it('omits metadata with includeMetadata: false', () => {
      const transcript = createTranscript({ title: 'Test Meeting' });
      const text = transcriptToText(transcript, { includeMetadata: false });
      expect(text).not.toContain('Test Meeting');
      expect(text).not.toContain('Date:');
    });
  });

  describe('transcript formatting', () => {
    it('formats sentences with speaker labels', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'Hello everyone.',
            raw_text: 'Hello everyone.',
            start_time: '0.0',
            end_time: '2.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
          {
            index: 1,
            text: 'Hi Alice!',
            raw_text: 'Hi Alice!',
            start_time: '3.0',
            end_time: '4.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          },
        ],
      });
      const text = transcriptToText(transcript);
      expect(text).toContain('Alice: Hello everyone.');
      expect(text).toContain('Bob: Hi Alice!');
    });

    it('groups consecutive sentences by same speaker', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'Hello everyone.',
            raw_text: 'Hello everyone.',
            start_time: '0.0',
            end_time: '2.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
          {
            index: 1,
            text: 'Lets get started.',
            raw_text: 'Lets get started.',
            start_time: '2.5',
            end_time: '4.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
        ],
      });
      const text = transcriptToText(transcript);
      // Should appear as single block, not two separate Alice: lines
      expect(text).toContain('Alice: Hello everyone. Lets get started.');
    });

    it('includes timestamps when includeTimestamps: true', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'First sentence.',
            raw_text: 'First sentence.',
            start_time: '65.5',
            end_time: '68.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
        ],
      });
      const text = transcriptToText(transcript, { includeTimestamps: true });
      expect(text).toContain('[1:05]');
    });

    it('handles empty sentences array', () => {
      const transcript = createTranscript({ sentences: [] });
      const text = transcriptToText(transcript);
      expect(text).toBeDefined();
      // Should just have metadata, no transcript section
    });
  });

  describe('edge cases', () => {
    it('handles missing title', () => {
      const transcript = createTranscript({ title: '' });
      const text = transcriptToText(transcript);
      expect(text).toContain('Untitled Meeting');
    });

    it('handles special characters in text', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'Price is $100 & includes "extras"',
            raw_text: 'Price is $100 & includes "extras"',
            start_time: '0.0',
            end_time: '3.0',
            speaker_id: '1',
            speaker_name: 'Sales Rep',
          },
        ],
      });
      const text = transcriptToText(transcript);
      expect(text).toContain('Sales Rep: Price is $100 & includes "extras"');
    });

    it('handles empty speaker name', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'Unknown speaker text.',
            raw_text: 'Unknown speaker text.',
            start_time: '0.0',
            end_time: '2.0',
            speaker_id: '1',
            speaker_name: '',
          },
        ],
      });
      const text = transcriptToText(transcript);
      expect(text).toContain('Unknown speaker text.');
    });
  });
});

describe('transcriptToCsv', () => {
  describe('header and basic formatting', () => {
    it('includes CSV header by default', () => {
      const transcript = createTranscript({ sentences: [] });
      const csv = transcriptToCsv(transcript);
      expect(csv).toContain('timestamp,speaker,text,is_question,is_task');
    });

    it('omits header when includeHeader: false', () => {
      const transcript = createTranscript({ sentences: [] });
      const csv = transcriptToCsv(transcript, { includeHeader: false });
      expect(csv).not.toContain('timestamp,speaker,text');
    });

    it('uses custom delimiter', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'Hello',
            raw_text: 'Hello',
            start_time: '0.0',
            end_time: '1.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
        ],
      });
      const csv = transcriptToCsv(transcript, { delimiter: ';' });
      expect(csv).toContain('timestamp;speaker;text');
      expect(csv).toContain('0.0;Alice;Hello');
    });
  });

  describe('data rows', () => {
    it('outputs one row per sentence', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'First sentence.',
            raw_text: 'First sentence.',
            start_time: '0.0',
            end_time: '2.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
          {
            index: 1,
            text: 'Second sentence.',
            raw_text: 'Second sentence.',
            start_time: '3.0',
            end_time: '5.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          },
        ],
      });
      const csv = transcriptToCsv(transcript);
      const lines = csv.trim().split('\n');
      // Header + 2 data rows
      expect(lines.length).toBe(3);
    });

    it('includes ai_filters for question and task', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'What is the deadline?',
            raw_text: 'What is the deadline?',
            start_time: '0.0',
            end_time: '2.0',
            speaker_id: '1',
            speaker_name: 'Alice',
            ai_filters: {
              question: 'What is the deadline?',
            },
          },
          {
            index: 1,
            text: 'Please review the PR.',
            raw_text: 'Please review the PR.',
            start_time: '3.0',
            end_time: '5.0',
            speaker_id: '2',
            speaker_name: 'Bob',
            ai_filters: {
              task: 'Please review the PR.',
            },
          },
        ],
      });
      const csv = transcriptToCsv(transcript);
      // is_question should be true for first row
      expect(csv).toContain(',true,false');
      // is_task should be true for second row
      expect(csv).toContain(',false,true');
    });
  });

  describe('CSV escaping', () => {
    it('escapes double quotes by doubling them', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'He said "hello"',
            raw_text: 'He said "hello"',
            start_time: '0.0',
            end_time: '2.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
        ],
      });
      const csv = transcriptToCsv(transcript);
      expect(csv).toContain('"He said ""hello"""');
    });

    it('wraps fields containing commas in quotes', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'One, two, three',
            raw_text: 'One, two, three',
            start_time: '0.0',
            end_time: '2.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
        ],
      });
      const csv = transcriptToCsv(transcript);
      expect(csv).toContain('"One, two, three"');
    });

    it('wraps fields containing newlines in quotes', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'Line one\nLine two',
            raw_text: 'Line one\nLine two',
            start_time: '0.0',
            end_time: '2.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
        ],
      });
      const csv = transcriptToCsv(transcript);
      expect(csv).toContain('"Line one\nLine two"');
    });

    it('handles combined special characters', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'He said, "yes"\nand left',
            raw_text: 'He said, "yes"\nand left',
            start_time: '0.0',
            end_time: '2.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
        ],
      });
      const csv = transcriptToCsv(transcript);
      expect(csv).toContain('"He said, ""yes""\nand left"');
    });

    it('handles empty text fields', () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: '',
            raw_text: '',
            start_time: '0.0',
            end_time: '1.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
        ],
      });
      const csv = transcriptToCsv(transcript);
      // Empty field should just be empty between delimiters
      expect(csv).toContain('0.0,Alice,');
    });
  });
});

describe('sanitizeFilename', () => {
  it('converts to lowercase and replaces spaces with hyphens', () => {
    expect(sanitizeFilename('Weekly Team Standup')).toBe('weekly-team-standup');
  });

  it('removes special characters', () => {
    expect(sanitizeFilename('Meeting @10am #important!')).toBe('meeting-10am-important');
  });

  it('collapses multiple hyphens', () => {
    expect(sanitizeFilename('foo---bar')).toBe('foo-bar');
  });

  it('trims leading and trailing hyphens', () => {
    expect(sanitizeFilename('---title---')).toBe('title');
  });

  it('truncates to max 100 characters', () => {
    const longTitle = 'a'.repeat(150);
    expect(sanitizeFilename(longTitle).length).toBeLessThanOrEqual(100);
  });

  it('handles empty string', () => {
    expect(sanitizeFilename('')).toBe('untitled');
  });
});

describe('generateExportFilename', () => {
  it('generates filename with date prefix and extension', () => {
    const transcript = createTranscript({
      title: 'Weekly Standup',
      dateString: '2024-01-15T10:00:00Z',
    });
    const filename = generateExportFilename(transcript, 'md');
    expect(filename).toBe('2024-01-15-weekly-standup.md');
  });

  it('sanitizes the title for filesystem safety', () => {
    const transcript = createTranscript({
      title: 'Client Review: ACME Corp!',
      dateString: '2024-01-16T14:00:00Z',
    });
    const filename = generateExportFilename(transcript, 'json');
    expect(filename).toBe('2024-01-16-client-review-acme-corp.json');
  });

  it('handles missing date gracefully', () => {
    const transcript = createTranscript({
      title: 'No Date Meeting',
      dateString: '',
    });
    const filename = generateExportFilename(transcript, 'txt');
    // Should use a fallback or just the title
    expect(filename).toMatch(/no-date-meeting\.txt$/);
  });

  it('handles various extensions', () => {
    const transcript = createTranscript({
      title: 'Test',
      dateString: '2024-01-15T10:00:00Z',
    });
    expect(generateExportFilename(transcript, 'csv')).toBe('2024-01-15-test.csv');
    expect(generateExportFilename(transcript, 'txt')).toBe('2024-01-15-test.txt');
  });
});

describe('exportTranscript', () => {
  const transcript = createTranscript({
    title: 'Test Meeting',
    sentences: [
      {
        index: 0,
        text: 'Hello world',
        raw_text: 'Hello world',
        start_time: '0.0',
        end_time: '2.0',
        speaker_id: '1',
        speaker_name: 'Alice',
      },
    ],
  });

  it('dispatches to markdown format', async () => {
    const result = await exportTranscript(transcript, 'markdown');
    expect(result).toContain('# Test Meeting');
    expect(result).toContain('**Alice:**');
  });

  it('dispatches to json format', async () => {
    const result = await exportTranscript(transcript, 'json');
    const parsed = JSON.parse(result);
    expect(parsed.title).toBe('Test Meeting');
    expect(parsed.sentences).toHaveLength(1);
  });

  it('dispatches to txt format', async () => {
    const result = await exportTranscript(transcript, 'txt');
    expect(result).toContain('Test Meeting');
    expect(result).toContain('Alice: Hello world');
  });

  it('dispatches to csv format', async () => {
    const result = await exportTranscript(transcript, 'csv');
    expect(result).toContain('timestamp,speaker,text');
    expect(result).toContain('0.0,Alice,Hello world');
  });
});

describe('createZipArchive', () => {
  it('creates a valid zip buffer from files', async () => {
    const files = [
      { filename: 'file1.txt', content: 'Hello' },
      { filename: 'file2.txt', content: 'World' },
    ];
    const zipBuffer = await createZipArchive(files);
    expect(zipBuffer).toBeInstanceOf(Buffer);
    expect(zipBuffer.length).toBeGreaterThan(0);
  });

  it('handles empty files array', async () => {
    const zipBuffer = await createZipArchive([]);
    expect(zipBuffer).toBeInstanceOf(Buffer);
  });

  it('preserves filenames in archive', async () => {
    const files = [{ filename: 'subdir/meeting.md', content: '# Meeting' }];
    const zipBuffer = await createZipArchive(files);
    expect(zipBuffer).toBeInstanceOf(Buffer);
    // The buffer should contain the filename string
    expect(zipBuffer.toString()).toContain('meeting.md');
  });
});
