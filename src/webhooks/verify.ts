import { createHmac, timingSafeEqual } from 'node:crypto';
import type { VerifyOptions } from './types.js';

/**
 * Verify the authenticity of a Fireflies webhook using HMAC SHA-256.
 *
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param options - Verification options
 * @returns true if the signature is valid, false otherwise
 *
 * @example
 * ```typescript
 * const isValid = verifyWebhookSignature({
 *   payload: req.body,
 *   signature: req.headers['x-hub-signature'],
 *   secret: process.env.WEBHOOK_SECRET,
 * });
 *
 * if (!isValid) {
 *   return res.status(401).send('Invalid signature');
 * }
 * ```
 */
export function verifyWebhookSignature(options: VerifyOptions): boolean {
  const { payload, signature, secret } = options;

  if (!signature || !secret) {
    return false;
  }

  // Convert payload to string if object
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

  // Compute HMAC SHA-256
  const computed = createHmac('sha256', secret).update(payloadString).digest('hex');

  // Timing-safe comparison to prevent timing attacks
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(computed));
  } catch {
    // Different lengths will throw an error
    return false;
  }
}
