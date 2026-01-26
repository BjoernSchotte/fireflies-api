import type { TranscriptionChunk } from '../realtime/types.js';
import type { Sentence, Summary, Transcript } from '../types/transcript.js';

/**
 * Options for transcriptToMarkdown().
 */
export interface MarkdownExportOptions {
  /** Include meeting metadata header (title, date, participants, duration). Default: true */
  includeMetadata?: boolean;
  /** Include AI-generated summary sections. Default: true */
  includeSummary?: boolean;
  /** Include action items section. Default: true */
  includeActionItems?: boolean;
  /** Format for action items: checkbox or plain list. Default: 'checkbox' */
  actionItemFormat?: 'checkbox' | 'list';
  /** Include timestamps for each sentence. Default: false */
  includeTimestamps?: boolean;
  /** How to format speaker names. Default: 'bold' */
  speakerFormat?: 'bold' | 'plain';
  /** Group consecutive sentences by same speaker. Default: true */
  groupBySpeaker?: boolean;
  /** Write output to file path (Node.js only). If set, also returns the string. */
  outputPath?: string;
}

/**
 * Options for chunksToMarkdown().
 */
export interface ChunksExportOptions {
  /** Meeting title (chunks don't include metadata). Default: 'Live Transcript' */
  title?: string;
  /** Include timestamps for each chunk. Default: false */
  includeTimestamps?: boolean;
  /** How to format speaker names. Default: 'bold' */
  speakerFormat?: 'bold' | 'plain';
  /** Group consecutive chunks by same speaker. Default: true */
  groupBySpeaker?: boolean;
  /** Write output to file path (Node.js only). If set, also returns the string. */
  outputPath?: string;
}

const DEFAULT_OPTIONS: Required<Omit<MarkdownExportOptions, 'outputPath'>> = {
  includeMetadata: true,
  includeSummary: true,
  includeActionItems: true,
  actionItemFormat: 'checkbox',
  includeTimestamps: false,
  speakerFormat: 'bold',
  groupBySpeaker: true,
};

const DEFAULT_CHUNKS_OPTIONS: Required<Omit<ChunksExportOptions, 'outputPath'>> = {
  title: 'Live Transcript',
  includeTimestamps: false,
  speakerFormat: 'bold',
  groupBySpeaker: true,
};

/**
 * Convert a completed Fireflies transcript to well-formatted Markdown.
 *
 * @param transcript - The transcript to convert
 * @param options - Formatting options
 * @returns Markdown string representation of the transcript
 *
 * @example
 * ```typescript
 * import { FirefliesClient, transcriptToMarkdown } from 'fireflies-api';
 *
 * const client = new FirefliesClient({ apiKey: 'your-api-key' });
 * const transcript = await client.transcripts.get('transcript-id');
 *
 * // Basic usage
 * const markdown = await transcriptToMarkdown(transcript);
 *
 * // With options
 * const markdown = await transcriptToMarkdown(transcript, {
 *   includeTimestamps: true,
 *   actionItemFormat: 'list',
 * });
 *
 * // Write to file
 * const markdown = await transcriptToMarkdown(transcript, {
 *   outputPath: './meeting-notes.md',
 * });
 * ```
 */
export async function transcriptToMarkdown(
  transcript: Transcript,
  options: MarkdownExportOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const sections: string[] = [];

  if (opts.includeMetadata) {
    sections.push(formatMetadata(transcript));
  }

  if (opts.includeSummary && transcript.summary) {
    sections.push(formatSummary(transcript.summary, opts));
  }

  if (transcript.sentences && transcript.sentences.length > 0) {
    sections.push(formatTranscript(transcript.sentences, opts));
  }

  const content = sections.join('\n\n---\n\n');
  await writeIfOutputPath(content, options.outputPath);
  return content;
}

