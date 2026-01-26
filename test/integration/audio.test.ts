import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { FirefliesClient } from '../../src/client.js';

const API_URL = 'https://api.fireflies.ai/graphql';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createClient(apiKey = 'test-api-key'): FirefliesClient {
  return new FirefliesClient({ apiKey });
}

describe('audio.upload', () => {
  it('uploads audio for transcription', async () => {
    let receivedVariables: Record<string, unknown> = {};

    server.use(
      http.post(API_URL, async ({ request }) => {
        const body = (await request.json()) as { variables: Record<string, unknown> };
        receivedVariables = body.variables;
        return HttpResponse.json({
          data: {
            uploadAudio: {
              success: true,
              title: 'Uploaded Recording',
              message: 'Audio is being transcribed',
            },
          },
        });
      })
    );

    const client = createClient();
    const result = await client.audio.upload({
      url: 'https://example.com/recording.mp3',
      title: 'Important Meeting',
      webhook: 'https://myapp.com/webhook',
    });

    expect(receivedVariables.input).toEqual({
      url: 'https://example.com/recording.mp3',
      title: 'Important Meeting',
      webhook: 'https://myapp.com/webhook',
    });
    expect(result.success).toBe(true);
    expect(result.title).toBe('Uploaded Recording');
    expect(result.message).toBe('Audio is being transcribed');
  });

  it('uploads with all parameters', async () => {
    let receivedVariables: Record<string, unknown> = {};

    server.use(
      http.post(API_URL, async ({ request }) => {
        const body = (await request.json()) as { variables: Record<string, unknown> };
        receivedVariables = body.variables;
        return HttpResponse.json({
          data: {
            uploadAudio: {
              success: true,
              title: 'Video Recording',
              message: 'Processing started',
            },
          },
        });
      })
    );

    const client = createClient();
    await client.audio.upload({
      url: 'https://example.com/video.mp4',
      title: 'Team Meeting',
      webhook: 'https://myapp.com/webhook',
      custom_language: 'en-US',
      save_video: true,
      attendees: [
        { displayName: 'John Doe', email: 'john@example.com' },
        { displayName: 'Jane Smith', email: 'jane@example.com' },
      ],
      client_reference_id: 'ref-123',
      bypass_size_check: false,
    });

    const input = receivedVariables.input as Record<string, unknown>;
    expect(input.url).toBe('https://example.com/video.mp4');
    expect(input.save_video).toBe(true);
    expect(input.custom_language).toBe('en-US');
    expect(input.attendees).toHaveLength(2);
    expect(input.client_reference_id).toBe('ref-123');
  });

  it('handles minimal parameters', async () => {
    let receivedVariables: Record<string, unknown> = {};

    server.use(
      http.post(API_URL, async ({ request }) => {
        const body = (await request.json()) as { variables: Record<string, unknown> };
        receivedVariables = body.variables;
        return HttpResponse.json({
          data: {
            uploadAudio: {
              success: true,
              title: 'recording.mp3',
              message: 'Processing',
            },
          },
        });
      })
    );

    const client = createClient();
    await client.audio.upload({
      url: 'https://example.com/recording.mp3',
    });

    const input = receivedVariables.input as Record<string, unknown>;
    expect(input.url).toBe('https://example.com/recording.mp3');
    expect(input.title).toBeUndefined();
    expect(input.webhook).toBeUndefined();
  });
});
