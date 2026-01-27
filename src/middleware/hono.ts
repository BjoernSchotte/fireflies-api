import type { Context, Handler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { processWebhook, validateOptions } from './core.js';
import type { WebhookMiddlewareOptions } from './types.js';

/**
 * Create a Hono handler for Fireflies webhooks.
 *
 * @param options - Webhook middleware options
 * @returns Hono handler
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { webhookHandler } from 'fireflies-api/hono';
 *
 * const app = new Hono();
 *
 * app.post('/webhooks/fireflies', webhookHandler({
 *   secret: process.env.WEBHOOK_SECRET!,
 *   apiKey: process.env.FIREFLIES_API_KEY,
 *   onTranscriptionCompleted: async ({ payload, transcript }) => {
 *     console.log(`Transcript ready: ${transcript?.title}`);
 *   },
 * }));
 * ```
 */
export function webhookHandler(options: WebhookMiddlewareOptions): Handler {
  validateOptions(options);

  return async (c: Context): Promise<Response> => {
    // Get raw body as text
    const rawBody = await c.req.text();

    // Get signature from header
    const signature = c.req.header('x-hub-signature');

    // Process the webhook
    const result = await processWebhook(
      {
        rawBody,
        signature,
      },
      options
    );

    // Return response
    return c.text(result.body, result.statusCode as ContentfulStatusCode);
  };
}

/**
 * Alias for webhookHandler for consistency with other adapters.
 *
 * @param options - Webhook middleware options
 * @returns Hono handler
 */
export const createWebhookHandler = webhookHandler;
