import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { FirefliesClient } from '../../src/client.js';
import getFixture from '../fixtures/bites/get.json';
import listFixture from '../fixtures/bites/list.json';

const API_URL = 'https://api.fireflies.ai/graphql';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createClient(apiKey = 'test-api-key'): FirefliesClient {
  return new FirefliesClient({ apiKey });
}

describe('bites.get', () => {
  it('returns bite by ID', async () => {
    let receivedVariables: Record<string, unknown> = {};

    server.use(
      http.post(API_URL, async ({ request }) => {
        const body = (await request.json()) as { variables: Record<string, unknown> };
        receivedVariables = body.variables;
        return HttpResponse.json(getFixture);
      })
    );

    const client = createClient();
    const bite = await client.bites.get('bite-1');

    expect(receivedVariables.biteId).toBe('bite-1');
    expect(bite.id).toBe('bite-1');
    expect(bite.name).toBe('Key Discussion Point');
    expect(bite.captions).toHaveLength(2);
    expect(bite.user?.name).toBe('John Doe');
    expect(bite.created_from?.type).toBe('transcript');
  });
});

describe('bites.list', () => {
  it('returns list of bites', async () => {
    server.use(
      http.post(API_URL, () => {
        return HttpResponse.json(listFixture);
      })
    );

    const client = createClient();
    const bites = await client.bites.list({ mine: true });

    expect(bites).toHaveLength(2);
    expect(bites[0]?.id).toBe('bite-1');
    expect(bites[0]?.name).toBe('Key Discussion Point');
    expect(bites[1]?.id).toBe('bite-2');
  });

  it('passes filter parameters', async () => {
    let receivedVariables: Record<string, unknown> = {};

    server.use(
      http.post(API_URL, async ({ request }) => {
        const body = (await request.json()) as { variables: Record<string, unknown> };
        receivedVariables = body.variables;
        return HttpResponse.json(listFixture);
      })
    );

    const client = createClient();
    await client.bites.list({
      transcript_id: 'transcript-abc',
      mine: true,
      limit: 10,
    });

    expect(receivedVariables.transcriptId).toBe('transcript-abc');
    expect(receivedVariables.mine).toBe(true);
    expect(receivedVariables.limit).toBe(10);
  });
});

describe('bites.listAll', () => {
  it('iterates through all pages', async () => {
    let callCount = 0;

    server.use(
      http.post(API_URL, async ({ request }) => {
        callCount++;
        const body = (await request.json()) as { variables: { skip?: number } };
        const skip = body.variables.skip ?? 0;

        if (skip === 0) {
          return HttpResponse.json({
            data: {
              bites: Array.from({ length: 50 }, (_, i) => ({
                id: `bite-${i}`,
                transcript_id: 'transcript-abc',
                user_id: 'user-123',
                name: `Bite ${i}`,
                status: 'ready',
                media_type: 'audio',
                start_time: i * 60,
                end_time: i * 60 + 30,
                created_at: '2024-01-15T12:00:00.000Z',
                captions: [],
                sources: [],
              })),
            },
          });
        } else {
          return HttpResponse.json({
            data: {
              bites: Array.from({ length: 5 }, (_, i) => ({
                id: `bite-${50 + i}`,
                transcript_id: 'transcript-abc',
                user_id: 'user-123',
                name: `Bite ${50 + i}`,
                status: 'ready',
                media_type: 'audio',
                start_time: (50 + i) * 60,
                end_time: (50 + i) * 60 + 30,
                created_at: '2024-01-15T12:00:00.000Z',
                captions: [],
                sources: [],
              })),
            },
          });
        }
      })
    );

    const client = createClient();
    const bites: { id: string }[] = [];

    for await (const bite of client.bites.listAll({ mine: true })) {
      bites.push(bite);
    }

    expect(bites).toHaveLength(55);
    expect(callCount).toBe(2);
  });
});

describe('bites.create', () => {
  it('creates a new bite', async () => {
    let receivedVariables: Record<string, unknown> = {};

    server.use(
      http.post(API_URL, async ({ request }) => {
        const body = (await request.json()) as { variables: Record<string, unknown> };
        receivedVariables = body.variables;
        return HttpResponse.json({
          data: {
            createBite: {
              id: 'new-bite-id',
              name: 'Important Moment',
              status: 'processing',
              summary: 'Key discussion',
            },
          },
        });
      })
    );

    const client = createClient();
    const bite = await client.bites.create({
      transcript_id: 'transcript-abc',
      start_time: 120,
      end_time: 180,
      name: 'Important Moment',
      media_type: 'audio',
      summary: 'Key discussion',
    });

    expect(receivedVariables.transcriptId).toBe('transcript-abc');
    expect(receivedVariables.startTime).toBe(120);
    expect(receivedVariables.endTime).toBe(180);
    expect(receivedVariables.name).toBe('Important Moment');
    expect(receivedVariables.mediaType).toBe('audio');
    expect(bite.id).toBe('new-bite-id');
    expect(bite.status).toBe('processing');
  });
});
