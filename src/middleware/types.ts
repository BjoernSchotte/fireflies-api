import type { FirefliesClient } from '../client.js';
import type { Transcript } from '../types/transcript.js';
import type { WebhookPayload } from '../webhooks/types.js';

/**
 * Context provided to webhook event handlers.
 */
export interface WebhookHandlerContext {
  /** The parsed and validated webhook payload */
  payload: WebhookPayload;
  /** The full transcript, if apiKey provided and autoFetch enabled */
  transcript?: Transcript;
  /** FirefliesClient instance, available if apiKey provided */
  client?: FirefliesClient;
}

/**
 * Handler function for webhook events.
 */
export type WebhookEventHandler = (context: WebhookHandlerContext) => void | Promise<void>;

/**
 * Error handler function for webhook processing errors.
 */
export type WebhookErrorHandler = (error: Error, payload?: WebhookPayload) => void | Promise<void>;

/**
 * Options for configuring webhook middleware.
 */
export interface WebhookMiddlewareOptions {
  /** Webhook secret for signature verification (required) */
  secret: string;
  /** API key for auto-fetching transcripts (optional) */
  apiKey?: string;
  /** Auto-fetch transcript when apiKey is provided (default: true if apiKey provided) */
  autoFetch?: boolean;
  /** Handler called for 'Transcription completed' events */
  onTranscriptionCompleted?: WebhookEventHandler;
  /** Generic handler called for all events (runs before specific handlers) */
  onEvent?: WebhookEventHandler;
  /** Handler called when an error occurs during processing */
  onError?: WebhookErrorHandler;
}

/**
 * Result of processing a webhook request.
 */
export interface WebhookProcessResult {
  /** Whether processing was successful */
  success: boolean;
  /** HTTP status code to return */
  statusCode: number;
  /** Response body to return */
  body: string;
  /** Parsed payload (if successful) */
  payload?: WebhookPayload;
  /** Error that occurred (if unsuccessful) */
  error?: Error;
}

/**
 * Input data for webhook processing.
 */
export interface WebhookProcessInput {
  /** Raw request body as string or Buffer */
  rawBody: string | Buffer;
  /** x-hub-signature header value */
  signature?: string;
}
