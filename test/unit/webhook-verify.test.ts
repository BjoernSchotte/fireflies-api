import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyWebhookSignature } from '../../src/webhooks/verify.js';

/** Helper to compute a valid signature for testing */
function computeSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

describe('verifyWebhookSignature', () => {
  const secret = 'test-webhook-secret-123';
  const payload = JSON.stringify({ meetingId: '123', eventType: 'Transcription completed' });

  it('returns true for valid signature with string payload', () => {
    const signature = computeSignature(payload, secret);

    const result = verifyWebhookSignature({ payload, signature, secret });

    expect(result).toBe(true);
  });

  it('returns true for valid signature with object payload', () => {
    const payloadObj = { meetingId: '123', eventType: 'Transcription completed' };
    // Signature is computed against JSON.stringify(payloadObj)
    const signature = computeSignature(JSON.stringify(payloadObj), secret);

    const result = verifyWebhookSignature({ payload: payloadObj, signature, secret });

    expect(result).toBe(true);
  });

  it('returns false for invalid signature', () => {
    const result = verifyWebhookSignature({
      payload,
      signature: 'invalid-signature-abc123',
      secret,
    });

    expect(result).toBe(false);
  });

  it('returns false for tampered payload', () => {
    const signature = computeSignature(payload, secret);
    const tamperedPayload = JSON.stringify({
      meetingId: '456',
      eventType: 'Transcription completed',
    });

    const result = verifyWebhookSignature({
      payload: tamperedPayload,
      signature,
      secret,
    });

    expect(result).toBe(false);
  });

  it('returns false for wrong secret', () => {
    const signature = computeSignature(payload, secret);

    const result = verifyWebhookSignature({
      payload,
      signature,
      secret: 'wrong-secret',
    });

    expect(result).toBe(false);
  });

  it('returns false for empty signature', () => {
    const result = verifyWebhookSignature({
      payload,
      signature: '',
      secret,
    });

    expect(result).toBe(false);
  });

  it('returns false for empty secret', () => {
    const signature = computeSignature(payload, secret);

    const result = verifyWebhookSignature({
      payload,
      signature,
      secret: '',
    });

    expect(result).toBe(false);
  });

  it('handles signatures of different lengths safely', () => {
    // This tests that timing-safe comparison doesn't throw on different length inputs
    const result = verifyWebhookSignature({
      payload,
      signature: 'short',
      secret,
    });

    expect(result).toBe(false);
  });

  it('handles very long invalid signatures', () => {
    const result = verifyWebhookSignature({
      payload,
      signature: 'a'.repeat(1000),
      secret,
    });

    expect(result).toBe(false);
  });

  it('works with complex payload objects', () => {
    const complexPayload = {
      meetingId: '123',
      eventType: 'Transcription completed',
      clientReferenceId: 'ref-456',
      nested: { data: [1, 2, 3] },
    };
    const payloadString = JSON.stringify(complexPayload);
    const signature = computeSignature(payloadString, secret);

    const result = verifyWebhookSignature({
      payload: complexPayload,
      signature,
      secret,
    });

    expect(result).toBe(true);
  });

  it('returns false when payload object has different key order', () => {
    // JSON.stringify key order matters - different order = different signature
    const payloadObj = { meetingId: '123', eventType: 'Transcription completed' };
    const signature = computeSignature(JSON.stringify(payloadObj), secret);

    // Same data but different key order produces different JSON
    const reorderedPayload = { eventType: 'Transcription completed', meetingId: '123' };

    const result = verifyWebhookSignature({
      payload: reorderedPayload,
      signature,
      secret,
    });

    // This will be false because JSON.stringify produces different output
    expect(result).toBe(false);
  });
});
