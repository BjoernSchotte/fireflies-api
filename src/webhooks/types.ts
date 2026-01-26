/**
 * Webhook event types supported by Fireflies.
 * Currently only "Transcription completed" is available.
 */
export type WebhookEventType = 'Transcription completed';

/**
 * Webhook payload received from Fireflies.
 * Sent when configured webhook events occur.
 */
export interface WebhookPayload {
  /** Meeting/transcript ID */
  meetingId: string;
  /** The event that triggered this webhook */
  eventType: WebhookEventType;
  /** Custom reference ID set during upload (optional) */
  clientReferenceId?: string;
}

/**
 * Options for verifying a webhook signature.
 */
export interface VerifyOptions {
  /** Raw request body (string) or parsed payload (object) */
  payload: string | object;
  /** x-hub-signature header value */
  signature: string;
  /** Your webhook secret (16-32 characters) */
  secret: string;
}

/**
 * Options for parsing a webhook payload with optional verification.
 */
export interface ParseOptions {
  /** x-hub-signature header value for verification */
  signature?: string;
  /** Your webhook secret for verification */
  secret?: string;
}
