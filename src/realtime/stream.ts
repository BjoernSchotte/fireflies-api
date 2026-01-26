import { StreamClosedError } from '../errors.js';
import { RealtimeConnection } from './client.js';
import type { RealtimeConfig, RealtimeEvents, TranscriptionChunk } from './types.js';

type EventHandler<K extends keyof RealtimeEvents> = RealtimeEvents[K];

// Generic event handler type
type AnyEventHandler = (...args: never[]) => void;

/**
 * Realtime transcription stream.
 *
 * Chunks are emitted progressively as speech is transcribed. The same chunk_id
 * will be emitted multiple times with updated text. Use `chunk.isFinal` to
 * determine if a chunk is complete (the next chunk_id has appeared).
 *
 * @example Event-based (all updates)
 * ```typescript
 * stream.on('chunk', (chunk) => {
 *   // Updates display in real-time
 *   updateDisplay(chunk.chunk_id, chunk.text);
 * });
 * ```
 *
 * @example Event-based (final chunks only)
 * ```typescript
 * stream.on('chunk', (chunk) => {
 *   if (chunk.isFinal) {
 *     console.log(`[${chunk.speaker_name}]: ${chunk.text}`);
 *   }
 * });
 * ```
 *
 * @example Async iterator
 * ```typescript
 * for await (const chunk of stream) {
 *   console.log(`[${chunk.speaker_name}]: ${chunk.text}`);
 * }
 * ```
 */
export class RealtimeStream implements AsyncIterable<TranscriptionChunk> {
  private connection: RealtimeConnection;
  private listeners = new Map<keyof RealtimeEvents, Set<AnyEventHandler>>();
  private buffer: TranscriptionChunk[] = [];
  private waiters: Array<(chunk: TranscriptionChunk | null) => void> = [];
  private closed = false;
  private lastChunkId: string | null = null;
  private lastChunk: TranscriptionChunk | null = null;

  constructor(config: RealtimeConfig) {
    this.connection = new RealtimeConnection(config);
  }

  /**
   * Connect to the realtime stream.
   * @throws AuthenticationError if authentication fails
   * @throws ConnectionError if connection fails
   * @throws TimeoutError if connection times out
   */
  async connect(): Promise<void> {
    await this.connection.connect();
    this.setupHandlers();
    this.emit('connected');
  }

  private setupHandlers(): void {
    this.connection.onChunk((rawChunk) => {
      // Check if this is a new chunk or an update to the current one
      const isNewChunk = this.lastChunkId !== null && rawChunk.chunk_id !== this.lastChunkId;

      // If we have a previous chunk and this is a new one, mark previous as final
      if (isNewChunk && this.lastChunk) {
        const finalChunk: TranscriptionChunk = { ...this.lastChunk, isFinal: true };
        this.emitChunk(finalChunk);
      }

      // Create chunk with isFinal = false (it may get more updates)
      const chunk: TranscriptionChunk = { ...rawChunk, isFinal: false };

      // Track current chunk
      this.lastChunkId = chunk.chunk_id;
      this.lastChunk = chunk;

      // Emit the update
      this.emit('chunk', chunk);
    });

    this.connection.onDisconnect((reason) => {
      // Emit last chunk as final before disconnecting
      if (this.lastChunk) {
        const finalChunk: TranscriptionChunk = { ...this.lastChunk, isFinal: true };
        this.emitChunk(finalChunk);
        this.lastChunk = null;
      }

      this.emit('disconnected', reason);

      // Signal end to async iterator
      if (!this.connection.connected) {
        this.closed = true;
        for (const waiter of this.waiters) {
          waiter(null);
        }
        this.waiters = [];
      }
    });

    this.connection.onReconnectAttempt((attempt) => {
      this.emit('reconnecting', attempt);
    });

    this.connection.onReconnect(() => {
      this.emit('connected');
    });

    this.connection.onError((error) => {
      this.emit('error', error);
    });
  }

  /**
   * Register an event listener.
   * @param event - Event name
   * @param handler - Event handler
   */
  on<K extends keyof RealtimeEvents>(event: K, handler: EventHandler<K>): this {
    let handlers = this.listeners.get(event);
    if (!handlers) {
      handlers = new Set();
      this.listeners.set(event, handlers);
    }
    handlers.add(handler as AnyEventHandler);
    return this;
  }

  /**
   * Remove an event listener.
   * @param event - Event name
   * @param handler - Event handler to remove
   */
  off<K extends keyof RealtimeEvents>(event: K, handler: EventHandler<K>): this {
    this.listeners.get(event)?.delete(handler as AnyEventHandler);
    return this;
  }

  /**
   * Emit a chunk to both event listeners and async iterator buffer.
   * Used for final chunks that should be yielded by the iterator.
   */
  private emitChunk(chunk: TranscriptionChunk): void {
    this.emit('chunk', chunk);

    // Feed async iterator (only final chunks go to the buffer)
    if (chunk.isFinal) {
      if (this.waiters.length > 0) {
        const waiter = this.waiters.shift();
        waiter?.(chunk);
      } else {
        this.buffer.push(chunk);
      }
    }
  }

  private emit<K extends keyof RealtimeEvents>(
    event: K,
    ...args: Parameters<RealtimeEvents[K]>
  ): void {
    const handlers = this.listeners.get(event);
    handlers?.forEach((handler) => {
      try {
        (handler as (...args: Parameters<RealtimeEvents[K]>) => void)(...args);
      } catch {
        // Ignore listener errors
      }
    });
  }

  /**
   * AsyncIterable implementation for `for await` loops.
   */
  async *[Symbol.asyncIterator](): AsyncIterator<TranscriptionChunk> {
    if (this.closed) {
      throw new StreamClosedError();
    }

    while (!this.closed) {
      // Return buffered chunks first
      const buffered = this.buffer.shift();
      if (buffered) {
        yield buffered;
        continue;
      }

      // Wait for next chunk
      const chunk = await new Promise<TranscriptionChunk | null>((resolve) => {
        if (this.closed) {
          resolve(null);
          return;
        }
        this.waiters.push(resolve);
      });

      if (chunk === null) {
        break;
      }

      yield chunk;
    }
  }

  /**
   * Close the stream and disconnect.
   */
  close(): void {
    // Emit last chunk as final
    if (this.lastChunk) {
      const finalChunk: TranscriptionChunk = { ...this.lastChunk, isFinal: true };
      this.emitChunk(finalChunk);
      this.lastChunk = null;
    }

    this.closed = true;
    this.connection.disconnect();
    this.buffer = [];
    this.lastChunkId = null;
    for (const waiter of this.waiters) {
      waiter(null);
    }
    this.waiters = [];
  }

  /**
   * Whether the stream is currently connected.
   */
  get connected(): boolean {
    return this.connection.connected;
  }
}
