import { describe, expect, it, vi } from 'vitest';
import { chunksToMarkdown, transcriptToMarkdown } from '../../src/helpers/markdown.js';
import type { TranscriptionChunk } from '../../src/realtime/types.js';
import type { Transcript } from '../../src/types/transcript.js';

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

function createChunk(overrides: Partial<TranscriptionChunk> = {}): TranscriptionChunk {
  return {
    chunk_id: 'chunk-1',
    speaker_name: 'Speaker',
    text: 'Hello world',
    start_time: 0,
    end_time: 5,
    isFinal: true,
    ...overrides,
  };
}

describe('transcriptToMarkdown', () => {
  describe('metadata formatting', () => {
    it('includes title', async () => {
      const transcript = createTranscript({ title: 'Weekly Standup' });
      const md = await transcriptToMarkdown(transcript);
      expect(md).toContain('# Weekly Standup');
    });

    it('uses default title for missing title', async () => {
      const transcript = createTranscript({ title: '' });
      const md = await transcriptToMarkdown(transcript);
      expect(md).toContain('# Untitled Meeting');
    });

    it('includes formatted date', async () => {
      const transcript = createTranscript({ dateString: '2024-01-15T10:00:00Z' });
      const md = await transcriptToMarkdown(transcript);
      expect(md).toContain('**Date:**');
      expect(md).toContain('January');
      expect(md).toContain('2024');
    });

    it('formats duration correctly for minutes only', async () => {
      const transcript = createTranscript({ duration: 2700 }); // 45 minutes
      const md = await transcriptToMarkdown(transcript);
      expect(md).toContain('**Duration:** 45 minutes');
    });

    it('formats duration correctly for hours and minutes', async () => {
      const transcript = createTranscript({ duration: 5400 }); // 1h 30m
      const md = await transcriptToMarkdown(transcript);
      expect(md).toContain('**Duration:** 1h 30m');
    });

    it('includes participants from meeting_attendees', async () => {
      const transcript = createTranscript({
        meeting_attendees: [
          { displayName: 'Alice', email: 'alice@company.com', name: 'Alice A' },
          { displayName: 'Bob', email: 'bob@company.com', name: 'Bob B' },
        ],
      });
      const md = await transcriptToMarkdown(transcript);
      expect(md).toContain('**Participants:** Alice, Bob');
    });

    it('falls back to speakers if no meeting_attendees', async () => {
      const transcript = createTranscript({
        meeting_attendees: [],
        speakers: [
          { id: '1', name: 'Charlie' },
          { id: '2', name: 'Dave' },
        ],
      });
      const md = await transcriptToMarkdown(transcript);
      expect(md).toContain('**Participants:** Charlie, Dave');
    });

    it('omits metadata with includeMetadata: false', async () => {
      const transcript = createTranscript({ title: 'Test Meeting' });
      const md = await transcriptToMarkdown(transcript, { includeMetadata: false });
      expect(md).not.toContain('# Test Meeting');
      expect(md).not.toContain('**Date:**');
    });
  });

  describe('summary formatting', () => {
    it('includes gist', async () => {
      const transcript = createTranscript({
        summary: { gist: 'This meeting discussed the Q1 roadmap.' },
      });
      const md = await transcriptToMarkdown(transcript);
      expect(md).toContain('## Summary');
      expect(md).toContain('This meeting discussed the Q1 roadmap.');
    });

    it('includes bullet gist as key points', async () => {
      const transcript = createTranscript({
        summary: { bullet_gist: 'Point one\nPoint two\nPoint three' },
      });
      const md = await transcriptToMarkdown(transcript);
      expect(md).toContain('### Key Points');
      expect(md).toContain('- Point one');
      expect(md).toContain('- Point two');
      expect(md).toContain('- Point three');
    });

    it('includes action items as checkboxes by default', async () => {
      const transcript = createTranscript({
        summary: { action_items: 'Review the PR\nSchedule follow-up meeting' },
      });
      const md = await transcriptToMarkdown(transcript);
      expect(md).toContain('### Action Items');
      expect(md).toContain('- [ ] Review the PR');
      expect(md).toContain('- [ ] Schedule follow-up meeting');
    });

    it('uses plain list for actionItemFormat: list', async () => {
      const transcript = createTranscript({
        summary: { action_items: 'Review the PR\nSchedule follow-up' },
      });
      const md = await transcriptToMarkdown(transcript, { actionItemFormat: 'list' });
      expect(md).toContain('- Review the PR');
      expect(md).toContain('- Schedule follow-up');
      expect(md).not.toContain('- [ ]');
    });

    it('omits action items with includeActionItems: false', async () => {
      const transcript = createTranscript({
        summary: { action_items: 'Some action item', gist: 'Summary here' },
      });
      const md = await transcriptToMarkdown(transcript, { includeActionItems: false });
      expect(md).toContain('## Summary');
      expect(md).not.toContain('### Action Items');
      expect(md).not.toContain('Some action item');
    });

    it('omits summary section with includeSummary: false', async () => {
      const transcript = createTranscript({
        summary: { gist: 'Important summary', action_items: 'Action' },
      });
      const md = await transcriptToMarkdown(transcript, { includeSummary: false });
      expect(md).not.toContain('## Summary');
      expect(md).not.toContain('Important summary');
    });

    it('handles missing summary gracefully', async () => {
      const transcript = createTranscript({ summary: undefined });
      const md = await transcriptToMarkdown(transcript);
      expect(md).not.toContain('## Summary');
    });

    it('handles empty summary fields gracefully', async () => {
      const transcript = createTranscript({
        summary: { gist: '', bullet_gist: '', action_items: '' },
      });
      const md = await transcriptToMarkdown(transcript);
      expect(md).toContain('## Summary');
      // Empty fields should not create malformed output
      expect(md).not.toContain('### Key Points');
      expect(md).not.toContain('### Action Items');
    });
  });

  describe('transcript formatting', () => {
    it('groups consecutive sentences by speaker (default)', async () => {
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
          {
            index: 2,
            text: 'Sounds good.',
            raw_text: 'Sounds good.',
            start_time: '5.0',
            end_time: '6.0',
            speaker_id: '2',
            speaker_name: 'Bob',
          },
        ],
      });
      const md = await transcriptToMarkdown(transcript);
      expect(md).toContain('**Alice:** Hello everyone. Lets get started.');
      expect(md).toContain('**Bob:** Sounds good.');
    });

    it('does not group with groupBySpeaker: false', async () => {
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
      const md = await transcriptToMarkdown(transcript, { groupBySpeaker: false });
      expect(md).toContain('**Alice:** Hello everyone.');
      expect(md).toContain('**Alice:** Lets get started.');
    });

    it('includes timestamps with includeTimestamps: true', async () => {
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
      const md = await transcriptToMarkdown(transcript, { includeTimestamps: true });
      expect(md).toContain('[1:05]');
    });

    it('formats speaker as plain with speakerFormat: plain', async () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'Hello.',
            raw_text: 'Hello.',
            start_time: '0.0',
            end_time: '2.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
        ],
      });
      const md = await transcriptToMarkdown(transcript, { speakerFormat: 'plain' });
      expect(md).toContain('Alice:');
      expect(md).not.toContain('**Alice:**');
    });

    it('handles empty sentences array', async () => {
      const transcript = createTranscript({ sentences: [] });
      const md = await transcriptToMarkdown(transcript);
      expect(md).not.toContain('## Transcript');
    });
  });

  describe('section separators', () => {
    it('uses --- between sections', async () => {
      const transcript = createTranscript({
        summary: { gist: 'Summary here' },
        sentences: [
          {
            index: 0,
            text: 'Hello.',
            raw_text: 'Hello.',
            start_time: '0.0',
            end_time: '2.0',
            speaker_id: '1',
            speaker_name: 'Alice',
          },
        ],
      });
      const md = await transcriptToMarkdown(transcript);
      expect(md).toContain('---');
    });
  });

  describe('file output', () => {
    it('returns string regardless of outputPath', async () => {
      const transcript = createTranscript();

      // Mock fs/promises
      vi.mock('node:fs/promises', () => ({
        writeFile: vi.fn().mockResolvedValue(undefined),
      }));

      const md = await transcriptToMarkdown(transcript, {
        outputPath: '/tmp/test-output.md',
      });

      expect(typeof md).toBe('string');
      expect(md.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('handles transcript with only metadata', async () => {
      const transcript = createTranscript({
        title: 'Empty Meeting',
        summary: undefined,
        sentences: [],
      });
      const md = await transcriptToMarkdown(transcript);
      expect(md).toContain('# Empty Meeting');
      expect(md).not.toContain('## Summary');
      expect(md).not.toContain('## Transcript');
    });

    it('handles missing speaker names', async () => {
      const transcript = createTranscript({
        sentences: [
          {
            index: 0,
            text: 'Hello.',
            raw_text: 'Hello.',
            start_time: '0.0',
            end_time: '2.0',
            speaker_id: '1',
            speaker_name: '',
          },
        ],
      });
      const md = await transcriptToMarkdown(transcript);
      expect(md).toContain('**:** Hello.'); // Empty bold speaker name
    });
  });
});

describe('chunksToMarkdown', () => {
  it('converts chunks array to markdown', async () => {
    const chunks = [
      createChunk({ speaker_name: 'Alice', text: 'Hello' }),
      createChunk({ speaker_name: 'Bob', text: 'Hi there' }),
    ];
    const md = await chunksToMarkdown(chunks);
    expect(md).toContain('# Live Transcript');
    expect(md).toContain('## Transcript');
    expect(md).toContain('**Alice:** Hello');
    expect(md).toContain('**Bob:** Hi there');
  });

  it('groups consecutive chunks by speaker (default)', async () => {
    const chunks = [
      createChunk({ speaker_name: 'Alice', text: 'Hello' }),
      createChunk({ speaker_name: 'Alice', text: 'how are you' }),
      createChunk({ speaker_name: 'Bob', text: 'Great' }),
    ];
    const md = await chunksToMarkdown(chunks);
    expect(md).toContain('**Alice:** Hello how are you');
    expect(md).toContain('**Bob:** Great');
  });

  it('does not group with groupBySpeaker: false', async () => {
    const chunks = [
      createChunk({ speaker_name: 'Alice', text: 'Hello' }),
      createChunk({ speaker_name: 'Alice', text: 'how are you' }),
    ];
    const md = await chunksToMarkdown(chunks, { groupBySpeaker: false });
    expect(md).toContain('**Alice:** Hello');
    expect(md).toContain('**Alice:** how are you');
  });

  it('formats timestamps correctly (number to string)', async () => {
    const chunks = [createChunk({ speaker_name: 'Alice', text: 'Hello', start_time: 125.5 })];
    const md = await chunksToMarkdown(chunks, { includeTimestamps: true });
    expect(md).toContain('[2:05]');
  });

  it('uses custom title when provided', async () => {
    const chunks = [createChunk()];
    const md = await chunksToMarkdown(chunks, { title: 'Team Standup' });
    expect(md).toContain('# Team Standup');
    expect(md).not.toContain('Live Transcript');
  });

  it('handles empty chunks array', async () => {
    const chunks: TranscriptionChunk[] = [];
    const md = await chunksToMarkdown(chunks);
    expect(md).toContain('# Live Transcript');
    expect(md).toContain('## Transcript');
    expect(md).toContain('*No transcription data*');
  });

  it('handles speaker formats', async () => {
    const chunks = [createChunk({ speaker_name: 'Alice', text: 'Hello' })];

    const mdBold = await chunksToMarkdown(chunks, { speakerFormat: 'bold' });
    expect(mdBold).toContain('**Alice:**');

    const mdPlain = await chunksToMarkdown(chunks, { speakerFormat: 'plain' });
    expect(mdPlain).toContain('Alice:');
    expect(mdPlain).not.toContain('**Alice:**');
  });

  it('returns string regardless of outputPath', async () => {
    const chunks = [createChunk()];

    vi.mock('node:fs/promises', () => ({
      writeFile: vi.fn().mockResolvedValue(undefined),
    }));

    const md = await chunksToMarkdown(chunks, { outputPath: '/tmp/live-notes.md' });
    expect(typeof md).toBe('string');
    expect(md.length).toBeGreaterThan(0);
  });
});