/**
 * Convert realtime transcription chunks to well-formatted Markdown.
 *
 * @param chunks - Array of transcription chunks from realtime stream
 * @param options - Formatting options
 * @returns Markdown string representation of the chunks
 *
 * @example
 * ```typescript
 * import { FirefliesClient, chunksToMarkdown } from 'fireflies-api';
 *
 * const client = new FirefliesClient({ apiKey: 'your-api-key' });
 *
 * // Accumulate chunks from realtime stream
 * const chunks: TranscriptionChunk[] = [];
 * for await (const chunk of client.realtime.stream(meetingId)) {
 *   chunks.push(chunk);
 * }
 *
 * // Convert to markdown
 * const markdown = await chunksToMarkdown(chunks);
 *
 * // With options
 * const markdown = await chunksToMarkdown(chunks, {
 *   title: 'Team Standup',
 *   includeTimestamps: true,
 * });
 * ```
 */
export async function chunksToMarkdown(
  chunks: TranscriptionChunk[],
  options: ChunksExportOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_CHUNKS_OPTIONS, ...options };

  const lines: string[] = [`# ${opts.title}`];

  if (chunks.length === 0) {
    lines.push('', '## Transcript', '', '*No transcription data*');
  } else {
    lines.push('', '## Transcript');

    if (opts.groupBySpeaker) {
      const groups = groupChunksBySpeaker(chunks);
      for (const group of groups) {
        lines.push('', formatChunkGroup(group, opts));
      }
    } else {
      for (const chunk of chunks) {
        lines.push('', formatChunk(chunk, opts));
      }
    }
  }

  const content = lines.join('\n');
  await writeIfOutputPath(content, options.outputPath);
  return content;
}

// --- Internal helpers ---

