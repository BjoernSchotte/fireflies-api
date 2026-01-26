import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { FirefliesClient } from '../../src/client.js';
import listFixture from '../fixtures/users/list.json';
import meFixture from '../fixtures/users/me.json';

const API_URL = 'https://api.fireflies.ai/graphql';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createClient(apiKey = 'test-api-key'): FirefliesClient {
  return new FirefliesClient({ apiKey });
}

describe('users.me', () => {
  it('returns current user', async () => {
    server.use(
      http.post(API_URL, () => {
        return HttpResponse.json(meFixture);
      })
    );

    const client = createClient();
    const user = await client.users.me();

    expect(user.user_id).toBe('user-123');
    expect(user.email).toBe('john@example.com');
    expect(user.name).toBe('John Doe');
    expect(user.is_admin).toBe(true);
    expect(user.user_groups).toHaveLength(1);
    expect(user.user_groups?.[0]?.members).toHaveLength(2);
  });
});

describe('users.get', () => {
  it('returns user by ID', async () => {
    let receivedVariables: Record<string, unknown> = {};

    server.use(
      http.post(API_URL, async ({ request }) => {
        const body = (await request.json()) as { variables: Record<string, unknown> };
        receivedVariables = body.variables;
        return HttpResponse.json(meFixture);
      })
    );

    const client = createClient();
    const user = await client.users.get('user-123');

    expect(receivedVariables.userId).toBe('user-123');
    expect(user.email).toBe('john@example.com');
  });
});

describe('users.list', () => {
  it('returns list of team users', async () => {
    server.use(
      http.post(API_URL, () => {
        return HttpResponse.json(listFixture);
      })
    );

    const client = createClient();
    const users = await client.users.list();

    expect(users).toHaveLength(2);
    expect(users[0]?.user_id).toBe('user-123');
    expect(users[0]?.is_admin).toBe(true);
    expect(users[1]?.user_id).toBe('user-456');
    expect(users[1]?.is_admin).toBe(false);
  });
});

describe('users.setRole', () => {
  it('updates user role', async () => {
    let receivedVariables: Record<string, unknown> = {};

    server.use(
      http.post(API_URL, async ({ request }) => {
        const body = (await request.json()) as { variables: Record<string, unknown> };
        receivedVariables = body.variables;
        return HttpResponse.json({
          data: {
            setUserRole: {
              id: 'user-456',
              name: 'Jane Smith',
              email: 'jane@example.com',
              role: 'admin',
            },
          },
        });
      })
    );

    const client = createClient();
    const user = await client.users.setRole('user-456', 'admin');

    expect(receivedVariables.userId).toBe('user-456');
    expect(receivedVariables.role).toBe('admin');
    expect(user.role).toBe('admin');
  });
});
