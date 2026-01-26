import { io, type Socket } from 'socket.io-client';
import { AuthenticationError, ConnectionError, TimeoutError } from '../errors.js';
import type {
  RawChunkPayload,
  RealtimeConfig,
  ServerToClientEvents,
  TranscriptionChunk,
} from './types.js';

type RealtimeSocket = Socket<ServerToClientEvents, Record<string, never>>;

// Defaults from working fireflies-whiteboard implementation
const DEFAULT_WS_URL = 'wss://api.fireflies.ai';
const DEFAULT_WS_PATH = '/ws/realtime';
const DEFAULT_TIMEOUT = 20000;
const DEFAULT_CHUNK_TIMEOUT = 20000;
const DEFAULT_RECONNECT_DELAY = 5000; // Start at 5s (proven value)
const DEFAULT_MAX_RECONNECT_DELAY = 60000; // Max 60s (proven value)
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Internal config with all defaults filled in.
 */
type ResolvedConfig = Required<RealtimeConfig>;

/**
 * Low-level realtime connection client.
 * Handles Socket.IO connection lifecycle.
 */
export class RealtimeConnection {
  private socket: RealtimeSocket | null = null;
  private readonly config: ResolvedConfig;

  constructor(config: RealtimeConfig) {
    this.config = {
      wsUrl: DEFAULT_WS_URL,
      wsPath: DEFAULT_WS_PATH,
      timeout: DEFAULT_TIMEOUT,
      chunkTimeout: DEFAULT_CHUNK_TIMEOUT,
      reconnect: true,
      maxReconnectAttempts: DEFAULT_MAX_RECONNECT_ATTEMPTS,
      reconnectDelay: DEFAULT_RECONNECT_DELAY,
      maxReconnectDelay: DEFAULT_MAX_RECONNECT_DELAY,
      ...config,
    };
  }

  /**
   * Establish connection and wait for auth success.
   */
  async connect(): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    const socket = io(this.config.wsUrl, {
      path: this.config.wsPath,
      auth: {
        token: `Bearer ${this.config.apiKey}`,
        transcriptId: this.config.transcriptId,
      },
      // Force WebSocket transport (proven more reliable than polling)
      transports: ['websocket'],
      reconnection: this.config.reconnect,
      reconnectionDelay: this.config.reconnectDelay,
      reconnectionDelayMax: this.config.maxReconnectDelay,
      reconnectionAttempts: this.config.maxReconnectAttempts,
      // Exponential backoff factor (default 2x matches our fireflies-whiteboard pattern)
      randomizationFactor: 0.5,
      timeout: this.config.timeout,
      autoConnect: false,
    });

    this.socket = socket;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        socket.disconnect();
        reject(new TimeoutError(`Realtime connection timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);

      const cleanup = () => clearTimeout(timeoutId);

      socket.once('auth.success', () => {
        cleanup();
        resolve();
      });

      // Handle explicit auth failure event
      socket.once('auth.failed', (data) => {
        cleanup();
        socket.disconnect();
        reject(new AuthenticationError(`Realtime auth failed: ${formatData(data)}`));
      });

      // Handle connection errors
      socket.once('connection.error', (data) => {
        cleanup();
        socket.disconnect();
        reject(new ConnectionError(`Realtime connection error: ${formatData(data)}`));
      });

      socket.once('connect_error', (error) => {
        cleanup();
        socket.disconnect();

        // Parse auth errors from generic connect_error
        const message = error.message || 'Connection failed';
        if (
          message.includes('auth') ||
          message.includes('401') ||
          message.includes('unauthorized')
        ) {
          reject(new AuthenticationError(`Realtime auth failed: ${message}`));
        } else {
          reject(
            new ConnectionError(`Realtime connection failed: ${message}`, {
              cause: error,
            })
          );
        }
      });

      socket.connect();
    });
  }

  /**
   * Register a chunk handler.
   * Handles both { payload: {...} } and direct payload shapes.
   */
  onChunk(handler: (chunk: TranscriptionChunk) => void): void {
    this.socket?.on('transcription.broadcast', (data: RawChunkPayload | TranscriptionChunk) => {
      // Handle both payload shapes (learned from fireflies-whiteboard)
      const chunk = 'payload' in data ? data.payload : data;
      handler(chunk);
    });
  }

  /**
   * Register a disconnect handler.
   */
  onDisconnect(handler: (reason: string) => void): void {
    this.socket?.on('disconnect', handler);
  }

  /**
   * Register a reconnect handler.
   */
  onReconnect(handler: () => void): void {
    this.socket?.io.on('reconnect', handler);
  }

  /**
   * Register a reconnect attempt handler.
   */
  onReconnectAttempt(handler: (attempt: number) => void): void {
    this.socket?.io.on('reconnect_attempt', handler);
  }

  /**
   * Register an error handler.
   */
  onError(handler: (error: Error) => void): void {
    this.socket?.on('connect_error', handler);
  }

  /**
   * Disconnect and cleanup.
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }
}

/**
 * Format unknown data for error messages.
 */
function formatData(data: unknown): string {
  if (data === undefined || data === null) {
    return String(data);
  }
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}