function formatMetadata(transcript: Transcript): string {
  const lines = [`# ${transcript.title || 'Untitled Meeting'}`];

  if (transcript.dateString) {
    lines.push(`\n**Date:** ${formatDate(transcript.dateString)}`);
  }

  // Calculate duration from last sentence end_time (more accurate than duration field)
  const duration = calculateDuration(transcript);
  if (duration > 0) {
    lines.push(`**Duration:** ${formatDuration(duration)}`);
  }

  const participants = getParticipantNames(transcript);
  if (participants.length > 0) {
    lines.push(`**Participants:** ${participants.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Calculate actual meeting duration from sentence timestamps.
 * The API's duration field is often inaccurate, so we use the last sentence's end_time.
 */
function calculateDuration(transcript: Transcript): number {
  if (transcript.sentences && transcript.sentences.length > 0) {
    const lastSentence = transcript.sentences[transcript.sentences.length - 1];
    if (lastSentence) {
      return parseFloat(lastSentence.end_time);
    }
  }
  return transcript.duration || 0;
}

function formatSummary(
  summary: Summary,
  opts: Required<Omit<MarkdownExportOptions, 'outputPath'>>
): string {
  const sections: string[] = ['## Summary'];

  if (summary.gist) {
    sections.push('', summary.gist);
  }

  if (summary.bullet_gist) {
    const bullets = parseMultilineField(summary.bullet_gist);
    if (bullets.length > 0) {
      sections.push('', '### Key Points');
      sections.push(bullets.map((p) => `- ${p}`).join('\n'));
    }
  }

  if (opts.includeActionItems && summary.action_items) {
    const items = parseMultilineField(summary.action_items);
    if (items.length > 0) {
      sections.push('', '### Action Items');
      const prefix = opts.actionItemFormat === 'checkbox' ? '- [ ] ' : '- ';
      sections.push(items.map((a) => `${prefix}${a}`).join('\n'));
    }
  }

  return sections.join('\n');
}

function formatTranscript(
  sentences: Sentence[],
  opts: Required<Omit<MarkdownExportOptions, 'outputPath'>>
): string {
  const lines: string[] = ['## Transcript'];

  if (opts.groupBySpeaker) {
    const groups = groupSentencesBySpeaker(sentences);
    for (const group of groups) {
      lines.push('', formatSpeakerGroup(group, opts));
    }
  } else {
    for (const sentence of sentences) {
      lines.push('', formatSentence(sentence, opts));
    }
  }

  return lines.join('\n');
}

interface SpeakerGroup {
  speakerName: string;
  sentences: Sentence[];
}

function groupSentencesBySpeaker(sentences: Sentence[]): SpeakerGroup[] {
  const groups: SpeakerGroup[] = [];
  let current: SpeakerGroup | null = null;

  for (const sentence of sentences) {
    if (!current || current.speakerName !== sentence.speaker_name) {
      current = { speakerName: sentence.speaker_name, sentences: [] };
      groups.push(current);
    }
    current.sentences.push(sentence);
  }

  return groups;
}

function formatSpeakerGroup(
  group: SpeakerGroup,
  opts: Required<Omit<MarkdownExportOptions, 'outputPath'>>
): string {
  const speaker = formatSpeakerName(group.speakerName, opts.speakerFormat);
  const text = group.sentences.map((s) => s.text).join(' ');

  const firstSentence = group.sentences[0];
  if (opts.includeTimestamps && firstSentence) {
    const timestamp = formatTimestamp(firstSentence.start_time);
    return `${timestamp} ${speaker} ${text}`;
  }
  return `${speaker} ${text}`;
}

function formatSentence(
  sentence: Sentence,
  opts: Required<Omit<MarkdownExportOptions, 'outputPath'>>
): string {
  const speaker = formatSpeakerName(sentence.speaker_name, opts.speakerFormat);

  if (opts.includeTimestamps) {
    const timestamp = formatTimestamp(sentence.start_time);
    return `${timestamp} ${speaker} ${sentence.text}`;
  }
  return `${speaker} ${sentence.text}`;
}

interface ChunkGroup {
  speakerName: string;
  chunks: TranscriptionChunk[];
}

function groupChunksBySpeaker(chunks: TranscriptionChunk[]): ChunkGroup[] {
  const groups: ChunkGroup[] = [];
  let current: ChunkGroup | null = null;

  for (const chunk of chunks) {
    if (!current || current.speakerName !== chunk.speaker_name) {
      current = { speakerName: chunk.speaker_name, chunks: [] };
      groups.push(current);
    }
    current.chunks.push(chunk);
  }

  return groups;
}

function formatChunkGroup(
  group: ChunkGroup,
  opts: Required<Omit<ChunksExportOptions, 'outputPath'>>
): string {
  const speaker = formatSpeakerName(group.speakerName, opts.speakerFormat);
  const text = group.chunks.map((c) => c.text).join(' ');

  const firstChunk = group.chunks[0];
  if (opts.includeTimestamps && firstChunk) {
    const timestamp = formatTimestamp(firstChunk.start_time.toString());
    return `${timestamp} ${speaker} ${text}`;
  }
  return `${speaker} ${text}`;
}

function formatChunk(
  chunk: TranscriptionChunk,
  opts: Required<Omit<ChunksExportOptions, 'outputPath'>>
): string {
  const speaker = formatSpeakerName(chunk.speaker_name, opts.speakerFormat);

  if (opts.includeTimestamps) {
    const timestamp = formatTimestamp(chunk.start_time.toString());
    return `${timestamp} ${speaker} ${chunk.text}`;
  }
  return `${speaker} ${chunk.text}`;
}

function formatSpeakerName(name: string, format: 'bold' | 'plain'): string {
  switch (format) {
    case 'bold':
      return `**${name}:**`;
    case 'plain':
      return `${name}:`;
  }
}

function formatTimestamp(startTime: string): string {
  const seconds = parseFloat(startTime);
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `[${mins}:${secs.toString().padStart(2, '0')}]`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins} minutes`;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getParticipantNames(transcript: Transcript): string[] {
  if (transcript.meeting_attendees?.length) {
    return transcript.meeting_attendees
      .map((a) => a.displayName || a.name || a.email)
      .filter(Boolean) as string[];
  }
  return transcript.speakers?.map((s) => s.name) || [];
}

/**
 * Parse newline-separated summary fields into an array.
 * Handles both \n and actual newlines, filters empty lines.
 */
function parseMultilineField(value: string): string[] {
  return value
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

async function writeIfOutputPath(content: string, outputPath?: string): Promise<void> {
  if (outputPath) {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(outputPath, content, 'utf-8');
  }
}
