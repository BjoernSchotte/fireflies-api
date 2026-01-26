import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { FirefliesClient } from '../../src/client.js';
import { AuthenticationError, GraphQLError, NotFoundError } from '../../src/errors.js';
import getFixture from '../fixtures/transcripts/get.json';
import listFixture from '../fixtures/transcripts/list.json';

const API_URL = 'https://api.fireflies.ai/graphql';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createClient(apiKey = 'test-api-key'): FirefliesClient {
  return new FirefliesClient({ apiKey });
}

describe('transcripts.list', () => {
  it('returns list of transcripts', async () => {
    server.use(
      http.post(API_URL, () => {
        return HttpResponse.json(listFixture);
      })
    );

    const client = createClient();
    const transcripts = await client.transcripts.list();

    expect(transcripts).toHaveLength(2);
    expect(transcripts[0]?.id).toBe('transcript-1');
    expect(transcripts[0]?.title).toBe('Weekly Team Standup');
    expect(transcripts[1]?.id).toBe('transcript-2');
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
    await client.transcripts.list({
      keyword: 'standup',
      scope: 'title',
      mine: true,
      limit: 10,
    });

    expect(receivedVariables['keyword']).toBe('standup');
    expect(receivedVariables['scope']).toBe('title');
    expect(receivedVariables['mine']).toBe(true);
    expect(receivedVariables['limit']).toBe(10);
  });

  it('handles empty results', async () => {
    server.use(
      http.post(API_URL, () => {
        return HttpResponse.json({ data: { transcripts: [] } });
      })
    );

    const client = createClient();
    const transcripts = await client.transcripts.list();

    expect(transcripts).toHaveLength(0);
  });
});

describe('transcripts.get', () => {
  it('returns full transcript', async () => {
    server.use(
      http.post(API_URL, () => {
        return HttpResponse.json(getFixture);
      })
    );

    const client = createClient();
    const transcript = await client.transcripts.get('transcript-1');

    expect(transcript.id).toBe('transcript-1');
    expect(transcript.title).toBe('Weekly Team Standup');
    expect(transcript.speakers).toHaveLength(2);
    expect(transcript.sentences).toHaveLength(3);
    expect(transcript.summary?.action_items).toContain('API documentation');
    expect(transcript.meeting_attendance).toHaveLength(2);
    expect(transcript.channels).toHaveLength(1);
  });

  it('normalizes null fields to defaults', async () => {
    server.use(
      http.post(API_URL, () => {
        return HttpResponse.json({
          data: {
            transcript: {
              id: 'transcript-2',
              title: null,
              organizer_email: null,
              transcript_url: null,
              participants: null,
              speakers: null,
              duration: null,
              dateString: null,
              date: null,
              sentences: null,
              meeting_attendees: null,
              meeting_attendance: null,
              fireflies_users: null,
              workspace_users: null,
              channels: null,
            },
          },
        });
      })
    );

    const client = createClient();
    const transcript = await client.transcripts.get('transcript-2');

    expect(transcript.title).toBe('');
    expect(transcript.organizer_email).toBe('');
    expect(transcript.participants).toEqual([]);
    expect(transcript.speakers).toEqual([]);
    expect(transcript.sentences).toEqual([]);
    expect(transcript.channels).toEqual([]);
  });
});

describe('transcripts.getSummary', () => {
  it('returns summary only', async () => {
    server.use(
      http.post(API_URL, () => {
        return HttpResponse.json({
          data: {
            transcript: {
              summary: {
                action_items: '- Complete documentation',
                overview: 'Meeting overview',
                keywords: 'api, docs',
              },
            },
          },
        });
      })
    );

    const client = createClient();
    const summary = await client.transcripts.getSummary('transcript-1');

    expect(summary?.action_items).toBe('- Complete documentation');
    expect(summary?.overview).toBe('Meeting overview');
  });

  it('returns null when no summary', async () => {
    server.use(
      http.post(API_URL, () => {
        return HttpResponse.json({
          data: {
            transcript: {
              summary: null,
            },
          },
        });
      })
    );

    const client = createClient();
    const summary = await client.transcripts.getSummary('transcript-1');

    expect(summary).toBeNull();
  });
});

describe('transcripts.listAll', () => {
  it('iterates through all pages', async () => {
    let callCount = 0;

    server.use(
      http.post(API_URL, async ({ request }) => {
        callCount++;
        const body = (await request.json()) as { variables: { skip?: number } };
        const skip = body.variables.skip ?? 0;

        // First page: 50 items, second page: 10 items
        if (skip === 0) {
          return HttpResponse.json({
            data: {
              transcripts: Array.from({ length: 50 }, (_, i) => ({
                id: `transcript-${i}`,
                title: `Transcript ${i}`,
                organizer_email: 'test@example.com',
                transcript_url: `https://app.fireflies.ai/view/transcript-${i}`,
                participants: [],
                duration: 1800,
                dateString: '2024-01-15T10:00:00.000Z',
                date: 1705312800000,
                meeting_info: {
                  fred_joined: true,
                  silent_meeting: false,
                  summary_status: 'processed',
                },
              })),
            },
          });
        } else {
          return HttpResponse.json({
            data: {
              transcripts: Array.from({ length: 10 }, (_, i) => ({
                id: `transcript-${50 + i}`,
                title: `Transcript ${50 + i}`,
                organizer_email: 'test@example.com',
                transcript_url: `https://app.fireflies.ai/view/transcript-${50 + i}`,
                participants: [],
                duration: 1800,
                dateString: '2024-01-15T10:00:00.000Z',
                date: 1705312800000,
                meeting_info: {
                  fred_joined: true,
                  silent_meeting: false,
                  summary_status: 'processed',
                },
              })),
            },
          });
        }
      })
    );

    const client = createClient();
    const transcripts: { id: string }[] = [];

    for await (const t of client.transcripts.listAll()) {
      transcripts.push(t);
    }

    expect(transcripts).toHaveLength(60);
    expect(callCount).toBe(2);
    expect(transcripts[0]?.id).toBe('transcript-0');
    expect(transcripts[59]?.id).toBe('transcript-59');
  });
});

describe('error handling', () => {
  it('throws AuthenticationError on 401', async () => {
    server.use(
      http.post(API_URL, () => {
        return HttpResponse.json({ message: 'Invalid API key' }, { status: 401 });
      })
    );

    const client = createClient('invalid-key');

    await expect(client.transcripts.list()).rejects.toThrow(AuthenticationError);
  });

  it('throws NotFoundError on GraphQL not found', async () => {
    server.use(
      http.post(API_URL, () => {
        return HttpResponse.json({
          errors: [{ message: 'Transcript not found' }],
        });
      })
    );

    const client = createClient();

    await expect(client.transcripts.get('nonexistent')).rejects.toThrow(NotFoundError);
  });

  it('throws GraphQLError on other GraphQL errors', async () => {
    server.use(
      http.post(API_URL, () => {
        return HttpResponse.json({
          errors: [{ message: 'Query complexity too high' }],
        });
      })
    );

    const client = createClient();

    await expect(client.transcripts.list()).rejects.toThrow(GraphQLError);
  });
});
