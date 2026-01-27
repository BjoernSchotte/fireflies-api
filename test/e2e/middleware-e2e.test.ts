/**
 * E2E tests for webhook middleware.
 *
 * These tests start real HTTP servers and send actual HTTP requests
 * with properly signed payloads to verify the full request flow.
 */
import { createHmac } from 'node:crypto';
import type { Server } from 'node:http';
import { serve } from '@hono/node-server';
import express from 'express';
import Fastify from 'fastify';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createWebhookHandler as createExpressHandler } from '../../src/middleware/express.js';
import { firefliesWebhook } from '../../src/middleware/fastify.js';
import { webhookHandler } from '../../src/middleware/hono.js';
import type { WebhookHandlerContext } from '../../src/middleware/types.js';

/** Helper to compute a valid HMAC SHA-256 signature */
function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Helper to make HTTP POST request */
async function postWebhook(
  url: string,
  body: string,
  signature?: string
): Promise<{ status: number; body: string }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(signature && { 'x-hub-signature': signature }),
    },
    body,
  });
  return {
    status: response.status,
    body: await response.text(),
  };
}

describe('E2E: Express webhook middleware', () => {
  const secret = 'e2e-express-secret-key';
  const payload = {
    meetingId: 'e2e-meeting-express-123',
    eventType: 'Transcription completed' as const,
    clientReferenceId: 'client-ref-456',
  };
  const payloadString = JSON.stringify(payload);
  const validSignature = signPayload(payloadString, secret);

  let server: Server;
  let baseUrl: string;
  let receivedContexts: WebhookHandlerContext[] = [];

  beforeAll(async () => {
    receivedContexts = [];

    const app = express();
    app.post(
      '/webhook',
      express.raw({ type: 'application/json' }),
      createExpressHandler({
        secret,
        autoFetch: false,
        onTranscriptionCompleted: (ctx) => {
          receivedContexts.push(ctx);
        },
      })
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('processes valid webhook end-to-end', async () => {
    const response = await postWebhook(`${baseUrl}/webhook`, payloadString, validSignature);

    expect(response.status).toBe(200);
    expect(response.body).toBe('ok');
    expect(receivedContexts).toHaveLength(1);
    expect(receivedContexts[0].payload).toEqual(payload);
  });

  it('rejects invalid signature end-to-end', async () => {
    const initialCount = receivedContexts.length;
    const response = await postWebhook(`${baseUrl}/webhook`, payloadString, 'wrong-signature');

    expect(response.status).toBe(401);
    expect(receivedContexts).toHaveLength(initialCount); // Handler not called
  });

  it('rejects missing signature end-to-end', async () => {
    const initialCount = receivedContexts.length;
    const response = await postWebhook(`${baseUrl}/webhook`, payloadString);

    expect(response.status).toBe(401);
    expect(receivedContexts).toHaveLength(initialCount);
  });

  it('rejects malformed JSON end-to-end', async () => {
    const malformed = '{ invalid json }';
    const sig = signPayload(malformed, secret);
    const response = await postWebhook(`${baseUrl}/webhook`, malformed, sig);

    expect(response.status).toBe(400);
  });

  it('rejects invalid payload structure end-to-end', async () => {
    const invalidPayload = JSON.stringify({ foo: 'bar' });
    const sig = signPayload(invalidPayload, secret);
    const response = await postWebhook(`${baseUrl}/webhook`, invalidPayload, sig);

    expect(response.status).toBe(400);
  });
});

describe('E2E: Fastify webhook middleware', () => {
  const secret = 'e2e-fastify-secret-key';
  const payload = {
    meetingId: 'e2e-meeting-fastify-789',
    eventType: 'Transcription completed' as const,
  };
  const payloadString = JSON.stringify(payload);
  const validSignature = signPayload(payloadString, secret);

  let fastify: ReturnType<typeof Fastify>;
  let baseUrl: string;
  let receivedContexts: WebhookHandlerContext[] = [];

  beforeAll(async () => {
    receivedContexts = [];

    fastify = Fastify();
    await fastify.register(firefliesWebhook, {
      path: '/webhook',
      secret,
      autoFetch: false,
      onTranscriptionCompleted: (ctx) => {
        receivedContexts.push(ctx);
      },
    });

    await fastify.listen({ port: 0 });
    const addr = fastify.server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('processes valid webhook end-to-end', async () => {
    const response = await postWebhook(`${baseUrl}/webhook`, payloadString, validSignature);

    expect(response.status).toBe(200);
    expect(response.body).toBe('ok');
    expect(receivedContexts).toHaveLength(1);
    expect(receivedContexts[0].payload).toEqual(payload);
  });

  it('rejects invalid signature end-to-end', async () => {
    const initialCount = receivedContexts.length;
    const response = await postWebhook(`${baseUrl}/webhook`, payloadString, 'bad-sig');

    expect(response.status).toBe(401);
    expect(receivedContexts).toHaveLength(initialCount);
  });

  it('rejects missing signature end-to-end', async () => {
    const initialCount = receivedContexts.length;
    const response = await postWebhook(`${baseUrl}/webhook`, payloadString);

    expect(response.status).toBe(401);
    expect(receivedContexts).toHaveLength(initialCount);
  });
});

describe('E2E: Hono webhook middleware', () => {
  const secret = 'e2e-hono-secret-key';
  const payload = {
    meetingId: 'e2e-meeting-hono-abc',
    eventType: 'Transcription completed' as const,
    clientReferenceId: 'hono-ref',
  };
  const payloadString = JSON.stringify(payload);
  const validSignature = signPayload(payloadString, secret);

  let server: Server;
  let baseUrl: string;
  let receivedContexts: WebhookHandlerContext[] = [];

  beforeAll(async () => {
    receivedContexts = [];

    const app = new Hono();
    app.post(
      '/webhook',
      webhookHandler({
        secret,
        autoFetch: false,
        onEvent: (ctx) => {
          receivedContexts.push(ctx);
        },
      })
    );

    await new Promise<void>((resolve) => {
      server = serve(
        {
          fetch: app.fetch,
          port: 0,
        },
        (info) => {
          baseUrl = `http://localhost:${info.port}`;
          resolve();
        }
      );
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('processes valid webhook end-to-end', async () => {
    const response = await postWebhook(`${baseUrl}/webhook`, payloadString, validSignature);

    expect(response.status).toBe(200);
    expect(response.body).toBe('ok');
    expect(receivedContexts).toHaveLength(1);
    expect(receivedContexts[0].payload).toEqual(payload);
  });

  it('rejects invalid signature end-to-end', async () => {
    const initialCount = receivedContexts.length;
    const response = await postWebhook(`${baseUrl}/webhook`, payloadString, 'nope');

    expect(response.status).toBe(401);
    expect(receivedContexts).toHaveLength(initialCount);
  });

  it('rejects missing signature end-to-end', async () => {
    const initialCount = receivedContexts.length;
    const response = await postWebhook(`${baseUrl}/webhook`, payloadString);

    expect(response.status).toBe(401);
    expect(receivedContexts).toHaveLength(initialCount);
  });

  it('includes clientReferenceId in payload', async () => {
    // Clear and re-test to verify clientReferenceId
    const newPayload = {
      meetingId: 'ref-test-meeting',
      eventType: 'Transcription completed' as const,
      clientReferenceId: 'my-custom-ref-123',
    };
    const newPayloadString = JSON.stringify(newPayload);
    const sig = signPayload(newPayloadString, secret);

    const response = await postWebhook(`${baseUrl}/webhook`, newPayloadString, sig);

    expect(response.status).toBe(200);
    const lastContext = receivedContexts[receivedContexts.length - 1];
    expect(lastContext.payload.clientReferenceId).toBe('my-custom-ref-123');
  });
});

describe('E2E: Error handling', () => {
  const secret = 'e2e-error-secret';
  const payload = {
    meetingId: 'error-test-meeting',
    eventType: 'Transcription completed' as const,
  };
  const payloadString = JSON.stringify(payload);
  const validSignature = signPayload(payloadString, secret);

  it('returns 500 when handler throws (Express)', async () => {
    const app = express();
    app.post(
      '/webhook',
      express.raw({ type: 'application/json' }),
      createExpressHandler({
        secret,
        autoFetch: false,
        onTranscriptionCompleted: () => {
          throw new Error('Simulated handler failure');
        },
      })
    );

    const server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;

    try {
      const response = await postWebhook(
        `http://localhost:${port}/webhook`,
        payloadString,
        validSignature
      );

      expect(response.status).toBe(500);
      expect(response.body).not.toContain('Simulated'); // Don't leak error details
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('calls onError handler when processing fails (Express)', async () => {
    const onError = vi.fn();

    const app = express();
    app.post(
      '/webhook',
      express.raw({ type: 'application/json' }),
      createExpressHandler({
        secret,
        autoFetch: false,
        onError,
        onTranscriptionCompleted: () => {
          throw new Error('Handler error');
        },
      })
    );

    const server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;

    try {
      await postWebhook(`http://localhost:${port}/webhook`, payloadString, validSignature);

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.any(Error), payload);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
