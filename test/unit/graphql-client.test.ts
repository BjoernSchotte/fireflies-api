import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  AuthenticationError,
  FirefliesError,
  GraphQLError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
} from '../../src/errors.js';
import { GraphQLClient } from '../../src/graphql/client.js';

const API_URL = 'https://api.fireflies.ai/graphql';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('GraphQLClient', () => {
  describe('constructor', () => {
    it('throws if API key is missing', () => {
      expect(() => new GraphQLClient({ apiKey: '' })).toThrow(FirefliesError);
      expect(() => new GraphQLClient({ apiKey: '' })).toThrow('API key is required');
    });

    it('accepts valid config', () => {
      const client = new GraphQLClient({ apiKey: 'test-key' });
      expect(client).toBeInstanceOf(GraphQLClient);
    });

    it('uses custom base URL', async () => {
      const customUrl = 'https://custom.api.com/graphql';
      server.use(
        http.post(customUrl, () => {
          return HttpResponse.json({ data: { result: 'ok' } });
        })
      );

      const client = new GraphQLClient({ apiKey: 'test-key', baseUrl: customUrl });
      const result = await client.execute<{ result: string }>('query {}');

      expect(result).toEqual({ result: 'ok' });
    });
  });

  describe('execute', () => {
    it('returns data on success', async () => {
      server.use(
        http.post(API_URL, () => {
          return HttpResponse.json({ data: { user: { id: '123', name: 'Test' } } });
        })
      );

      const client = new GraphQLClient({ apiKey: 'test-key' });
      const result = await client.execute<{ user: { id: string; name: string } }>('query {}');

      expect(result).toEqual({ user: { id: '123', name: 'Test' } });
    });

    it('sends authorization header', async () => {
      let authHeader: string | null = null;

      server.use(
        http.post(API_URL, ({ request }) => {
          authHeader = request.headers.get('Authorization');
          return HttpResponse.json({ data: {} });
        })
      );

      const client = new GraphQLClient({ apiKey: 'my-secret-key' });
      await client.execute('query {}');

      expect(authHeader).toBe('Bearer my-secret-key');
    });

    it('sends query and variables in body', async () => {
      let requestBody: { query: string; variables: Record<string, unknown> } | null = null;

      server.use(
        http.post(API_URL, async ({ request }) => {
          requestBody = (await request.json()) as typeof requestBody;
          return HttpResponse.json({ data: {} });
        })
      );

      const client = new GraphQLClient({ apiKey: 'test-key' });
      await client.execute('query GetUser($id: ID!) { user(id: $id) { name } }', { id: '123' });

      expect(requestBody?.query).toBe('query GetUser($id: ID!) { user(id: $id) { name } }');
      expect(requestBody?.variables).toEqual({ id: '123' });
    });

    it('throws FirefliesError when data is missing', async () => {
      server.use(
        http.post(API_URL, () => {
          return HttpResponse.json({});
        })
      );

      const client = new GraphQLClient({ apiKey: 'test-key' });

      await expect(client.execute('query {}')).rejects.toThrow(FirefliesError);
      await expect(client.execute('query {}')).rejects.toThrow('missing data field');
    });
  });

  describe('HTTP error handling', () => {
    it('throws AuthenticationError on 401', async () => {
      server.use(
        http.post(API_URL, () => {
          return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
        })
      );

      const client = new GraphQLClient({ apiKey: 'bad-key' });

      await expect(client.execute('query {}')).rejects.toThrow(AuthenticationError);
    });

    it('throws NotFoundError on 404', async () => {
      server.use(
        http.post(API_URL, () => {
          return HttpResponse.json({ message: 'Not found' }, { status: 404 });
        })
      );

      const client = new GraphQLClient({ apiKey: 'test-key' });

      await expect(client.execute('query {}')).rejects.toThrow(NotFoundError);
    });

    it('throws FirefliesError on 500 with message from body', async () => {
      server.use(
        http.post(API_URL, () => {
          return HttpResponse.json({ error: 'Internal server error' }, { status: 500 });
        })
      );

      const client = new GraphQLClient({ apiKey: 'test-key' });

      await expect(client.execute('query {}')).rejects.toThrow('Internal server error');
    });

    it('handles non-JSON error responses', async () => {
      server.use(
        http.post(API_URL, () => {
          return new HttpResponse('Bad Gateway', { status: 502 });
        })
      );

      const client = new GraphQLClient({ apiKey: 'test-key' });

      await expect(client.execute('query {}')).rejects.toThrow(FirefliesError);
    });
  });

  describe('GraphQL error handling', () => {
    it('throws GraphQLError for generic errors', async () => {
      server.use(
        http.post(API_URL, () => {
          return HttpResponse.json({
            errors: [{ message: 'Query complexity too high' }],
          });
        })
      );

      const client = new GraphQLClient({ apiKey: 'test-key' });

      await expect(client.execute('query {}')).rejects.toThrow(GraphQLError);
      await expect(client.execute('query {}')).rejects.toThrow('Query complexity too high');
    });

    it('throws AuthenticationError for unauthorized GraphQL errors', async () => {
      server.use(
        http.post(API_URL, () => {
          return HttpResponse.json({
            errors: [{ message: 'Unauthorized access' }],
          });
        })
      );

      const client = new GraphQLClient({ apiKey: 'test-key' });

      await expect(client.execute('query {}')).rejects.toThrow(AuthenticationError);
    });

    it('throws AuthenticationError for authentication GraphQL errors', async () => {
      server.use(
        http.post(API_URL, () => {
          return HttpResponse.json({
            errors: [{ message: 'Authentication required' }],
          });
        })
      );

      const client = new GraphQLClient({ apiKey: 'test-key' });

      await expect(client.execute('query {}')).rejects.toThrow(AuthenticationError);
    });

    it('throws NotFoundError for not found GraphQL errors', async () => {
      server.use(
        http.post(API_URL, () => {
          return HttpResponse.json({
            errors: [{ message: 'Resource not found' }],
          });
        })
      );

      const client = new GraphQLClient({ apiKey: 'test-key' });

      await expect(client.execute('query {}')).rejects.toThrow(NotFoundError);
    });

    it('includes all errors in GraphQLError', async () => {
      server.use(
        http.post(API_URL, () => {
          return HttpResponse.json({
            errors: [
              { message: 'Error 1', path: ['field1'] },
              { message: 'Error 2', path: ['field2'] },
            ],
          });
        })
      );

      const client = new GraphQLClient({ apiKey: 'test-key' });

      try {
        await client.execute('query {}');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError);
        expect((error as GraphQLError).errors).toHaveLength(2);
      }
    });

    it('handles empty errors array', async () => {
      server.use(
        http.post(API_URL, () => {
          return HttpResponse.json({ errors: [] });
        })
      );

      const client = new GraphQLClient({ apiKey: 'test-key' });

      // Empty errors array means no data, so should throw
      await expect(client.execute('query {}')).rejects.toThrow(FirefliesError);
    });
  });

  describe('timeout handling', () => {
    it('throws TimeoutError when request times out', async () => {
      server.use(
        http.post(API_URL, async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return HttpResponse.json({ data: {} });
        })
      );

      // Disable retries to test timeout directly
      const client = new GraphQLClient({
        apiKey: 'test-key',
        timeout: 50,
        retry: { maxRetries: 0 },
      });

      await expect(client.execute('query {}')).rejects.toThrow(TimeoutError);
      await expect(client.execute('query {}')).rejects.toThrow('timed out');
    });
  });

  describe('network error handling', () => {
    it('throws NetworkError on fetch failure', async () => {
      server.use(
        http.post(API_URL, () => {
          return HttpResponse.error();
        })
      );

      const client = new GraphQLClient({ apiKey: 'test-key' });

      await expect(client.execute('query {}')).rejects.toThrow(NetworkError);
    });
  });

  describe('retry configuration', () => {
    it('uses custom retry options', async () => {
      let callCount = 0;

      server.use(
        http.post(API_URL, () => {
          callCount++;
          if (callCount < 3) {
            return HttpResponse.json({ error: 'Server error' }, { status: 503 });
          }
          return HttpResponse.json({ data: { success: true } });
        })
      );

      const client = new GraphQLClient({
        apiKey: 'test-key',
        retry: { maxRetries: 3, baseDelay: 1 },
      });

      const result = await client.execute<{ success: boolean }>('query {}');

      expect(result).toEqual({ success: true });
      expect(callCount).toBe(3);
    });
  });

  describe('rate limit tracking', () => {
    it('captures rate limit headers and invokes onUpdate callback', async () => {
      server.use(
        http.post(API_URL, () => {
          return HttpResponse.json(
            { data: { user: { id: '1' } } },
            {
              headers: {
                'x-ratelimit-remaining-api': '59',
                'x-ratelimit-limit-api': '60',
                'x-ratelimit-reset-api': '45',
              },
            }
          );
        })
      );

      const onUpdate = vi.fn();
      const client = new GraphQLClient({
        apiKey: 'test-key',
        rateLimit: { onUpdate },
      });

      await client.execute('query {}');

      expect(onUpdate).toHaveBeenCalledTimes(1);
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          remaining: 59,
          limit: 60,
          resetInSeconds: 45,
        })
      );
    });

    it('exposes rate limit state via rateLimitState getter', async () => {
      server.use(
        http.post(API_URL, () => {
          return HttpResponse.json(
            { data: {} },
            {
              headers: {
                'x-ratelimit-remaining-api': '42',
                'x-ratelimit-limit-api': '60',
              },
            }
          );
        })
      );

      const client = new GraphQLClient({
        apiKey: 'test-key',
        rateLimit: {},
      });

      expect(client.rateLimitState).toEqual(
        expect.objectContaining({
          remaining: undefined,
          updatedAt: 0,
        })
      );

      await client.execute('query {}');

      expect(client.rateLimitState?.remaining).toBe(42);
      expect(client.rateLimitState?.limit).toBe(60);
    });

    it('invokes onWarning when remaining falls below threshold', async () => {
      server.use(
        http.post(API_URL, () => {
          return HttpResponse.json({ data: {} }, { headers: { 'x-ratelimit-remaining-api': '5' } });
        })
      );

      const onWarning = vi.fn();
      const client = new GraphQLClient({
        apiKey: 'test-key',
        rateLimit: { onWarning, warningThreshold: 10 },
      });

      await client.execute('query {}');

      expect(onWarning).toHaveBeenCalledTimes(1);
      expect(onWarning).toHaveBeenCalledWith(expect.objectContaining({ remaining: 5 }));
    });

    it('does not invoke onWarning when remaining is above threshold', async () => {
      server.use(
        http.post(API_URL, () => {
          return HttpResponse.json(
            { data: {} },
            { headers: { 'x-ratelimit-remaining-api': '15' } }
          );
        })
      );

      const onWarning = vi.fn();
      const client = new GraphQLClient({
        apiKey: 'test-key',
        rateLimit: { onWarning, warningThreshold: 10 },
      });

      await client.execute('query {}');

      expect(onWarning).not.toHaveBeenCalled();
    });

    it('invokes onWarning again when remaining drops further below threshold', async () => {
      let remaining = 8;
      server.use(
        http.post(API_URL, () => {
          const current = remaining;
          remaining -= 2; // Simulate dropping: 8 -> 6 -> 4
          return HttpResponse.json(
            { data: {} },
            { headers: { 'x-ratelimit-remaining-api': String(current) } }
          );
        })
      );

      const onWarning = vi.fn();
      const client = new GraphQLClient({
        apiKey: 'test-key',
        rateLimit: { onWarning, warningThreshold: 10 },
      });

      await client.execute('query {}'); // remaining=8, warns
      await client.execute('query {}'); // remaining=6, warns again (dropped from 8)
      await client.execute('query {}'); // remaining=4, warns again (dropped from 6)

      expect(onWarning).toHaveBeenCalledTimes(3);
    });

    it('does not invoke onWarning when remaining stays at same level', async () => {
      server.use(
        http.post(API_URL, () => {
          return HttpResponse.json({ data: {} }, { headers: { 'x-ratelimit-remaining-api': '5' } });
        })
      );

      const onWarning = vi.fn();
      const client = new GraphQLClient({
        apiKey: 'test-key',
        rateLimit: { onWarning, warningThreshold: 10 },
      });

      await client.execute('query {}'); // remaining=5, warns (first time below threshold)
      await client.execute('query {}'); // remaining=5 again, should NOT warn
      await client.execute('query {}'); // remaining=5 again, should NOT warn

      expect(onWarning).toHaveBeenCalledTimes(1);
    });

    it('invokes onRateLimited on 429 response', async () => {
      server.use(
        http.post(API_URL, () => {
          return HttpResponse.json(
            { error: 'Rate limited' },
            {
              status: 429,
              headers: {
                'retry-after': '30',
                'x-ratelimit-remaining-api': '0',
              },
            }
          );
        })
      );

      const onRateLimited = vi.fn();
      const client = new GraphQLClient({
        apiKey: 'test-key',
        rateLimit: { onRateLimited },
        retry: { maxRetries: 0 },
      });

      await expect(client.execute('query {}')).rejects.toThrow(RateLimitError);
      expect(onRateLimited).toHaveBeenCalledTimes(1);
      expect(onRateLimited).toHaveBeenCalledWith(expect.objectContaining({ remaining: 0 }), 30);
    });

    it('returns undefined for rateLimitState when not configured', () => {
      const client = new GraphQLClient({ apiKey: 'test-key' });
      expect(client.rateLimitState).toBeUndefined();
    });

    it('catches callback errors without breaking the SDK', async () => {
      server.use(
        http.post(API_URL, () => {
          return HttpResponse.json(
            { data: { result: 'ok' } },
            { headers: { 'x-ratelimit-remaining-api': '50' } }
          );
        })
      );

      const throwingCallback = () => {
        throw new Error('User callback error');
      };
      const client = new GraphQLClient({
        apiKey: 'test-key',
        rateLimit: { onUpdate: throwingCallback },
      });

      // Should not throw despite callback error
      const result = await client.execute<{ result: string }>('query {}');
      expect(result).toEqual({ result: 'ok' });
    });
  });
});
