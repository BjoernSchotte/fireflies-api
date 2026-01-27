import { createHmac } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createWebhookHandler, firefliesWebhook } from '../../src/middleware/fastify.js';

/** Helper to compute a valid signature for testing */
function computeSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

describe('Fastify webhook handler', () => {
  const secret = 'test-fastify-webhook-secret';
  const validPayload = {
    meetingId: 'meeting-123',
    eventType: 'Transcription completed' as const,
  };
  const validPayloadString = JSON.stringify(validPayload);
  const validSignature = computeSignature(validPayloadString, secret);

  let fastify: FastifyInstance;

  beforeAll(async () => {
    fastify = Fastify();

    // Add raw body content type parser
    fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
      done(null, body);
    });

    fastify.post(
      '/webhooks/fireflies',
      createWebhookHandler({
        secret,
        onTranscriptionCompleted: vi.fn(),
      })
    );

    await fastify.listen({ port: 0 });
  });

  afterAll(async () => {
    await fastify.close();
  });

  async function makeRequest(
    body: string,
    signature?: string
  ): Promise<{ status: number; body: string }> {
    const response = await fastify.inject({
      method: 'POST',
      url: '/webhooks/fireflies',
      payload: body,
      headers: {
        'content-type': 'application/json',
        ...(signature && { 'x-hub-signature': signature }),
      },
    });

    return { status: response.statusCode, body: response.body };
  }

  it('returns 200 for valid webhook', async () => {
    const response = await makeRequest(validPayloadString, validSignature);

    expect(response.status).toBe(200);
    expect(response.body).toBe('ok');
  });

  it('returns 401 for invalid signature', async () => {
    const response = await makeRequest(validPayloadString, 'invalid-signature');

    expect(response.status).toBe(401);
  });

  it('returns 401 for missing signature', async () => {
    const response = await makeRequest(validPayloadString);

    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid JSON', async () => {
    const invalidJson = 'not valid json {';
    const signature = computeSignature(invalidJson, secret);
    const response = await makeRequest(invalidJson, signature);

    expect(response.status).toBe(400);
  });

  it('returns 400 for invalid payload structure', async () => {
    const invalidPayload = JSON.stringify({ invalid: 'payload' });
    const signature = computeSignature(invalidPayload, secret);
    const response = await makeRequest(invalidPayload, signature);

    expect(response.status).toBe(400);
  });
});

describe('Fastify webhook plugin', () => {
  const secret = 'test-fastify-plugin-secret';
  const validPayload = {
    meetingId: 'plugin-meeting-456',
    eventType: 'Transcription completed' as const,
  };
  const validPayloadString = JSON.stringify(validPayload);
  const validSignature = computeSignature(validPayloadString, secret);

  it('registers plugin with default path', async () => {
    const onTranscriptionCompleted = vi.fn();

    const fastify = Fastify();
    await fastify.register(firefliesWebhook, {
      secret,
      onTranscriptionCompleted,
    });
    await fastify.ready();

    try {
      const response = await fastify.inject({
        method: 'POST',
        url: '/webhooks/fireflies',
        payload: validPayloadString,
        headers: {
          'content-type': 'application/json',
          'x-hub-signature': validSignature,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(onTranscriptionCompleted).toHaveBeenCalledTimes(1);
    } finally {
      await fastify.close();
    }
  });

  it('registers plugin with custom path', async () => {
    const onTranscriptionCompleted = vi.fn();

    const fastify = Fastify();
    await fastify.register(firefliesWebhook, {
      path: '/custom/webhook/path',
      secret,
      onTranscriptionCompleted,
    });
    await fastify.ready();

    try {
      const response = await fastify.inject({
        method: 'POST',
        url: '/custom/webhook/path',
        payload: validPayloadString,
        headers: {
          'content-type': 'application/json',
          'x-hub-signature': validSignature,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(onTranscriptionCompleted).toHaveBeenCalledTimes(1);
    } finally {
      await fastify.close();
    }
  });

  it('calls onEvent handler', async () => {
    const onEvent = vi.fn();

    const fastify = Fastify();
    await fastify.register(firefliesWebhook, {
      secret,
      onEvent,
    });
    await fastify.ready();

    try {
      await fastify.inject({
        method: 'POST',
        url: '/webhooks/fireflies',
        payload: validPayloadString,
        headers: {
          'content-type': 'application/json',
          'x-hub-signature': validSignature,
        },
      });

      expect(onEvent).toHaveBeenCalledTimes(1);
      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: validPayload,
        })
      );
    } finally {
      await fastify.close();
    }
  });

  it('returns 500 when handler throws', async () => {
    const fastify = Fastify();
    await fastify.register(firefliesWebhook, {
      secret,
      onTranscriptionCompleted: () => {
        throw new Error('Handler error');
      },
    });
    await fastify.ready();

    try {
      const response = await fastify.inject({
        method: 'POST',
        url: '/webhooks/fireflies',
        payload: validPayloadString,
        headers: {
          'content-type': 'application/json',
          'x-hub-signature': validSignature,
        },
      });

      expect(response.statusCode).toBe(500);
    } finally {
      await fastify.close();
    }
  });
});
