import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { FirefliesClient } from '../../src/client.js';
import activeFixture from '../fixtures/meetings/active.json';

const API_URL = 'https://api.fireflies.ai/graphql';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createClient(apiKey = 'test-api-key'): FirefliesClient {
  return new FirefliesClient({ apiKey });
}

describe('meetings.active', () => {
  it('returns list of active meetings', async () => {
    server.use(
      http.post(API_URL, () => {
        return HttpResponse.json(activeFixture);
      })
    );

    const client = createClient();
    const meetings = await client.meetings.active();

    expect(meetings).toHaveLength(2);
    expect(meetings[0]?.id).toBe('meeting-1');
    expect(meetings[0]?.title).toBe('Sales Call');
    expect(meetings[0]?.state).toBe('active');
    expect(meetings[1]?.state).toBe('paused');
  });

  it('passes filter parameters', async () => {
    let receivedVariables: Record<string, unknown> = {};

    server.use(
      http.post(API_URL, async ({ request }) => {
        const body = (await request.json()) as { variables: Record<string, unknown> };
        receivedVariables = body.variables;
        return HttpResponse.json(activeFixture);
      })
    );

    const client = createClient();
    await client.meetings.active({
      email: 'john@example.com',
      states: ['active'],
    });

    expect(receivedVariables.email).toBe('john@example.com');
    expect(receivedVariables.states).toEqual(['active']);
  });

  it('handles empty results', async () => {
    server.use(
      http.post(API_URL, () => {
        return HttpResponse.json({ data: { active_meetings: [] } });
      })
    );

    const client = createClient();
    const meetings = await client.meetings.active();

    expect(meetings).toHaveLength(0);
  });
});

describe('meetings.addBot', () => {
  it('adds bot to meeting', async () => {
    let receivedVariables: Record<string, unknown> = {};

    server.use(
      http.post(API_URL, async ({ request }) => {
        const body = (await request.json()) as { variables: Record<string, unknown> };
        receivedVariables = body.variables;
        return HttpResponse.json({
          data: {
            addToLiveMeeting: {
              success: true,
            },
          },
        });
      })
    );

    const client = createClient();
    const result = await client.meetings.addBot({
      meeting_link: 'https://zoom.us/j/123456',
      title: 'Important Call',
      password: 'secret',
      duration: 60,
    });

    expect(receivedVariables.meetingLink).toBe('https://zoom.us/j/123456');
    expect(receivedVariables.title).toBe('Important Call');
    expect(receivedVariables.meetingPassword).toBe('secret');
    expect(receivedVariables.duration).toBe(60);
    expect(result.success).toBe(true);
  });

  it('handles minimal parameters', async () => {
    let receivedVariables: Record<string, unknown> = {};

    server.use(
      http.post(API_URL, async ({ request }) => {
        const body = (await request.json()) as { variables: Record<string, unknown> };
        receivedVariables = body.variables;
        return HttpResponse.json({
          data: {
            addToLiveMeeting: {
              success: true,
            },
          },
        });
      })
    );

    const client = createClient();
    await client.meetings.addBot({
      meeting_link: 'https://meet.google.com/abc-def-ghi',
    });

    expect(receivedVariables.meetingLink).toBe('https://meet.google.com/abc-def-ghi');
    expect(receivedVariables.title).toBeUndefined();
    expect(receivedVariables.meetingPassword).toBeUndefined();
  });
});
