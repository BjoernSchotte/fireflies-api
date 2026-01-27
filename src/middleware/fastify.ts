import type {
  FastifyInstance,
  FastifyPluginCallback,
  FastifyReply,
  FastifyRequest,
  RouteHandlerMethod,
} from 'fastify';
import { processWebhook, validateOptions } from './core.js';
import type { WebhookMiddlewareOptions } from './types.js';

/**
 * Options for the Fastify webhook plugin.
 */
export interface FastifyWebhookOptions extends WebhookMiddlewareOptions {
  /** Route path for the webhook endpoint (default: '/webhooks/fireflies') */
  path?: string;
}

/**
 * Create a Fastify route handler for Fireflies webhooks.
 *
 * Requires a raw body content type parser to receive the raw body for signature verification.
 *
 * @param options - Webhook middleware options
 * @returns Fastify route handler
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { createWebhookHandler } from 'fireflies-api/fastify';
 *
 * const fastify = Fastify();
 *
 * // Add raw body content type parser
 * fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
 *   done(null, body);
 * });
 *
 * fastify.post('/webhooks/fireflies', createWebhookHandler({
 *   secret: process.env.WEBHOOK_SECRET!,
 *   onTranscriptionCompleted: async ({ payload, transcript }) => {
 *     console.log(`Transcript ready: ${transcript?.title}`);
 *   },
 * }));
 * ```
 */
export function createWebhookHandler(options: WebhookMiddlewareOptions): RouteHandlerMethod {
  validateOptions(options);

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Get raw body - should be a Buffer when using raw body parser
    const rawBody = request.body as Buffer | string;

    // Get signature from header
    const signature = request.headers['x-hub-signature'] as string | undefined;

    // Process the webhook
    const result = await processWebhook(
      {
        rawBody,
        signature,
      },
      options
    );

    // Send response
    reply.status(result.statusCode).send(result.body);
  };
}

/**
 * Fastify plugin for Fireflies webhooks.
 *
 * Automatically sets up the route and raw body parser.
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { firefliesWebhook } from 'fireflies-api/fastify';
 *
 * const fastify = Fastify();
 *
 * fastify.register(firefliesWebhook, {
 *   path: '/webhooks/fireflies',
 *   secret: process.env.WEBHOOK_SECRET!,
 *   apiKey: process.env.FIREFLIES_API_KEY,
 *   onTranscriptionCompleted: async ({ payload, transcript }) => {
 *     console.log(`Transcript ready: ${transcript?.title}`);
 *   },
 * });
 * ```
 */
export const firefliesWebhook: FastifyPluginCallback<FastifyWebhookOptions> = (
  fastify: FastifyInstance,
  options: FastifyWebhookOptions,
  done: (err?: Error) => void
) => {
  validateOptions(options);

  const { path = '/webhooks/fireflies', ...webhookOptions } = options;

  // Add raw body content type parser for this plugin's routes
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body);
  });

  // Register the webhook route
  fastify.post(path, createWebhookHandler(webhookOptions));

  done();
};
