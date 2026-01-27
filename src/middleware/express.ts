import type { Request, RequestHandler, Response } from 'express';
import { processWebhook, validateOptions } from './core.js';
import type { WebhookMiddlewareOptions } from './types.js';

/**
 * Create an Express middleware handler for Fireflies webhooks.
 *
 * Requires `express.raw({ type: 'application/json' })` middleware before this handler
 * to receive the raw body for signature verification.
 *
 * @param options - Webhook middleware options
 * @returns Express request handler
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { createWebhookHandler } from 'fireflies-api/express';
 *
 * const app = express();
 *
 * app.post('/webhooks/fireflies',
 *   express.raw({ type: 'application/json' }),
 *   createWebhookHandler({
 *     secret: process.env.WEBHOOK_SECRET!,
 *     apiKey: process.env.FIREFLIES_API_KEY,
 *     onTranscriptionCompleted: async ({ payload, transcript }) => {
 *       console.log(`Transcript ready: ${transcript?.title}`);
 *     },
 *   })
 * );
 * ```
 */
export function createWebhookHandler(options: WebhookMiddlewareOptions): RequestHandler {
  validateOptions(options);

  return async (req: Request, res: Response): Promise<void> => {
    // Get raw body - should be a Buffer when using express.raw()
    const rawBody = req.body as Buffer | string;

    // Get signature from header
    const signature = req.headers['x-hub-signature'] as string | undefined;

    // Process the webhook
    const result = await processWebhook(
      {
        rawBody,
        signature,
      },
      options
    );

    // Send response
    res.status(result.statusCode).send(result.body);
  };
}
