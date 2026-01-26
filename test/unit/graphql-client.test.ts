import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  AuthenticationError,
  FirefliesError,
  GraphQLError,
  NetworkError,
  NotFoundError,
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
});
