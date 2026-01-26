import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { FirefliesClient } from '../../src/client.js';
import listFixture from '../fixtures/ai-apps/list.json';

const API_URL = 'https://api.fireflies.ai/graphql';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createClient(apiKey = 'test-api-key'): FirefliesClient {
  return new FirefliesClient({ apiKey });
}

describe('aiApps.list', () => {
  it('returns list of AI App outputs', async () => {
    server.use(
      http.post(API_URL, () => {
        return HttpResponse.json(listFixture);
      })
    );

    const client = createClient();
    const outputs = await client.aiApps.list();

    expect(outputs).toHaveLength(2);
    expect(outputs[0]?.app_id).toBe('app-summary');
    expect(outputs[0]?.title).toBe('Meeting Summary');
    expect(outputs[1]?.app_id).toBe('app-action-items');
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
    await client.aiApps.list({
      transcript_id: 'transcript-abc',
      app_id: 'app-summary',
      limit: 5,
    });

    expect(receivedVariables.transcriptId).toBe('transcript-abc');
    expect(receivedVariables.appId).toBe('app-summary');
    expect(receivedVariables.limit).toBe(5);
  });

  it('handles empty results', async () => {
    server.use(
      http.post(API_URL, () => {
        return HttpResponse.json({ data: { apps: { outputs: [] } } });
      })
    );

    const client = createClient();
    const outputs = await client.aiApps.list();

    expect(outputs).toHaveLength(0);
  });
});

describe('aiApps.listAll', () => {
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
              apps: {
                outputs: Array.from({ length: 10 }, (_, i) => ({
                  transcript_id: 'transcript-abc',
                  user_id: 'user-123',
                  app_id: `app-${i}`,
                  created_at: '2024-01-15T12:00:00.000Z',
                  title: `App ${i}`,
                  prompt: 'Test prompt',
                  response: 'Test response',
                })),
              },
            },
          });
        } else {
          return HttpResponse.json({
            data: {
              apps: {
                outputs: Array.from({ length: 3 }, (_, i) => ({
                  transcript_id: 'transcript-abc',
                  user_id: 'user-123',
                  app_id: `app-${10 + i}`,
                  created_at: '2024-01-15T12:00:00.000Z',
                  title: `App ${10 + i}`,
                  prompt: 'Test prompt',
                  response: 'Test response',
                })),
              },
            },
          });
        }
      })
    );

    const client = createClient();
    const outputs: { app_id: string }[] = [];

    for await (const output of client.aiApps.listAll({ transcript_id: 'transcript-abc' })) {
      outputs.push(output);
    }

    expect(outputs).toHaveLength(13);
    expect(callCount).toBe(2);
  });
});
