import { RealtimeStream } from './stream.js';
import type { RealtimeConfig, TranscriptionChunk } from './types.js';

/**
 * API for realtime transcription streaming.
 */
export interface RealtimeAPI {
  /**
   * Connect to a live transcription stream.
   *
   * @param transcriptId - The meeting/transcript ID to stream
   * @returns Connected RealtimeStream
   *
   * @example Event-based
   * ```typescript
   * const stream = await client.realtime.connect('meeting-123');
   * stream.on('chunk', (chunk) => {
   *   console.log(`[${chunk.speaker_name}]: ${chunk.text}`);
   * });
   * ```
   */
  connect(transcriptId: string): Promise<RealtimeStream>;

  /**
   * Stream transcription chunks as an async iterable.
   * Handles connection automatically.
   *
   * @param transcriptId - The meeting/transcript ID to stream
   * @returns AsyncIterable of transcription chunks
   *
   * @example
   * ```typescript
   * for await (const chunk of client.realtime.stream('meeting-123')) {
   *   console.log(`[${chunk.speaker_name}]: ${chunk.text}`);
   * }
   * ```
   */
  stream(transcriptId: string): AsyncIterable<TranscriptionChunk>;
}

/**
 * Create the realtime API bound to config.
 * @param apiKey - API key for authentication
 * @param baseConfig - Optional base configuration for all streams
 */
export function createRealtimeAPI(
  apiKey: string,
  baseConfig?: Partial<Omit<RealtimeConfig, 'apiKey' | 'transcriptId'>>
): RealtimeAPI {
  return {
    async connect(transcriptId: string): Promise<RealtimeStream> {
      const stream = new RealtimeStream({
        apiKey,
        transcriptId,
        ...baseConfig,
      });
      await stream.connect();
      return stream;
    },

    async *stream(transcriptId: string): AsyncIterable<TranscriptionChunk> {
      const stream = new RealtimeStream({
        apiKey,
        transcriptId,
        ...baseConfig,
      });

      try {
        await stream.connect();
        yield* stream;
      } finally {
        stream.close();
      }
    },
  };
}
