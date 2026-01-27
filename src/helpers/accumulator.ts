import type { TranscriptionChunk } from '../realtime/types.js';

/**
 * A speaker turn containing one or more consecutive chunks from the same speaker.
 */
export interface SpeakerTurn {
  /** Name of the speaker */
  speaker: string;
  /** Combined text from all chunks in this turn */
  text: string;
  /** Start time of the first chunk in seconds */
  startTime: number;
  /** End time of the last chunk in seconds */
  endTime: number;
  /** Original chunks that make up this turn */
  chunks: TranscriptionChunk[];
}

/**
 * The accumulated transcript state.
 */
export interface AccumulatedTranscript {
  /** Speaker turns in chronological order */
  turns: SpeakerTurn[];
  /** Unique speaker names in order of first appearance */
  speakers: string[];
  /** Total word count across all turns */
  wordCount: number;
  /** Duration in seconds from first chunk start to last chunk end */
  duration: number;
  /** Total number of final chunks accumulated */
  chunkCount: number;
}

/**
 * Accumulates streaming transcription chunks into a coherent transcript.
 *
 * Chunks from the same speaker are merged into turns. Statistics like word count
 * and duration are computed on demand.
 *
 * @example
 * ```typescript
 * const accumulator = new TranscriptAccumulator();
 *
 * for await (const chunk of client.realtime.stream(meetingId)) {
 *   accumulator.add(chunk);
 *   const transcript = accumulator.getTranscript();
 *   console.log(`${transcript.speakers.length} speakers, ${transcript.wordCount} words`);
 * }
 *
 * const final = accumulator.getTranscript();
 * ```
 */
export class TranscriptAccumulator {
  private turns: SpeakerTurn[] = [];
  private currentTurn: SpeakerTurn | null = null;
  private seenChunkIds = new Set<string>();

  /**
   * Add a chunk to the accumulator.
   *
   * Only final chunks are accumulated; non-final chunks are ignored.
   * Duplicate chunk IDs are also ignored.
   *
   * @param chunk - The transcription chunk to add
   */
  add(chunk: TranscriptionChunk): void {
    if (!chunk.isFinal) return;
    if (this.seenChunkIds.has(chunk.chunk_id)) return;

    this.seenChunkIds.add(chunk.chunk_id);

    if (this.currentTurn && this.currentTurn.speaker === chunk.speaker_name) {
      this.currentTurn.text += ` ${chunk.text}`;
      this.currentTurn.endTime = chunk.end_time;
      this.currentTurn.chunks.push(chunk);
    } else {
      this.currentTurn = {
        speaker: chunk.speaker_name,
        text: chunk.text,
        startTime: chunk.start_time,
        endTime: chunk.end_time,
        chunks: [chunk],
      };
      this.turns.push(this.currentTurn);
    }
  }

  /**
   * Get the current accumulated transcript state.
   *
   * Statistics are computed on demand to ensure accuracy.
   *
   * @returns The accumulated transcript with turns, speakers, and statistics
   */
  getTranscript(): AccumulatedTranscript {
    const speakers = this.getUniqueSpeakers();
    const wordCount = this.computeWordCount();
    const duration = this.computeDuration();

    return {
      turns: this.turns,
      speakers,
      wordCount,
      duration,
      chunkCount: this.seenChunkIds.size,
    };
  }

  /**
   * Clear all accumulated data.
   *
   * Useful for resetting the accumulator between sessions.
   */
  clear(): void {
    this.turns = [];
    this.currentTurn = null;
    this.seenChunkIds.clear();
  }

  private getUniqueSpeakers(): string[] {
    const seen = new Set<string>();
    const speakers: string[] = [];
    for (const turn of this.turns) {
      if (!seen.has(turn.speaker)) {
        seen.add(turn.speaker);
        speakers.push(turn.speaker);
      }
    }
    return speakers;
  }

  private computeWordCount(): number {
    let count = 0;
    for (const turn of this.turns) {
      if (turn.text.length === 0) continue;
      const words = turn.text.trim().split(/\s+/);
      count += words.filter((w) => w.length > 0).length;
    }
    return count;
  }

  private computeDuration(): number {
    const firstTurn = this.turns[0];
    const lastTurn = this.turns[this.turns.length - 1];
    if (!firstTurn || !lastTurn) return 0;
    const firstChunk = firstTurn.chunks[0];
    if (!firstChunk) return 0;
    return lastTurn.endTime - firstChunk.start_time;
  }
}
