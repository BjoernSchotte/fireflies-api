import { createHmac } from 'node:crypto';
import http from 'node:http';
import express, { type Express } from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createWebhookHandler } from '../../src/middleware/express.js';

/** Helper to compute a valid signature for testing */
function computeSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

describe('Express webhook middleware', () => {
  const secret = 'test-express-webhook-secret';
  const validPayload = {
    meetingId: 'meeting-123',
    eventType: 'Transcription completed' as const,
  };
  const validPayloadString = JSON.stringify(validPayload);
  const validSignature = computeSignature(validPayloadString, secret);

  let app: Express;
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    app = express();

    // Use express.raw() middleware to get raw body
    app.post(
      '/webhooks/fireflies',
      express.raw({ type: 'application/json' }),
      createWebhookHandler({
        secret,
        onTranscriptionCompleted: vi.fn(),
      })
    );

    // Start server
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        port = typeof address === 'object' && address ? address.port : 0;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  async function makeRequest(
    body: string,
    signature?: string
  ): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port,
        path: '/webhooks/fireflies',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(signature && { 'x-hub-signature': signature }),
        },
      };

      const req = http.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: responseBody }));
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
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

describe('Express webhook handler with callbacks', () => {
  const secret = 'test-express-callback-secret';
  const validPayload = {
    meetingId: 'callback-meeting-456',
    eventType: 'Transcription completed' as const,
  };
  const validPayloadString = JSON.stringify(validPayload);
  const validSignature = computeSignature(validPayloadString, secret);

  it('calls onTranscriptionCompleted handler', async () => {
    const onTranscriptionCompleted = vi.fn();

    const app = express();
    app.post(
      '/webhooks',
      express.raw({ type: 'application/json' }),
      createWebhookHandler({
        secret,
        onTranscriptionCompleted,
      })
    );

    const server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.request(
          {
            hostname: 'localhost',
            port,
            path: '/webhooks',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-hub-signature': validSignature,
            },
          },
          (res) => {
            res.on('data', () => {});
            res.on('end', () => resolve());
          }
        );
        req.on('error', reject);
        req.write(validPayloadString);
        req.end();
      });

      expect(onTranscriptionCompleted).toHaveBeenCalledTimes(1);
      expect(onTranscriptionCompleted).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: validPayload,
        })
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('calls onEvent handler', async () => {
    const onEvent = vi.fn();

    const app = express();
    app.post(
      '/webhooks',
      express.raw({ type: 'application/json' }),
      createWebhookHandler({
        secret,
        onEvent,
      })
    );

    const server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.request(
          {
            hostname: 'localhost',
            port,
            path: '/webhooks',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-hub-signature': validSignature,
            },
          },
          (res) => {
            res.on('data', () => {});
            res.on('end', () => resolve());
          }
        );
        req.on('error', reject);
        req.write(validPayloadString);
        req.end();
      });

      expect(onEvent).toHaveBeenCalledTimes(1);
      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: validPayload,
        })
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('returns 500 when handler throws', async () => {
    const app = express();
    app.post(
      '/webhooks',
      express.raw({ type: 'application/json' }),
      createWebhookHandler({
        secret,
        onTranscriptionCompleted: () => {
          throw new Error('Handler error');
        },
      })
    );

    const server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
        const req = http.request(
          {
            hostname: 'localhost',
            port,
            path: '/webhooks',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-hub-signature': validSignature,
            },
          },
          (res) => {
            let body = '';
            res.on('data', (chunk) => {
              body += chunk;
            });
            res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
          }
        );
        req.on('error', reject);
        req.write(validPayloadString);
        req.end();
      });

      expect(response.status).toBe(500);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
