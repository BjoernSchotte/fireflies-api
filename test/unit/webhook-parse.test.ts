import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { WebhookParseError, WebhookVerificationError } from '../../src/errors.js';
import { isValidWebhookPayload, parseWebhookPayload } from '../../src/webhooks/parse.js';

/** Helper to compute a valid signature for testing */
function computeSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

describe('isValidWebhookPayload', () => {
  it('returns true for valid payload with required fields', () => {
    const payload = {
      meetingId: '123',
      eventType: 'Transcription completed',
    };

    expect(isValidWebhookPayload(payload)).toBe(true);
  });

  it('returns true for valid payload with clientReferenceId', () => {
    const payload = {
      meetingId: '123',
      eventType: 'Transcription completed',
      clientReferenceId: 'my-ref-456',
    };

    expect(isValidWebhookPayload(payload)).toBe(true);
  });

  it('returns true for payload with extra fields (forward compatibility)', () => {
    const payload = {
      meetingId: '123',
      eventType: 'Transcription completed',
      unknownField: 'some-value',
      anotherField: { nested: true },
    };

    expect(isValidWebhookPayload(payload)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isValidWebhookPayload(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isValidWebhookPayload(undefined)).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(isValidWebhookPayload('string')).toBe(false);
    expect(isValidWebhookPayload(123)).toBe(false);
    expect(isValidWebhookPayload(true)).toBe(false);
  });

  it('returns false for missing meetingId', () => {
    const payload = {
      eventType: 'Transcription completed',
    };

    expect(isValidWebhookPayload(payload)).toBe(false);
  });

  it('returns false for missing eventType', () => {
    const payload = {
      meetingId: '123',
    };

    expect(isValidWebhookPayload(payload)).toBe(false);
  });

  it('returns false for non-string meetingId', () => {
    const payload = {
      meetingId: 123,
      eventType: 'Transcription completed',
    };

    expect(isValidWebhookPayload(payload)).toBe(false);
  });

  it('returns false for non-string eventType', () => {
    const payload = {
      meetingId: '123',
      eventType: 42,
    };

    expect(isValidWebhookPayload(payload)).toBe(false);
  });

  it('returns false for invalid eventType', () => {
    const payload = {
      meetingId: '123',
      eventType: 'Invalid event',
    };

    expect(isValidWebhookPayload(payload)).toBe(false);
  });

  it('returns false for non-string clientReferenceId', () => {
    const payload = {
      meetingId: '123',
      eventType: 'Transcription completed',
      clientReferenceId: 123,
    };

    expect(isValidWebhookPayload(payload)).toBe(false);
  });
});

describe('parseWebhookPayload', () => {
  it('parses valid payload', () => {
    const payload = {
      meetingId: '123',
      eventType: 'Transcription completed',
    };

    const result = parseWebhookPayload(payload);

    expect(result).toEqual(payload);
  });

  it('parses valid payload with clientReferenceId', () => {
    const payload = {
      meetingId: '123',
      eventType: 'Transcription completed',
      clientReferenceId: 'ref-456',
    };

    const result = parseWebhookPayload(payload);

    expect(result).toEqual(payload);
  });

  it('throws WebhookParseError for invalid payload', () => {
    const payload = {
      meetingId: 123, // should be string
      eventType: 'Transcription completed',
    };

    expect(() => parseWebhookPayload(payload)).toThrow(WebhookParseError);
  });

  it('throws WebhookParseError for missing fields', () => {
    const payload = {
      meetingId: '123',
    };

    expect(() => parseWebhookPayload(payload)).toThrow(WebhookParseError);
  });

  it('throws WebhookParseError for null payload', () => {
    expect(() => parseWebhookPayload(null)).toThrow(WebhookParseError);
  });

  it('includes helpful error message', () => {
    const payload = { invalid: 'payload' };

    expect(() => parseWebhookPayload(payload)).toThrow(/expected meetingId/);
  });
});

describe('parseWebhookPayload with signature verification', () => {
  const secret = 'test-webhook-secret-123';
  const payload = {
    meetingId: '123',
    eventType: 'Transcription completed' as const,
  };
  const payloadString = JSON.stringify(payload);
  const validSignature = computeSignature(payloadString, secret);

  it('parses and verifies valid payload', () => {
    const result = parseWebhookPayload(payload, {
      signature: validSignature,
      secret,
    });

    expect(result).toEqual(payload);
  });

  it('throws WebhookVerificationError for invalid signature', () => {
    expect(() =>
      parseWebhookPayload(payload, {
        signature: 'invalid-signature',
        secret,
      })
    ).toThrow(WebhookVerificationError);
  });

  it('throws WebhookVerificationError for wrong secret', () => {
    expect(() =>
      parseWebhookPayload(payload, {
        signature: validSignature,
        secret: 'wrong-secret',
      })
    ).toThrow(WebhookVerificationError);
  });

  it('skips verification if only signature is provided', () => {
    // Only signature without secret should skip verification
    const result = parseWebhookPayload(payload, {
      signature: 'any-signature',
    });

    expect(result).toEqual(payload);
  });

  it('skips verification if only secret is provided', () => {
    // Only secret without signature should skip verification
    const result = parseWebhookPayload(payload, {
      secret,
    });

    expect(result).toEqual(payload);
  });

  it('skips verification if no options provided', () => {
    const result = parseWebhookPayload(payload);

    expect(result).toEqual(payload);
  });

  it('verifies then parses (verification error takes precedence)', () => {
    // Invalid signature and invalid payload - should throw verification error
    const invalidPayload = { invalid: 'data' };

    expect(() =>
      parseWebhookPayload(invalidPayload, {
        signature: 'invalid-signature',
        secret,
      })
    ).toThrow(WebhookVerificationError);
  });
});

describe('WebhookVerificationError', () => {
  it('has correct properties', () => {
    const error = new WebhookVerificationError('Test message');

    expect(error.name).toBe('WebhookVerificationError');
    expect(error.code).toBe('WEBHOOK_VERIFICATION_FAILED');
    expect(error.message).toBe('Test message');
    expect(error.status).toBe(401);
  });
});

describe('WebhookParseError', () => {
  it('has correct properties', () => {
    const error = new WebhookParseError('Test message');

    expect(error.name).toBe('WebhookParseError');
    expect(error.code).toBe('WEBHOOK_PARSE_FAILED');
    expect(error.message).toBe('Test message');
    expect(error.status).toBe(400);
  });
});
