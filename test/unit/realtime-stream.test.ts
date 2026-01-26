import { describe, expect, it, vi } from 'vitest';
import { StreamClosedError } from '../../src/errors.js';
import type { TranscriptionChunk } from '../../src/realtime/types.js';

// Mock socket.io-client before importing RealtimeStream
vi.mock('socket.io-client', () => {
  return {
    io: vi.fn(() => ({
      connected: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      io: {
        on: vi.fn(),
      },
    })),
  };
});

// Import after mock
const { RealtimeStream } = await import('../../src/realtime/stream.js');

function createChunk(id: string, text: string, isFinal = false): TranscriptionChunk {
  return {
    chunk_id: id,
    speaker_name: 'Speaker',
    text,
    start_time: 0,
    end_time: 1,
    isFinal,
  };
}

describe('RealtimeStream', () => {
  describe('event handling', () => {
    it('registers and calls event listeners', () => {
      const stream = new RealtimeStream({
        apiKey: 'test-key',
        transcriptId: 'test-transcript',
      });

      const handler = vi.fn();
      stream.on('connected', handler);

      // Manually trigger the event (in real code, this happens via setupHandlers)
      // We're testing the event system itself
      // @ts-expect-error - accessing private method for testing
      stream.emit('connected');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('allows removing listeners', () => {
      const stream = new RealtimeStream({
        apiKey: 'test-key',
        transcriptId: 'test-transcript',
      });

      const handler = vi.fn();
      stream.on('connected', handler);
      stream.off('connected', handler);

      // @ts-expect-error - accessing private method for testing
      stream.emit('connected');

      expect(handler).not.toHaveBeenCalled();
    });

    it('supports chaining on()', () => {
      const stream = new RealtimeStream({
        apiKey: 'test-key',
        transcriptId: 'test-transcript',
      });

      const result = stream
        .on('connected', () => {})
        .on('chunk', () => {})
        .on('disconnected', () => {});

      expect(result).toBe(stream);
    });

    it('swallows listener errors', () => {
      const stream = new RealtimeStream({
        apiKey: 'test-key',
        transcriptId: 'test-transcript',
      });

      stream.on('connected', () => {
        throw new Error('Listener error');
      });

      // Should not throw
      expect(() => {
        // @ts-expect-error - accessing private method for testing
        stream.emit('connected');
      }).not.toThrow();
    });
  });

  describe('close', () => {
    it('marks stream as closed', () => {
      const stream = new RealtimeStream({
        apiKey: 'test-key',
        transcriptId: 'test-transcript',
      });

      expect(stream.connected).toBe(false);

      stream.close();

      // Should not throw on double close
      stream.close();
    });

    it('resolves waiting async iterators with null', async () => {
      const stream = new RealtimeStream({
        apiKey: 'test-key',
        transcriptId: 'test-transcript',
      });

      // Start iteration in background
      const iteratorPromise = (async () => {
        const chunks: TranscriptionChunk[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        return chunks;
      })();

      // Close immediately
      stream.close();

      // Should resolve with empty array
      const chunks = await iteratorPromise;
      expect(chunks).toEqual([]);
    });
  });

  describe('async iterator', () => {
    it('throws StreamClosedError when iterating closed stream', async () => {
      const stream = new RealtimeStream({
        apiKey: 'test-key',
        transcriptId: 'test-transcript',
      });

      stream.close();

      await expect(async () => {
        for await (const _ of stream) {
          // Should throw before yielding
        }
      }).rejects.toThrow(StreamClosedError);
    });
  });

  describe('chunk updates', () => {
    it('emits all chunks including updates with same chunk_id', () => {
      const stream = new RealtimeStream({
        apiKey: 'test-key',
        transcriptId: 'test-transcript',
      });

      const chunks: TranscriptionChunk[] = [];
      stream.on('chunk', (chunk) => chunks.push(chunk));

      // Simulate progressive chunk updates (same chunk_id, growing text)
      const chunk1 = createChunk('id-1', 'Hello');
      const chunk2 = createChunk('id-1', 'Hello world'); // Update to same chunk
      const chunk3 = createChunk('id-2', 'New chunk'); // New chunk

      // @ts-expect-error - accessing private method for testing
      stream.emit('chunk', chunk1);
      // @ts-expect-error - accessing private method for testing
      stream.emit('chunk', chunk2);
      // @ts-expect-error - accessing private method for testing
      stream.emit('chunk', chunk3);

      // All chunks should be emitted (no deduplication)
      expect(chunks).toHaveLength(3);
      expect(chunks[0]?.text).toBe('Hello');
      expect(chunks[1]?.text).toBe('Hello world');
      expect(chunks[2]?.text).toBe('New chunk');
    });
  });
});
