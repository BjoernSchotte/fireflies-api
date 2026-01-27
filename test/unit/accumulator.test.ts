import { describe, expect, it } from 'vitest';
import { TranscriptAccumulator } from '../../src/helpers/accumulator.js';
import type { TranscriptionChunk } from '../../src/realtime/types.js';

/** Helper to create a chunk with defaults */
function createChunk(overrides: Partial<TranscriptionChunk>): TranscriptionChunk {
  return {
    chunk_id: '1',
    speaker_name: 'Alice',
    text: 'Hello',
    start_time: 0,
    end_time: 1,
    isFinal: true,
    ...overrides,
  };
}

describe('TranscriptAccumulator', () => {
  it('ignores non-final chunks', () => {
    const acc = new TranscriptAccumulator();
    acc.add(createChunk({ chunk_id: '1', isFinal: false }));

    expect(acc.getTranscript().chunkCount).toBe(0);
  });

  it('accumulates final chunks', () => {
    const acc = new TranscriptAccumulator();
    acc.add(createChunk({ chunk_id: '1', text: 'Hello', isFinal: true }));

    const transcript = acc.getTranscript();
    expect(transcript.chunkCount).toBe(1);
    expect(transcript.turns[0].text).toBe('Hello');
  });

  it('merges consecutive chunks from same speaker', () => {
    const acc = new TranscriptAccumulator();
    acc.add(
      createChunk({
        chunk_id: '1',
        speaker_name: 'Alice',
        text: 'Hello',
        start_time: 0,
        end_time: 1,
      })
    );
    acc.add(
      createChunk({
        chunk_id: '2',
        speaker_name: 'Alice',
        text: 'world',
        start_time: 1,
        end_time: 2,
      })
    );

    const transcript = acc.getTranscript();
    expect(transcript.turns.length).toBe(1);
    expect(transcript.turns[0].text).toBe('Hello world');
    expect(transcript.turns[0].chunks.length).toBe(2);
  });

  it('creates new turn when speaker changes', () => {
    const acc = new TranscriptAccumulator();
    acc.add(createChunk({ chunk_id: '1', speaker_name: 'Alice', text: 'Hi' }));
    acc.add(
      createChunk({ chunk_id: '2', speaker_name: 'Bob', text: 'Hello', start_time: 1, end_time: 2 })
    );

    const transcript = acc.getTranscript();
    expect(transcript.turns.length).toBe(2);
    expect(transcript.speakers).toEqual(['Alice', 'Bob']);
  });

  it('deduplicates chunks by chunk_id', () => {
    const acc = new TranscriptAccumulator();
    acc.add(createChunk({ chunk_id: '1', text: 'Hello' }));
    acc.add(createChunk({ chunk_id: '1', text: 'Hello' }));

    expect(acc.getTranscript().chunkCount).toBe(1);
  });

  it('computes word count correctly', () => {
    const acc = new TranscriptAccumulator();
    acc.add(createChunk({ chunk_id: '1', speaker_name: 'Alice', text: 'Hello world' }));
    acc.add(
      createChunk({
        chunk_id: '2',
        speaker_name: 'Bob',
        text: 'Hi there',
        start_time: 1,
        end_time: 2,
      })
    );

    expect(acc.getTranscript().wordCount).toBe(4);
  });

  it('computes duration from first to last chunk', () => {
    const acc = new TranscriptAccumulator();
    acc.add(createChunk({ chunk_id: '1', speaker_name: 'Alice', start_time: 10, end_time: 12 }));
    acc.add(createChunk({ chunk_id: '2', speaker_name: 'Bob', start_time: 15, end_time: 20 }));

    expect(acc.getTranscript().duration).toBe(10); // 20 - 10
  });

  it('clears accumulated data', () => {
    const acc = new TranscriptAccumulator();
    acc.add(createChunk({ chunk_id: '1' }));
    acc.clear();

    const transcript = acc.getTranscript();
    expect(transcript.chunkCount).toBe(0);
    expect(transcript.turns.length).toBe(0);
  });

  it('returns empty transcript when no chunks added', () => {
    const acc = new TranscriptAccumulator();

    const transcript = acc.getTranscript();
    expect(transcript.turns).toEqual([]);
    expect(transcript.speakers).toEqual([]);
    expect(transcript.wordCount).toBe(0);
    expect(transcript.duration).toBe(0);
    expect(transcript.chunkCount).toBe(0);
  });

  it('tracks speakers in order of appearance', () => {
    const acc = new TranscriptAccumulator();
    acc.add(createChunk({ chunk_id: '1', speaker_name: 'Bob' }));
    acc.add(createChunk({ chunk_id: '2', speaker_name: 'Alice', start_time: 1, end_time: 2 }));
    acc.add(createChunk({ chunk_id: '3', speaker_name: 'Bob', start_time: 2, end_time: 3 }));

    expect(acc.getTranscript().speakers).toEqual(['Bob', 'Alice']);
  });

  it('updates turn endTime as chunks are added', () => {
    const acc = new TranscriptAccumulator();
    acc.add(createChunk({ chunk_id: '1', speaker_name: 'Alice', start_time: 0, end_time: 1 }));
    acc.add(createChunk({ chunk_id: '2', speaker_name: 'Alice', start_time: 1, end_time: 5 }));

    const turn = acc.getTranscript().turns[0];
    expect(turn.startTime).toBe(0);
    expect(turn.endTime).toBe(5);
  });

  it('handles empty text chunks', () => {
    const acc = new TranscriptAccumulator();
    acc.add(createChunk({ chunk_id: '1', text: '' }));

    const transcript = acc.getTranscript();
    expect(transcript.chunkCount).toBe(1);
    expect(transcript.wordCount).toBe(0);
  });

  it('handles text with multiple spaces', () => {
    const acc = new TranscriptAccumulator();
    acc.add(createChunk({ chunk_id: '1', text: 'Hello   world' }));

    // Word count should handle multiple spaces gracefully
    expect(acc.getTranscript().wordCount).toBe(2);
  });
});
