import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { WebhookParseError, WebhookVerificationError } from '../../src/errors.js';
import { buildHandlerContext, processWebhook, validateOptions } from '../../src/middleware/core.js';
import type {
  WebhookHandlerContext,
  WebhookMiddlewareOptions,
  WebhookProcessInput,
} from '../../src/middleware/types.js';

/** Helper to compute a valid signature for testing */
function computeSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

describe('validateOptions', () => {
  it('returns true for valid options with only secret', () => {
    const options: WebhookMiddlewareOptions = {
      secret: 'my-webhook-secret',
    };

    expect(() => validateOptions(options)).not.toThrow();
  });

  it('returns true for valid options with all handlers', () => {
    const options: WebhookMiddlewareOptions = {
      secret: 'my-webhook-secret',
      apiKey: 'my-api-key',
      autoFetch: true,
      onTranscriptionCompleted: vi.fn(),
      onEvent: vi.fn(),
      onError: vi.fn(),
    };

    expect(() => validateOptions(options)).not.toThrow();
  });

  it('throws for missing secret', () => {
    const options = {} as WebhookMiddlewareOptions;

    expect(() => validateOptions(options)).toThrow(/secret.*required/i);
  });

  it('throws for empty secret', () => {
    const options: WebhookMiddlewareOptions = {
      secret: '',
    };

    expect(() => validateOptions(options)).toThrow(/secret.*required/i);
  });

  it('throws for whitespace-only secret', () => {
    const options: WebhookMiddlewareOptions = {
      secret: '   ',
    };

    expect(() => validateOptions(options)).toThrow(/secret.*required/i);
  });
});

describe('buildHandlerContext', () => {
  const validPayload = {
    meetingId: 'meeting-123',
    eventType: 'Transcription completed' as const,
  };

  it('builds context with payload only', () => {
    const context = buildHandlerContext({ payload: validPayload });

    expect(context.payload).toEqual(validPayload);
    expect(context.client).toBeUndefined();
    expect(context.transcript).toBeUndefined();
  });

  it('builds context with client when apiKey provided', () => {
    const context = buildHandlerContext({
      payload: validPayload,
      apiKey: 'my-api-key',
    });

    expect(context.payload).toEqual(validPayload);
    expect(context.client).toBeDefined();
    expect(context.transcript).toBeUndefined();
  });

  it('builds context with fetched transcript when autoFetch enabled', async () => {
    // Create a mock transcript
    const mockTranscript = {
      id: 'meeting-123',
      title: 'Test Meeting',
    };

    // Create a context with a pre-provided transcript (simulating auto-fetch)
    const context = buildHandlerContext({
      payload: validPayload,
      apiKey: 'my-api-key',
      transcript: mockTranscript as unknown as import('../../src/types/transcript.js').Transcript,
    });

    expect(context.payload).toEqual(validPayload);
    expect(context.client).toBeDefined();
    expect(context.transcript).toEqual(mockTranscript);
  });
});

