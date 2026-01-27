import { createHmac } from 'node:crypto';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { createWebhookHandler, webhookHandler } from '../../src/middleware/hono.js';

/** Helper to compute a valid signature for testing */
function computeSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

describe('Hono webhook handler', () => {
  const secret = 'test-hono-webhook-secret';
  const validPayload = {
    meetingId: 'meeting-123',
    eventType: 'Transcription completed' as const,
  };
  const validPayloadString = JSON.stringify(validPayload);
  const validSignature = computeSignature(validPayloadString, secret);

  it('returns 200 for valid webhook', async () => {
    const app = new Hono();
    app.post(
      '/webhooks/fireflies',
      webhookHandler({
        secret,
        onTranscriptionCompleted: vi.fn(),
      })
    );

    const response = await app.request('/webhooks/fireflies', {
      method: 'POST',
      body: validPayloadString,
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature': validSignature,
      },
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
  });

  it('returns 401 for invalid signature', async () => {
    const app = new Hono();
    app.post(
      '/webhooks/fireflies',
      webhookHandler({
        secret,
      })
    );

    const response = await app.request('/webhooks/fireflies', {
      method: 'POST',
      body: validPayloadString,
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature': 'invalid-signature',
      },
    });

    expect(response.status).toBe(401);
  });

  it('returns 401 for missing signature', async () => {
    const app = new Hono();
    app.post(
      '/webhooks/fireflies',
      webhookHandler({
        secret,
      })
    );

    const response = await app.request('/webhooks/fireflies', {
      method: 'POST',
      body: validPayloadString,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid JSON', async () => {
    const app = new Hono();
    app.post(
      '/webhooks/fireflies',
      webhookHandler({
        secret,
      })
    );

    const invalidJson = 'not valid json {';
    const signature = computeSignature(invalidJson, secret);
    const response = await app.request('/webhooks/fireflies', {
      method: 'POST',
      body: invalidJson,
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature': signature,
      },
    });

    expect(response.status).toBe(400);
  });

  it('returns 400 for invalid payload structure', async () => {
    const app = new Hono();
    app.post(
      '/webhooks/fireflies',
      webhookHandler({
        secret,
      })
    );

    const invalidPayload = JSON.stringify({ invalid: 'payload' });
    const signature = computeSignature(invalidPayload, secret);
    const response = await app.request('/webhooks/fireflies', {
      method: 'POST',
      body: invalidPayload,
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature': signature,
      },
    });

    expect(response.status).toBe(400);
  });
});

describe('Hono webhook handler callbacks', () => {
  const secret = 'test-hono-callback-secret';
  const validPayload = {
    meetingId: 'callback-meeting-789',
    eventType: 'Transcription completed' as const,
  };
  const validPayloadString = JSON.stringify(validPayload);
  const validSignature = computeSignature(validPayloadString, secret);

  it('calls onTranscriptionCompleted handler', async () => {
    const onTranscriptionCompleted = vi.fn();

    const app = new Hono();
    app.post(
      '/webhooks',
      webhookHandler({
        secret,
        onTranscriptionCompleted,
      })
    );

    await app.request('/webhooks', {
      method: 'POST',
      body: validPayloadString,
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature': validSignature,
      },
    });

    expect(onTranscriptionCompleted).toHaveBeenCalledTimes(1);
    expect(onTranscriptionCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: validPayload,
      })
    );
  });

  it('calls onEvent handler', async () => {
    const onEvent = vi.fn();

    const app = new Hono();
    app.post(
      '/webhooks',
      webhookHandler({
        secret,
        onEvent,
      })
    );

    await app.request('/webhooks', {
      method: 'POST',
      body: validPayloadString,
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature': validSignature,
      },
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: validPayload,
      })
    );
  });

  it('returns 500 when handler throws', async () => {
    const app = new Hono();
    app.post(
      '/webhooks',
      webhookHandler({
        secret,
        onTranscriptionCompleted: () => {
          throw new Error('Handler error');
        },
      })
    );

    const response = await app.request('/webhooks', {
      method: 'POST',
      body: validPayloadString,
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature': validSignature,
      },
    });

    expect(response.status).toBe(500);
  });
});

describe('Hono createWebhookHandler alias', () => {
  const secret = 'test-hono-alias-secret';
  const validPayload = {
    meetingId: 'alias-meeting-101',
    eventType: 'Transcription completed' as const,
  };
  const validPayloadString = JSON.stringify(validPayload);
  const validSignature = computeSignature(validPayloadString, secret);

  it('createWebhookHandler is an alias for webhookHandler', async () => {
    const onEvent = vi.fn();

    const app = new Hono();
    app.post(
      '/webhooks',
      createWebhookHandler({
        secret,
        onEvent,
      })
    );

    const response = await app.request('/webhooks', {
      method: 'POST',
      body: validPayloadString,
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature': validSignature,
      },
    });

    expect(response.status).toBe(200);
    expect(onEvent).toHaveBeenCalledTimes(1);
  });
});
