/**
 * Script to record API fixtures from the real Fireflies API.
 *
 * Usage:
 *   FIREFLIES_API_KEY=your-key npx tsx scripts/record-fixtures.ts
 *
 * This will:
 * 1. Call the real Fireflies API
 * 2. Save responses to test/fixtures/
 * 3. Redact sensitive data (emails, names, etc.)
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const API_URL = 'https://api.fireflies.ai/graphql';
const FIXTURES_DIR = join(import.meta.dirname, '../test/fixtures');

interface GraphQLResponse {
  data?: unknown;
  errors?: Array<{ message: string }>;
}

async function graphqlRequest(
  query: string,
  variables?: Record<string, unknown>
): Promise<GraphQLResponse> {
  const apiKey = process.env['FIREFLIES_API_KEY'];
  if (!apiKey) {
    throw new Error('FIREFLIES_API_KEY environment variable is required');
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<GraphQLResponse>;
}

function redactEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return 'redacted@example.com';
  return `${local.slice(0, 2)}***@${domain}`;
}

function redactString(str: string, replacement: string): string {
  return str ? replacement : str;
}

function redactTranscript(transcript: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...transcript };

  if (typeof redacted['organizer_email'] === 'string') {
    redacted['organizer_email'] = redactEmail(redacted['organizer_email']);
  }
  if (typeof redacted['host_email'] === 'string') {
    redacted['host_email'] = redactEmail(redacted['host_email']);
  }
  if (Array.isArray(redacted['participants'])) {
    redacted['participants'] = (redacted['participants'] as string[]).map(redactEmail);
  }
  if (Array.isArray(redacted['fireflies_users'])) {
    redacted['fireflies_users'] = (redacted['fireflies_users'] as string[]).map(
      (_, i) => `user-${i + 1}`
    );
  }
  if (Array.isArray(redacted['meeting_attendees'])) {
    redacted['meeting_attendees'] = (
      redacted['meeting_attendees'] as Array<Record<string, unknown>>
    ).map((attendee, i) => ({
      ...attendee,
      email: `attendee${i + 1}@example.com`,
      displayName: `Attendee ${i + 1}`,
      name: `Attendee ${i + 1}`,
    }));
  }
  if (typeof redacted['audio_url'] === 'string') {
    redacted['audio_url'] = 'https://storage.example.com/redacted-audio.mp3';
  }
  if (typeof redacted['video_url'] === 'string') {
    redacted['video_url'] = 'https://storage.example.com/redacted-video.mp4';
  }
  if (typeof redacted['meeting_link'] === 'string') {
    redacted['meeting_link'] = 'https://meet.example.com/redacted';
  }

  return redacted;
}

async function recordListFixture(): Promise<void> {
  console.log('Recording transcripts list fixture...');

  const query = `
    query ListTranscripts($limit: Int) {
      transcripts(limit: $limit) {
        id
        title
        organizer_email
        transcript_url
        participants
        duration
        dateString
        date
        meeting_info {
          fred_joined
          silent_meeting
          summary_status
        }
      }
    }
  `;

  const response = await graphqlRequest(query, { limit: 5 });

  if (response.errors) {
    console.error('GraphQL errors:', response.errors);
    return;
  }

  const data = response.data as { transcripts: Array<Record<string, unknown>> };
  const redacted = {
    data: {
      transcripts: data.transcripts.map(redactTranscript),
    },
  };

  await mkdir(join(FIXTURES_DIR, 'transcripts'), { recursive: true });
  await writeFile(join(FIXTURES_DIR, 'transcripts/list.json'), JSON.stringify(redacted, null, 2));

  console.log(`Recorded ${data.transcripts.length} transcripts to list.json`);
}

async function recordGetFixture(): Promise<void> {
  console.log('Recording transcript get fixture...');

  // First get the list to find a transcript ID
  const listQuery = `
    query ListTranscripts($limit: Int) {
      transcripts(limit: $limit) {
        id
      }
    }
  `;

  const listResponse = await graphqlRequest(listQuery, { limit: 1 });
  const listData = listResponse.data as { transcripts: Array<{ id: string }> };

  if (!listData.transcripts[0]) {
    console.error('No transcripts found to record');
    return;
  }

  const transcriptId = listData.transcripts[0].id;
  console.log(`Using transcript ID: ${transcriptId}`);

  const getQuery = `
    query GetTranscript($id: String!) {
      transcript(id: $id) {
        id
        title
        organizer_email
        host_email
        user {
          user_id
          email
          name
        }
        speakers {
          id
          name
        }
        transcript_url
        participants
        meeting_attendees {
          displayName
          email
          phoneNumber
          name
          location
        }
        meeting_attendance {
          name
          join_time
          leave_time
        }
        fireflies_users
        workspace_users
        duration
        dateString
        date
        audio_url
        video_url
        sentences {
          index
          text
          raw_text
          start_time
          end_time
          speaker_id
          speaker_name
          ai_filters {
            task
            pricing
            metric
            question
            date_and_time
            text_cleanup
            sentiment
          }
        }
        calendar_id
        summary {
          action_items
          keywords
          outline
          overview
          shorthand_bullet
          notes
          gist
          bullet_gist
          short_summary
          short_overview
          meeting_type
          topics_discussed
          transcript_chapters
        }
        meeting_info {
          fred_joined
          silent_meeting
          summary_status
        }
        cal_id
        calendar_type
        apps_preview {
          outputs {
            app_id
            app_name
            content
            created_at
          }
        }
        meeting_link
        channels {
          id
          title
          is_private
          created_at
          updated_at
          created_by
        }
      }
    }
  `;

  const response = await graphqlRequest(getQuery, { id: transcriptId });

  if (response.errors) {
    console.error('GraphQL errors:', response.errors);
    return;
  }

  const data = response.data as { transcript: Record<string, unknown> };
  const redacted = {
    data: {
      transcript: redactTranscript(data.transcript),
    },
  };

  await writeFile(join(FIXTURES_DIR, 'transcripts/get.json'), JSON.stringify(redacted, null, 2));

  console.log('Recorded transcript to get.json');
}

async function main(): Promise<void> {
  try {
    await recordListFixture();
    await recordGetFixture();
    console.log('\nFixtures recorded successfully!');
  } catch (error) {
    console.error('Failed to record fixtures:', error);
    process.exit(1);
  }
}

main();
