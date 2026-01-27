import { FirefliesClient } from '../client.js';
import { WebhookParseError, WebhookVerificationError } from '../errors.js';
import type { Transcript } from '../types/transcript.js';
import { parseWebhookPayload } from '../webhooks/parse.js';
import type { WebhookPayload } from '../webhooks/types.js';
import type {
  WebhookHandlerContext,
  WebhookMiddlewareOptions,
  WebhookProcessInput,
  WebhookProcessResult,
} from './types.js';

/**
 * Validate webhook middleware options.
 *
 * @param options - The options to validate
 * @throws Error if required options are missing
 */
export function validateOptions(options: WebhookMiddlewareOptions): void {
  if (!options.secret || !options.secret.trim()) {
    throw new Error('Webhook middleware: secret is required');
  }
}

/**
 * Parameters for building a handler context.
 */
export interface BuildContextParams {
  /** The validated webhook payload */
  payload: WebhookPayload;
  /** API key for creating client */
  apiKey?: string;
  /** Pre-fetched transcript (optional) */
  transcript?: Transcript;
}

/**
 * Build a handler context from the given parameters.
 *
 * @param params - The parameters for building the context
 * @returns The handler context
 */
export function buildHandlerContext(params: BuildContextParams): WebhookHandlerContext {
  const { payload, apiKey, transcript } = params;

  const context: WebhookHandlerContext = {
    payload,
  };

  if (apiKey) {
    context.client = new FirefliesClient({ apiKey });
  }

  if (transcript) {
    context.transcript = transcript;
  }

  return context;
}

/**
 * Parse raw body to string.
 */
function parseRawBody(rawBody: string | Buffer): string {
  return Buffer.isBuffer(rawBody) ? rawBody.toString('utf-8') : rawBody;
}

/**
 * Parse and validate the webhook payload from raw input.
 */
function parseAndValidatePayload(
  rawBody: string | Buffer,
  signature: string | undefined,
  secret: string
): WebhookPayload {
  if (!signature) {
    throw new WebhookVerificationError('Missing webhook signature');
  }

  const bodyString = parseRawBody(rawBody);

  let jsonPayload: unknown;
  try {
    jsonPayload = JSON.parse(bodyString);
  } catch {
    throw new WebhookParseError('Invalid JSON in webhook body');
  }

  return parseWebhookPayload(jsonPayload, { signature, secret });
}

/**
 * Optionally fetch transcript if apiKey provided and autoFetch enabled.
 */
async function fetchTranscriptIfEnabled(
  payload: WebhookPayload,
  apiKey: string | undefined,
  autoFetch: boolean | undefined
): Promise<Transcript | undefined> {
  if (!apiKey || autoFetch === false) {
    return undefined;
  }

  try {
    const client = new FirefliesClient({ apiKey });
    return await client.transcripts.get(payload.meetingId);
  } catch {
    // Silently ignore fetch errors - transcript will be undefined
    return undefined;
  }
}

/**
 * Execute event handlers with the given context.
 */
async function executeHandlers(
  context: WebhookHandlerContext,
  options: WebhookMiddlewareOptions
): Promise<void> {
  const { onEvent, onTranscriptionCompleted } = options;

  if (onEvent) {
    await onEvent(context);
  }

  if (context.payload.eventType === 'Transcription completed' && onTranscriptionCompleted) {
    await onTranscriptionCompleted(context);
  }
}

/**
 * Map an error to an appropriate HTTP response.
 */
function mapErrorToResponse(error: unknown): WebhookProcessResult {
  if (error instanceof WebhookVerificationError) {
    return {
      success: false,
      statusCode: 401,
      body: 'Invalid webhook signature',
      error,
    };
  }

  if (error instanceof WebhookParseError) {
    return {
      success: false,
      statusCode: 400,
      body: 'Invalid webhook payload',
      error,
    };
  }

  if (error instanceof SyntaxError) {
    return {
      success: false,
      statusCode: 400,
      body: 'Invalid JSON in webhook body',
      error,
    };
  }

  // Handler errors - don't expose internal details
  return {
    success: false,
    statusCode: 500,
    body: 'Internal server error',
    error: error instanceof Error ? error : new Error(String(error)),
  };
}

/**
 * Process a webhook request.
 *
 * This is the core processing logic used by all framework adapters.
 * It handles:
 * 1. Parsing JSON body
 * 2. Verifying signature
 * 3. Building handler context (optionally with auto-fetched transcript)
 * 4. Calling event handlers
 * 5. Mapping errors to appropriate HTTP responses
 *
 * @param input - The webhook request input
 * @param options - The middleware options
 * @returns The processing result with status code and body
 */
export async function processWebhook(
  input: WebhookProcessInput,
  options: WebhookMiddlewareOptions
): Promise<WebhookProcessResult> {
  const { rawBody, signature } = input;
  const { secret, apiKey, autoFetch, onError } = options;

  let parsedPayload: WebhookPayload | undefined;

  try {
    parsedPayload = parseAndValidatePayload(rawBody, signature, secret);

    const transcript = await fetchTranscriptIfEnabled(parsedPayload, apiKey, autoFetch);

    const context = buildHandlerContext({
      payload: parsedPayload,
      apiKey,
      transcript,
    });

    await executeHandlers(context, options);

    return {
      success: true,
      statusCode: 200,
      body: 'ok',
      payload: parsedPayload,
    };
  } catch (error) {
    if (onError && error instanceof Error) {
      await onError(error, parsedPayload);
    }

    return mapErrorToResponse(error);
  }
}
