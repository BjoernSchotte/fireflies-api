import type { Sentence, Transcript } from '../types/transcript.js';
import { transcriptToMarkdown } from './markdown.js';

/**
 * Export format types supported by bulk export.
 */
export type ExportFormat = 'markdown' | 'json' | 'txt' | 'csv';

/**
 * Options for transcriptToText().
 */
export interface TextExportOptions {
  /** Include timestamps for each speaker turn. Default: false */
  includeTimestamps?: boolean;
  /** Include meeting metadata header (title, date, participants). Default: true */
  includeMetadata?: boolean;
}

/**
 * Options for transcriptToCsv().
 */
export interface CsvExportOptions {
  /** Include CSV header row. Default: true */
  includeHeader?: boolean;
  /** Field delimiter. Default: ',' */
  delimiter?: string;
}

/**
 * A file ready for export.
 */
export interface ExportFile {
  /** Filename with extension */
  filename: string;
  /** File content as string */
  content: string;
}

const DEFAULT_TEXT_OPTIONS: Required<TextExportOptions> = {
  includeTimestamps: false,
  includeMetadata: true,
};

const DEFAULT_CSV_OPTIONS: Required<CsvExportOptions> = {
  includeHeader: true,
  delimiter: ',',
};

/**
 * Convert a transcript to plain text format.
 *
 * @param transcript - The transcript to convert
 * @param options - Formatting options
 * @returns Plain text string with speaker labels
 *
 * @example
 * ```typescript
 * import { transcriptToText } from 'fireflies-api';
 *
 * const text = transcriptToText(transcript);
 * await writeFile('meeting.txt', text);
 * ```
 */
export function transcriptToText(transcript: Transcript, options: TextExportOptions = {}): string {
  const opts = { ...DEFAULT_TEXT_OPTIONS, ...options };
  const sections: string[] = [];

  if (opts.includeMetadata) {
    sections.push(formatTextMetadata(transcript));
  }

  if (transcript.sentences && transcript.sentences.length > 0) {
    sections.push(formatTextTranscript(transcript.sentences, opts));
  }

  return sections.join('\n\n');
}

/**
 * Convert a transcript to CSV format with one row per sentence.
 *
 * @param transcript - The transcript to convert
 * @param options - CSV formatting options
 * @returns CSV string with headers and properly escaped values
 *
 * @example
 * ```typescript
 * import { transcriptToCsv } from 'fireflies-api';
 *
 * const csv = transcriptToCsv(transcript);
 * await writeFile('meeting.csv', csv);
 * ```
 */
export function transcriptToCsv(transcript: Transcript, options: CsvExportOptions = {}): string {
  const opts = { ...DEFAULT_CSV_OPTIONS, ...options };
  const d = opts.delimiter;
  const lines: string[] = [];

  if (opts.includeHeader) {
    lines.push(`timestamp${d}speaker${d}text${d}is_question${d}is_task`);
  }

  for (const sentence of transcript.sentences) {
    const isQuestion = Boolean(sentence.ai_filters?.question);
    const isTask = Boolean(sentence.ai_filters?.task);
    const row = [
      sentence.start_time,
      escapeCsvField(sentence.speaker_name, d),
      escapeCsvField(sentence.text, d),
      String(isQuestion),
      String(isTask),
    ];
    lines.push(row.join(d));
  }

  return lines.join('\n');
}

/**
 * Sanitize a string for use as a filename.
 *
 * @param title - The title to sanitize
 * @returns A filesystem-safe filename
 *
 * @example
 * ```typescript
 * sanitizeFilename('Weekly Team Standup!') // 'weekly-team-standup'
 * ```
 */
