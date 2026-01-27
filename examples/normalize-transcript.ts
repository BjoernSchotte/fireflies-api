/**
 * Example: Normalize Transcript
 *
 * Demonstrates normalizing a Fireflies transcript to a provider-agnostic format.
 * This is useful for multi-provider meeting intelligence projects where you need
 * a consistent data format across different meeting platforms.
 *
 * Usage:
 *   FIREFLIES_API_KEY=your-key npx tsx examples/normalize-transcript.ts
 */

import {
  createNormalizer,
  FirefliesClient,
  normalizeTranscript,
  type NormalizedMeeting,
} from 'fireflies-api';

const apiKey = process.env.FIREFLIES_API_KEY;

if (!apiKey) {
  console.error('Error: FIREFLIES_API_KEY environment variable is required');
  process.exit(1);
}

function printSection(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(title);
  console.log('='.repeat(60));
}

function printNormalizedMeeting(meeting: NormalizedMeeting) {
  console.log(`ID: ${meeting.id}`);
  console.log(`Title: ${meeting.title}`);
  console.log(`Date: ${meeting.date.toISOString()}`);
  console.log(`Duration: ${Math.round(meeting.duration / 60)} minutes`);
  console.log(`URL: ${meeting.url}`);
  console.log(`Provider: ${meeting.source.provider}`);
  console.log(`Original ID: ${meeting.source.originalId}`);

  console.log(`\nSpeakers (${meeting.speakers.length}):`);
  for (const speaker of meeting.speakers) {
    console.log(`  - ${speaker.name} (${speaker.id})`);
  }

  console.log(`\nParticipants (${meeting.participants.length}):`);
  for (const p of meeting.participants) {
    console.log(`  - ${p.name || p.email} [${p.role}]`);
  }

  console.log(`\nSentences: ${meeting.sentences.length} total`);
  if (meeting.sentences.length > 0) {
    console.log('First 3 sentences:');
    for (const s of meeting.sentences.slice(0, 3)) {
      const sentiment = s.sentiment ? ` [${s.sentiment}]` : '';
      const question = s.isQuestion ? ' ❓' : '';
      const action = s.isActionItem ? ' ✅' : '';
      console.log(
        `  [${s.startTime.toFixed(1)}s] ${s.speakerName}: "${s.text.slice(0, 50)}..."${sentiment}${question}${action}`
      );
    }
  }

  if (meeting.summary) {
    console.log('\nSummary:');
    if (meeting.summary.overview) {
      console.log(`  Overview: ${meeting.summary.overview.slice(0, 100)}...`);
    }
    if (meeting.summary.keyPoints?.length) {
      console.log(`  Key Points: ${meeting.summary.keyPoints.length} items`);
    }
    if (meeting.summary.topics?.length) {
      console.log(`  Topics: ${meeting.summary.topics.join(', ')}`);
    }
  }

  if (meeting.analytics?.sentiments) {
    const s = meeting.analytics.sentiments;
    console.log(`\nSentiment: +${s.positive}% / ~${s.neutral}% / -${s.negative}%`);
  }

  if (meeting.channels?.length) {
    console.log(`\nChannels: ${meeting.channels.map((c) => c.title).join(', ')}`);
  }
}

async function main() {
  const client = new FirefliesClient({ apiKey });

  // Get date range for last week
  const now = new Date();
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  printSection('1. Fetching a transcript from last week');

  // List transcripts from last week
  const transcripts = await client.transcripts.list({
    fromDate: lastWeek,
    toDate: now,
    limit: 1,
  });

  if (transcripts.length === 0) {
    console.log('No transcripts found from last week.');
    console.log('Falling back to most recent transcript...');

    const recent = await client.transcripts.list({ limit: 1 });
    if (recent.length === 0) {
      console.log('No transcripts found at all.');
      return;
    }
    transcripts.push(recent[0]);
  }

  const transcriptId = transcripts[0].id;
  console.log(`Found: ${transcripts[0].title}`);

  // Fetch full transcript details
  const transcript = await client.transcripts.get(transcriptId);

  printSection('2. Basic normalization');

  const normalized = normalizeTranscript(transcript);
  printNormalizedMeeting(normalized);

  printSection('3. Normalization with options');

  const normalizedWithOptions = normalizeTranscript(transcript, {
    timeUnit: 'milliseconds',
    includeRawData: true,
    includeAIFilters: true,
    includeSummary: true,
  });

  console.log(`Time unit: milliseconds`);
  console.log(`First sentence start: ${normalizedWithOptions.sentences[0]?.startTime}ms`);
  console.log(`Raw data included: ${normalizedWithOptions.source.rawData !== undefined}`);

  printSection('4. Using createNormalizer factory');

  // Create a pre-configured normalizer for batch processing
  const normalizer = createNormalizer({
    timeUnit: 'seconds',
    includeRawData: false,
    resolveSpeakerName: (speaker) => {
      // Example: Map generic names to real names
      if (speaker.name.startsWith('Speaker ')) {
        return `Unknown ${speaker.name}`;
      }
      return speaker.name;
    },
  });

  const result = normalizer(transcript);
  console.log('Factory-created normalizer result:');
  console.log(`  ID: ${result.id}`);
  console.log(`  Speakers: ${result.speakers.map((s) => s.name).join(', ')}`);

  printSection('Done!');
  console.log('The normalized format is provider-agnostic and can be used');
  console.log('with other meeting intelligence providers.');
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