describe('processWebhook', () => {
  const secret = 'test-webhook-secret';
  const validPayload = {
    meetingId: 'meeting-123',
    eventType: 'Transcription completed' as const,
  };
  const validPayloadString = JSON.stringify(validPayload);
  const validSignature = computeSignature(validPayloadString, secret);

  describe('successful processing', () => {
    it('processes valid webhook with signature', async () => {
      const options: WebhookMiddlewareOptions = {
        secret,
      };
      const input: WebhookProcessInput = {
        rawBody: validPayloadString,
        signature: validSignature,
      };

      const result = await processWebhook(input, options);

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.payload).toEqual(validPayload);
      expect(result.error).toBeUndefined();
    });

    it('processes webhook with Buffer body', async () => {
      const options: WebhookMiddlewareOptions = {
        secret,
      };
      const input: WebhookProcessInput = {
        rawBody: Buffer.from(validPayloadString),
        signature: validSignature,
      };

      const result = await processWebhook(input, options);

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.payload).toEqual(validPayload);
    });

    it('calls onEvent handler', async () => {
      const onEvent = vi.fn();
      const options: WebhookMiddlewareOptions = {
        secret,
        onEvent,
      };
      const input: WebhookProcessInput = {
        rawBody: validPayloadString,
        signature: validSignature,
      };

      await processWebhook(input, options);

      expect(onEvent).toHaveBeenCalledTimes(1);
      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: validPayload,
        })
      );
    });

    it('calls onTranscriptionCompleted handler for matching event', async () => {
      const onTranscriptionCompleted = vi.fn();
      const options: WebhookMiddlewareOptions = {
        secret,
        onTranscriptionCompleted,
      };
      const input: WebhookProcessInput = {
        rawBody: validPayloadString,
        signature: validSignature,
      };

      await processWebhook(input, options);

      expect(onTranscriptionCompleted).toHaveBeenCalledTimes(1);
      expect(onTranscriptionCompleted).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: validPayload,
        })
      );
    });

    it('calls onEvent before onTranscriptionCompleted', async () => {
      const callOrder: string[] = [];
      const onEvent = vi.fn(() => callOrder.push('onEvent'));
      const onTranscriptionCompleted = vi.fn(() => callOrder.push('onTranscriptionCompleted'));
      const options: WebhookMiddlewareOptions = {
        secret,
        onEvent,
        onTranscriptionCompleted,
      };
      const input: WebhookProcessInput = {
        rawBody: validPayloadString,
        signature: validSignature,
      };

      await processWebhook(input, options);

      expect(callOrder).toEqual(['onEvent', 'onTranscriptionCompleted']);
    });

    it('awaits async handlers', async () => {
      let handlerCompleted = false;
      const onEvent = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        handlerCompleted = true;
      });
      const options: WebhookMiddlewareOptions = {
        secret,
        onEvent,
      };
      const input: WebhookProcessInput = {
        rawBody: validPayloadString,
        signature: validSignature,
      };

      await processWebhook(input, options);

      expect(handlerCompleted).toBe(true);
    });
  });

  describe('error handling', () => {
    it('returns 401 for invalid signature', async () => {
      const options: WebhookMiddlewareOptions = {
        secret,
      };
      const input: WebhookProcessInput = {
        rawBody: validPayloadString,
        signature: 'invalid-signature',
      };

      const result = await processWebhook(input, options);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(401);
      expect(result.error).toBeInstanceOf(WebhookVerificationError);
    });

    it('returns 401 for missing signature', async () => {
      const options: WebhookMiddlewareOptions = {
        secret,
      };
      const input: WebhookProcessInput = {
        rawBody: validPayloadString,
        // No signature
      };

      const result = await processWebhook(input, options);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(401);
      expect(result.error).toBeInstanceOf(WebhookVerificationError);
    });

    it('returns 400 for invalid JSON', async () => {
      const invalidJson = 'not valid json {';
      const options: WebhookMiddlewareOptions = {
        secret,
      };
      const input: WebhookProcessInput = {
        rawBody: invalidJson,
        signature: computeSignature(invalidJson, secret),
      };

      const result = await processWebhook(input, options);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
    });

    it('returns 400 for invalid payload structure', async () => {
      const invalidPayload = JSON.stringify({ invalid: 'payload' });
      const options: WebhookMiddlewareOptions = {
        secret,
      };
      const input: WebhookProcessInput = {
        rawBody: invalidPayload,
        signature: computeSignature(invalidPayload, secret),
      };

      const result = await processWebhook(input, options);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toBeInstanceOf(WebhookParseError);
    });

    it('returns 500 for handler error', async () => {
      const handlerError = new Error('Handler failed');
      const onEvent = vi.fn(() => {
        throw handlerError;
      });
      const options: WebhookMiddlewareOptions = {
        secret,
        onEvent,
      };
      const input: WebhookProcessInput = {
        rawBody: validPayloadString,
        signature: validSignature,
      };

      const result = await processWebhook(input, options);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
      expect(result.error).toBe(handlerError);
    });

    it('returns 500 for async handler error', async () => {
      const handlerError = new Error('Async handler failed');
      const onTranscriptionCompleted = vi.fn(async () => {
        throw handlerError;
      });
      const options: WebhookMiddlewareOptions = {
        secret,
        onTranscriptionCompleted,
      };
      const input: WebhookProcessInput = {
        rawBody: validPayloadString,
        signature: validSignature,
      };

      const result = await processWebhook(input, options);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
      expect(result.error).toBe(handlerError);
    });

    it('calls onError handler when processing fails', async () => {
      const onError = vi.fn();
      const options: WebhookMiddlewareOptions = {
        secret,
        onError,
      };
      const input: WebhookProcessInput = {
        rawBody: validPayloadString,
        signature: 'invalid-signature',
      };

      await processWebhook(input, options);

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.any(WebhookVerificationError),
        undefined // payload is not available on verification error
      );
    });

    it('calls onError handler with payload when handler fails', async () => {
      const handlerError = new Error('Handler failed');
      const onError = vi.fn();
      const onEvent = vi.fn(() => {
        throw handlerError;
      });
      const options: WebhookMiddlewareOptions = {
        secret,
        onError,
        onEvent,
      };
      const input: WebhookProcessInput = {
        rawBody: validPayloadString,
        signature: validSignature,
      };

      await processWebhook(input, options);

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(handlerError, validPayload);
    });
  });

  describe('response body', () => {
    it('returns success body', async () => {
      const options: WebhookMiddlewareOptions = {
        secret,
      };
      const input: WebhookProcessInput = {
        rawBody: validPayloadString,
        signature: validSignature,
      };

      const result = await processWebhook(input, options);

      expect(result.body).toBe('ok');
    });

    it('returns error body for verification error', async () => {
      const options: WebhookMiddlewareOptions = {
        secret,
      };
      const input: WebhookProcessInput = {
        rawBody: validPayloadString,
        signature: 'invalid',
      };

      const result = await processWebhook(input, options);

      expect(result.body).toMatch(/invalid.*signature/i);
    });

    it('returns error body for parse error', async () => {
      const invalidPayload = JSON.stringify({ bad: 'payload' });
      const options: WebhookMiddlewareOptions = {
        secret,
      };
      const input: WebhookProcessInput = {
        rawBody: invalidPayload,
        signature: computeSignature(invalidPayload, secret),
      };

      const result = await processWebhook(input, options);

      expect(result.body).toMatch(/invalid.*payload/i);
    });

    it('returns generic error body for handler error', async () => {
      const onEvent = vi.fn(() => {
        throw new Error('secret internal error');
      });
      const options: WebhookMiddlewareOptions = {
        secret,
        onEvent,
      };
      const input: WebhookProcessInput = {
        rawBody: validPayloadString,
        signature: validSignature,
      };

      const result = await processWebhook(input, options);

      // Should NOT expose internal error details
      expect(result.body).not.toContain('secret internal error');
      expect(result.body).toMatch(/internal.*error/i);
    });
  });

  describe('client creation', () => {
    it('includes client in context when apiKey provided', async () => {
      let capturedContext: WebhookHandlerContext | undefined;
      const onEvent = vi.fn((ctx: WebhookHandlerContext) => {
        capturedContext = ctx;
      });
      const options: WebhookMiddlewareOptions = {
        secret,
        apiKey: 'my-api-key',
        autoFetch: false, // Disable auto-fetch to avoid real API calls
        onEvent,
      };
      const input: WebhookProcessInput = {
        rawBody: validPayloadString,
        signature: validSignature,
      };

      await processWebhook(input, options);

      expect(capturedContext?.client).toBeDefined();
    });

    it('does not include client when apiKey not provided', async () => {
      let capturedContext: WebhookHandlerContext | undefined;
      const onEvent = vi.fn((ctx: WebhookHandlerContext) => {
        capturedContext = ctx;
      });
      const options: WebhookMiddlewareOptions = {
        secret,
        onEvent,
      };
      const input: WebhookProcessInput = {
        rawBody: validPayloadString,
        signature: validSignature,
      };

      await processWebhook(input, options);

      expect(capturedContext?.client).toBeUndefined();
    });
  });
});
