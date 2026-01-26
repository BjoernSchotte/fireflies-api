/**
 * A single transcription chunk from the realtime stream.
 *
 * Chunks are sent progressively as speech is transcribed.
 * The same chunk_id will be sent multiple times with updated text.
 * Use `isFinal` to determine if a chunk is complete.
 */
export interface TranscriptionChunk {
  /** Unique identifier - same ID means this is an update to a previous chunk */
  chunk_id: string;
  /** Name of the speaker */
  speaker_name: string;
  /** Transcribed text (grows as more words are recognized) */
  text: string;
  /** Start time in seconds */
  start_time: number;
  /** End time in seconds */
  end_time: number;
  /** True if this is the final version of the chunk (next chunk_id has appeared) */
  isFinal: boolean;
}

/**
 * Raw chunk payload from Socket.IO.
 */
export interface RawChunkPayload {
  payload: TranscriptionChunk;
}

/**
 * Realtime connection configuration.
 */
export interface RealtimeConfig {
  /** API key for authentication */
  apiKey: string;
  /** Transcript/meeting ID to stream */
  transcriptId: string;
  /** WebSocket base URL (default: wss://api.fireflies.ai) */
  wsUrl?: string;
  /** Socket.IO path (default: /ws/realtime) */
  wsPath?: string;
  /** Connection timeout in ms (default: 20000) */
  timeout?: number;
  /** Chunk inactivity timeout in ms - reconnect if no chunks for this long (default: 20000) */
  chunkTimeout?: number;
  /** Auto-reconnect on disconnect (default: true) */
  reconnect?: boolean;
  /** Max reconnection attempts (default: 10) */
  maxReconnectAttempts?: number;
  /** Base delay between reconnects in ms (default: 5000) */
  reconnectDelay?: number;
  /** Max delay between reconnects in ms (default: 60000) */
  maxReconnectDelay?: number;
}

/**
 * Events emitted by RealtimeStream.
 */
export interface RealtimeEvents {
  /** Connection established */
  connected: () => void;
  /** Transcription chunk received */
  chunk: (chunk: TranscriptionChunk) => void;
  /** Connection closed */
  disconnected: (reason: string) => void;
  /** Error occurred */
  error: (error: Error) => void;
  /** Reconnecting after disconnect */
  reconnecting: (attempt: number) => void;
}

/**
 * Socket.IO server-to-client event types.
 */
export interface ServerToClientEvents {
  'auth.success': () => void;
  'auth.failed': (data: unknown) => void;
  'connection.established': () => void;
  'connection.error': (data: unknown) => void;
  'transcription.broadcast': (data: RawChunkPayload | TranscriptionChunk) => void;
}
