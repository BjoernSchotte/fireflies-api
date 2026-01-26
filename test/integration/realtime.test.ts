import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AuthenticationError, TimeoutError } from '../../src/errors.js';
import { RealtimeStream } from '../../src/realtime/stream.js';
import type { TranscriptionChunk } from '../../src/realtime/types.js';

let httpServer: ReturnType<typeof createServer>;
let io: Server;
let port: number;

function getWsUrl(): string {
  return `http://localhost:${port}`;
}

beforeAll(() => {
  return new Promise<void>((resolve) => {
    httpServer = createServer();
    io = new Server(httpServer, {
      path: '/ws/realtime',
      transports: ['websocket'],
    });

    httpServer.listen(0, () => {
      port = (httpServer.address() as AddressInfo).port;
      resolve();
    });
  });
});

afterAll(() => {
  return new Promise<void>((resolve) => {
    io.close();
    httpServer.close(() => resolve());
  });
});

afterEach(() => {
  io.removeAllListeners('connection');
});

describe('RealtimeStream integration', () => {
  describe('connection', () => {
    it('connects and receives auth.success', async () => {
      io.on('connection', (socket) => {
        const auth = socket.handshake.auth as {
          token?: string;
          transcriptId?: string;
        };
        if (auth.token?.startsWith('Bearer ') && auth.transcriptId) {
          socket.emit('auth.success');
        }
      });

      const stream = new RealtimeStream({
        apiKey: 'test-api-key',
        transcriptId: 'test-transcript',
        wsUrl: getWsUrl(),
        wsPath: '/ws/realtime',
        timeout: 5000,
        reconnect: false,
      });

      await stream.connect();
      expect(stream.connected).toBe(true);

      stream.close();
    });

    it('throws AuthenticationError on auth.failed', async () => {
      io.on('connection', (socket) => {
        socket.emit('auth.failed', { message: 'Invalid API key' });
      });

      const stream = new RealtimeStream({
        apiKey: 'invalid-key',
        transcriptId: 'test-transcript',
        wsUrl: getWsUrl(),
        wsPath: '/ws/realtime',
        timeout: 5000,
        reconnect: false,
      });

      await expect(stream.connect()).rejects.toThrow(AuthenticationError);
    });

    it('throws TimeoutError when connection times out', async () => {
      // Server doesn't respond with auth.success
      io.on('connection', () => {
        // Do nothing - let it timeout
      });

      const stream = new RealtimeStream({
        apiKey: 'test-key',
        transcriptId: 'test-transcript',
        wsUrl: getWsUrl(),
        wsPath: '/ws/realtime',
        timeout: 100, // Very short timeout
        reconnect: false,
      });

      await expect(stream.connect()).rejects.toThrow(TimeoutError);
    });
  });

  describe('chunk reception', () => {
    beforeEach(() => {
      io.on('connection', (socket) => {
        socket.emit('auth.success');
      });
    });

    it('receives chunks via event listener', async () => {
      const chunks: TranscriptionChunk[] = [];

      const stream = new RealtimeStream({
        apiKey: 'test-key',
        transcriptId: 'test-transcript',
        wsUrl: getWsUrl(),
        wsPath: '/ws/realtime',
        reconnect: false,
      });

      stream.on('chunk', (chunk) => chunks.push(chunk));

      await stream.connect();

      // Send a chunk from server
      const sockets = await io.fetchSockets();
      const testChunk: TranscriptionChunk = {
        chunk_id: 'chunk-1',
        speaker_name: 'Test Speaker',
        text: 'Hello, world!',
        start_time: 0,
        end_time: 1.5,
      };
      sockets[0]?.emit('transcription.broadcast', { payload: testChunk });

      // Wait for chunk to be received
      await new Promise((r) => setTimeout(r, 50));

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.text).toBe('Hello, world!');
      expect(chunks[0]?.speaker_name).toBe('Test Speaker');

      stream.close();
    });

    it('handles direct payload shape (without wrapper)', async () => {
      const chunks: TranscriptionChunk[] = [];

      const stream = new RealtimeStream({
        apiKey: 'test-key',
        transcriptId: 'test-transcript',
        wsUrl: getWsUrl(),
        wsPath: '/ws/realtime',
        reconnect: false,
      });

      stream.on('chunk', (chunk) => chunks.push(chunk));

      await stream.connect();

      // Send chunk directly (no payload wrapper)
      const sockets = await io.fetchSockets();
      const testChunk: TranscriptionChunk = {
        chunk_id: 'chunk-direct',
        speaker_name: 'Direct Speaker',
        text: 'Direct message',
        start_time: 0,
        end_time: 1,
      };
      sockets[0]?.emit('transcription.broadcast', testChunk);

      await new Promise((r) => setTimeout(r, 50));

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.chunk_id).toBe('chunk-direct');

      stream.close();
    });

    it('receives chunks via async iterator', async () => {
      const stream = new RealtimeStream({
        apiKey: 'test-key',
        transcriptId: 'test-transcript',
        wsUrl: getWsUrl(),
        wsPath: '/ws/realtime',
        reconnect: false,
      });

      await stream.connect();

      // Send chunks from server
      const sockets = await io.fetchSockets();
      const socket = sockets[0];

      setTimeout(() => {
        socket?.emit('transcription.broadcast', {
          payload: {
            chunk_id: 'iter-1',
            speaker_name: 'Speaker',
            text: 'First chunk',
            start_time: 0,
            end_time: 1,
          },
        });
      }, 10);

      setTimeout(() => {
        socket?.emit('transcription.broadcast', {
          payload: {
            chunk_id: 'iter-2',
            speaker_name: 'Speaker',
            text: 'Second chunk',
            start_time: 1,
            end_time: 2,
          },
        });
      }, 20);

      setTimeout(() => {
        stream.close();
      }, 50);

      const chunks: TranscriptionChunk[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks[0]?.chunk_id).toBe('iter-1');
      expect(chunks[1]?.chunk_id).toBe('iter-2');
    });

    it('emits progressive chunk updates with same chunk_id', async () => {
      const chunks: TranscriptionChunk[] = [];

      const stream = new RealtimeStream({
        apiKey: 'test-key',
        transcriptId: 'test-transcript',
        wsUrl: getWsUrl(),
        wsPath: '/ws/realtime',
        reconnect: false,
      });

      stream.on('chunk', (chunk) => chunks.push(chunk));

      await stream.connect();

      const sockets = await io.fetchSockets();
      const socket = sockets[0];

      // Send progressive updates (same chunk_id, growing text)
      socket?.emit('transcription.broadcast', {
        payload: { chunk_id: 'chunk-1', speaker_name: 'Speaker', text: 'Hello', start_time: 0, end_time: 1 },
      });
      socket?.emit('transcription.broadcast', {
        payload: { chunk_id: 'chunk-1', speaker_name: 'Speaker', text: 'Hello world', start_time: 0, end_time: 2 },
      });
      socket?.emit('transcription.broadcast', {
        payload: { chunk_id: 'chunk-2', speaker_name: 'Speaker', text: 'New', start_time: 2, end_time: 3 },
      });

      await new Promise((r) => setTimeout(r, 50));

      // Should receive all updates:
      // 1. chunk-1 "Hello" (partial)
      // 2. chunk-1 "Hello world" (partial)
      // 3. chunk-1 "Hello world" (final) - emitted when chunk-2 arrived
      // 4. chunk-2 "New" (partial)
      expect(chunks).toHaveLength(4);
      expect(chunks[0]?.text).toBe('Hello');
      expect(chunks[0]?.isFinal).toBe(false);
      expect(chunks[1]?.text).toBe('Hello world');
      expect(chunks[1]?.isFinal).toBe(false);
      expect(chunks[2]?.text).toBe('Hello world');
      expect(chunks[2]?.isFinal).toBe(true); // Final emission when chunk-2 arrived
      expect(chunks[3]?.text).toBe('New');
      expect(chunks[3]?.isFinal).toBe(false);

      stream.close();
    });
  });

  describe('disconnect handling', () => {
    it('emits disconnected event on server disconnect', async () => {
      io.on('connection', (socket) => {
        socket.emit('auth.success');

        // Disconnect after a short delay
        setTimeout(() => {
          socket.disconnect(true);
        }, 50);
      });

      const stream = new RealtimeStream({
        apiKey: 'test-key',
        transcriptId: 'test-transcript',
        wsUrl: getWsUrl(),
        wsPath: '/ws/realtime',
        reconnect: false,
      });

      let disconnected = false;
      let disconnectReason = '';
      stream.on('disconnected', (reason) => {
        disconnected = true;
        disconnectReason = reason;
      });

      await stream.connect();

      // Wait for disconnect
      await new Promise((r) => setTimeout(r, 100));

      expect(disconnected).toBe(true);
      expect(typeof disconnectReason).toBe('string');

      stream.close();
    });
  });
});
