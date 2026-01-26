import { WebhookParseError, WebhookVerificationError } from '../errors.js';
import type { ParseOptions, WebhookEventType, WebhookPayload } from './types.js';
import { verifyWebhookSignature } from './verify.js';

/** Valid webhook event types */
const VALID_EVENT_TYPES: WebhookEventType[] = ['Transcription completed'];

/**
 * Check if a value is a valid webhook event type.
 */
function isValidEventType(value: string): value is WebhookEventType {
  return VALID_EVENT_TYPES.includes(value as WebhookEventType);
}

/**
 * Type guard to check if a payload is a valid WebhookPayload.
 *
 * @param payload - The payload to validate
 * @returns true if the payload matches the WebhookPayload structure
 *
 * @example
 * ```typescript
 * if (isValidWebhookPayload(req.body)) {
 *   // req.body is now typed as WebhookPayload
 *   console.log(req.body.meetingId);
 * }
 * ```
 */
export function isValidWebhookPayload(payload: unknown): payload is WebhookPayload {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket access for index signatures
  const meetingId = (payload as Record<string, unknown>)['meetingId'];
  // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket access for index signatures
  const eventType = (payload as Record<string, unknown>)['eventType'];
  // biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket access for index signatures
  const clientReferenceId = (payload as Record<string, unknown>)['clientReferenceId'];

  return (
    typeof meetingId === 'string' &&
    typeof eventType === 'string' &&
    isValidEventType(eventType) &&
    (clientReferenceId === undefined || typeof clientReferenceId === 'string')
  );
}

/**
 * Parse and validate a Fireflies webhook payload.
 *
 * Optionally verifies the webhook signature if signature and secret are provided.
 *
 * @param payload - The webhook payload to parse
 * @param options - Optional verification options
 * @returns The validated WebhookPayload
 * @throws {WebhookVerificationError} If signature verification fails
 * @throws {WebhookParseError} If payload structure is invalid
 *
 * @example
 * ```typescript
 * // Parse without verification
 * const event = parseWebhookPayload(req.body);
 * console.log(event.meetingId);
 *
 * // Parse with verification
 * const event = parseWebhookPayload(req.body, {
 *   signature: req.headers['x-hub-signature'],
 *   secret: process.env.WEBHOOK_SECRET,
 * });
 * ```
 */
export function parseWebhookPayload(payload: unknown, options?: ParseOptions): WebhookPayload {
  // Verify signature if both signature and secret are provided
  if (options?.signature && options?.secret) {
    const isValid = verifyWebhookSignature({
      payload: payload as string | object,
      signature: options.signature,
      secret: options.secret,
    });

    if (!isValid) {
      throw new WebhookVerificationError('Invalid webhook signature');
    }
  }

  // Validate payload structure
  if (!isValidWebhookPayload(payload)) {
    throw new WebhookParseError(
      'Invalid webhook payload: expected meetingId (string), eventType (valid event type), and optional clientReferenceId (string)'
    );
  }

  return payload;
}