export function sanitizeFilename(title: string): string {
  if (!title.trim()) {
    return 'untitled';
  }
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

/**
 * Generate an export filename from a transcript.
 *
 * @param transcript - The transcript to generate a filename for
 * @param extension - File extension (without dot)
 * @returns Filename in format: YYYY-MM-DD-title.ext
 *
 * @example
 * ```typescript
 * generateExportFilename(transcript, 'md')
 * // '2024-01-15-weekly-standup.md'
 * ```
 */
export function generateExportFilename(transcript: Transcript, extension: string): string {
  const sanitizedTitle = sanitizeFilename(transcript.title);
  let datePrefix = '';

  if (transcript.dateString) {
    try {
      const date = new Date(transcript.dateString);
      if (!Number.isNaN(date.getTime())) {
        datePrefix = `${date.toISOString().slice(0, 10)}-`;
      }
    } catch {
      // Invalid date - skip prefix
    }
  }

  return `${datePrefix}${sanitizedTitle}.${extension}`;
}

/**
 * Export a transcript to the specified format.
 *
 * @param transcript - The transcript to export
 * @param format - Target format (markdown, json, txt, csv)
 * @returns Formatted string content
 *
 * @example
 * ```typescript
 * const content = await exportTranscript(transcript, 'markdown');
 * await writeFile('meeting.md', content);
 * ```
 */
export async function exportTranscript(
  transcript: Transcript,
  format: ExportFormat
): Promise<string> {
  switch (format) {
    case 'markdown':
      return transcriptToMarkdown(transcript);
    case 'json':
      return JSON.stringify(transcript, null, 2);
    case 'txt':
      return transcriptToText(transcript);
    case 'csv':
      return transcriptToCsv(transcript);
  }
}

/**
 * Create a zip archive from exported files.
 * Pure function - returns Buffer, no I/O.
 *
 * @param files - Array of files to add to the archive
 * @returns Promise resolving to zip Buffer
 *
 * @example
 * ```typescript
 * const files = [
 *   { filename: 'meeting1.md', content: '# Meeting 1' },
 *   { filename: 'meeting2.md', content: '# Meeting 2' },
 * ];
 * const zipBuffer = await createZipArchive(files);
 * await writeFile('exports.zip', zipBuffer);
 * ```
 */
export async function createZipArchive(files: ExportFile[]): Promise<Buffer> {
  // Use archiver for zip creation
  const archiver = await import('archiver');
  const { Writable } = await import('node:stream');

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver.default('zip', { zlib: { level: 9 } });

    // Collect output chunks
    const writable = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });

    writable.on('finish', () => {
      resolve(Buffer.concat(chunks));
    });

    archive.on('error', reject);
    archive.pipe(writable);

    // Add files to archive
    for (const file of files) {
      archive.append(file.content, { name: file.filename });
    }

    archive.finalize();
  });
}

// --- Internal helpers ---

function formatTextMetadata(transcript: Transcript): string {
  const lines: string[] = [];

  lines.push(transcript.title || 'Untitled Meeting');

  if (transcript.dateString) {
    lines.push(`Date: ${formatDate(transcript.dateString)}`);
  }

  const participants = getParticipantNames(transcript);
  if (participants.length > 0) {
    lines.push(`Participants: ${participants.join(', ')}`);
  }

  return lines.join('\n');
}

function formatTextTranscript(sentences: Sentence[], opts: Required<TextExportOptions>): string {
  const groups = groupSentencesBySpeaker(sentences);
  const lines: string[] = [];

  for (const group of groups) {
    const text = group.sentences.map((s) => s.text).join(' ');
    const speaker = group.speakerName || 'Unknown';

    const firstSentence = group.sentences[0];
    if (opts.includeTimestamps && firstSentence) {
      const timestamp = formatTimestamp(firstSentence.start_time);
      lines.push(`${timestamp} ${speaker}: ${text}`);
    } else {
      lines.push(`${speaker}: ${text}`);
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

function formatTimestamp(startTime: string): string {
  const seconds = parseFloat(startTime);
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `[${mins}:${secs.toString().padStart(2, '0')}]`;
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
 * Escape a field for CSV output.
 * If the field contains the delimiter, quotes, or newlines, wrap in quotes.
 * Double any existing quotes.
 */
function escapeCsvField(field: string, delimiter: string): string {
  if (field.includes('"') || field.includes(delimiter) || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
