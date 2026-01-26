import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { FirefliesClient } from '../../src/client.js';
import {
  findExternalParticipantQuestions,
  getMeetingVideos,
  type TranscriptWithVideo,
} from '../../src/index.js';
import getWithQuestionsFixture from '../fixtures/transcripts/get-with-questions.json';

const API_URL = 'https://api.fireflies.ai/graphql';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createClient(apiKey = 'test-api-key'): FirefliesClient {
  return new FirefliesClient({ apiKey });
}

describe('findExternalParticipantQuestions', () => {
  it('finds questions from external participants in a sales call', async () => {
    server.use(
      http.post(API_URL, () => {
        return HttpResponse.json(getWithQuestionsFixture);
      })
    );

    const client = createClient();
    const transcript = await client.transcripts.get('transcript-with-questions');
    const result = findExternalParticipantQuestions(transcript, '@internal.com');

    // Should find 3 questions from Client Contact (external)
    // Questions from Sales Rep (internal) should be excluded
    expect(result.totalQuestions).toBe(3);
    expect(result.externalParticipants).toHaveLength(1);
    expect(result.externalParticipants[0].name).toBe('Client Contact');
    expect(result.externalParticipants[0].email).toBe('client@external.com');

    // Verify question details
    expect(result.questions[0].text).toBe('What pricing tiers do you offer?');
    expect(result.questions[0].speakerName).toBe('Client Contact');
    expect(result.questions[0].speakerEmail).toBe('client@external.com');
    expect(result.questions[0].sentenceIndex).toBe(1);

    expect(result.questions[1].text).toBe('How long does implementation typically take?');
    expect(result.questions[2].text).toBe('Can you provide customer references?');
  });

  it('handles multiple internal domains', async () => {
    server.use(
      http.post(API_URL, () => {
        return HttpResponse.json(getWithQuestionsFixture);
      })
    );

    const client = createClient();
    const transcript = await client.transcripts.get('transcript-with-questions');

    // If we include external.com as internal, no external questions
    const result = findExternalParticipantQuestions(transcript, ['@internal.com', '@external.com']);

    expect(result.totalQuestions).toBe(0);
    expect(result.externalParticipants).toHaveLength(0);
  });
});

describe('getMeetingVideos', () => {
  it('yields only transcripts with video URLs', async () => {
    server.use(
      http.post(API_URL, () => {
        return HttpResponse.json({
          data: {
            transcripts: [
              {
                id: 'transcript-1',
                title: 'Meeting 1',
                organizer_email: 'test@example.com',
                transcript_url: 'https://app.fireflies.ai/view/1',
                participants: [],
                duration: 1800,
                dateString: '2024-01-15T10:00:00.000Z',
                date: 1705312800000,
                video_url: 'https://storage.example.com/video/1.mp4',
              },
              {
                id: 'transcript-2',
                title: 'Meeting 2 (no video)',
                organizer_email: 'test@example.com',
                transcript_url: 'https://app.fireflies.ai/view/2',
                participants: [],
                duration: 1800,
                dateString: '2024-01-16T10:00:00.000Z',
                date: 1705399200000,
                video_url: null,
              },
              {
                id: 'transcript-3',
                title: 'Meeting 3',
                organizer_email: 'test@example.com',
                transcript_url: 'https://app.fireflies.ai/view/3',
                participants: [],
                duration: 1800,
                dateString: '2024-01-17T10:00:00.000Z',
                date: 1705485600000,
                video_url: 'https://storage.example.com/video/3.mp4',
              },
            ],
          },
        });
      })
    );

    const client = createClient();
    const results: TranscriptWithVideo[] = [];

    for await (const item of getMeetingVideos(client)) {
      results.push(item);
    }

    expect(results).toHaveLength(2);
    expect(results[0].transcript.id).toBe('transcript-1');
    expect(results[0].videoUrl).toBe('https://storage.example.com/video/1.mp4');
    expect(results[1].transcript.id).toBe('transcript-3');
    expect(results[1].videoUrl).toBe('https://storage.example.com/video/3.mp4');
  });

  it('passes filter options through', async () => {
    let receivedVariables: Record<string, unknown> = {};

    server.use(
      http.post(API_URL, async ({ request }) => {
        const body = (await request.json()) as { variables: Record<string, unknown> };
        receivedVariables = body.variables;
        return HttpResponse.json({
          data: {
            transcripts: [],
          },
        });
      })
    );

    const client = createClient();
    const results = [];

    for await (const item of getMeetingVideos(client, {
      fromDate: '2024-01-01',
      mine: true,
    })) {
      results.push(item);
    }

    expect(receivedVariables.fromDate).toBe('2024-01-01');
    expect(receivedVariables.mine).toBe(true);
  });
});

describe('integration: external questions with real transcript structure', () => {
  it('correctly maps speaker names to attendees', async () => {
    server.use(
      http.post(API_URL, () => {
        return HttpResponse.json({
          data: {
            transcript: {
              id: 'name-mapping-test',
              title: 'Name Mapping Test',
              organizer_email: 'host@company.com',
              transcript_url: 'https://app.fireflies.ai/view/test',
              participants: ['host@company.com', 'guest@other.org'],
              meeting_attendees: [
                {
                  displayName: 'John Doe',
                  email: 'host@company.com',
                  name: 'John D.',
                },
                {
                  displayName: 'Jane Smith',
                  email: 'guest@other.org',
                  name: 'Jane S.',
                },
              ],
              meeting_attendance: [],
              fireflies_users: [],
              workspace_users: [],
              duration: 1800,
              dateString: '2024-01-20T10:00:00.000Z',
              date: 1705744800000,
              sentences: [
                {
                  index: 0,
                  text: 'What is your timeline?',
                  raw_text: 'What is your timeline?',
                  start_time: '10.0',
                  end_time: '12.0',
                  speaker_id: 'speaker-1',
                  speaker_name: 'Jane Smith',
                  ai_filters: {
                    question: 'What is your timeline?',
                  },
                },
              ],
              speakers: [{ id: 'speaker-1', name: 'Jane Smith' }],
              channels: [],
            },
          },
        });
      })
    );

    const client = createClient();
    const transcript = await client.transcripts.get('name-mapping-test');
    const result = findExternalParticipantQuestions(transcript, '@company.com');

    expect(result.totalQuestions).toBe(1);
    expect(result.questions[0].speakerEmail).toBe('guest@other.org');
  });
});
