/**
 * Example: Speaker Analytics
 *
 * Demonstrates using analyzeSpeakers to get participation metrics
 * for a completed transcript: talk time, word counts, balance.
 *
 * Usage:
 *   FIREFLIES_API_KEY=your-key npx tsx examples/speaker-analytics.ts [transcript-id]
 *
 * If no transcript ID provided, uses the most recent transcript.
 */

import { analyzeSpeakers, FirefliesClient } from 'fireflies-api';

const apiKey = process.env.FIREFLIES_API_KEY;

if (!apiKey) {
  console.error('Error: FIREFLIES_API_KEY environment variable is required');
  process.exit(1);
}

async function main() {
  const client = new FirefliesClient({ apiKey });

  // Get transcript ID from args or fetch most recent
  let transcriptId = process.argv[2];
  if (!transcriptId) {
    console.log('No transcript ID provided, fetching most recent...\n');
    const transcripts = await client.transcripts.list({ limit: 1 });
    if (transcripts.length === 0) {
      console.error('No transcripts found');
      process.exit(1);
    }
    transcriptId = transcripts[0].id;
  }

  // Fetch transcript with sentences
  console.log(`Fetching transcript: ${transcriptId}`);
  const transcript = await client.transcripts.get(transcriptId);
  console.log(`Title: ${transcript.title}`);
  console.log(`Date: ${transcript.dateString}\n`);

  // Analyze speakers
  const analytics = analyzeSpeakers(transcript);

  // Print results
  console.log('='.repeat(60));
  console.log('SPEAKER ANALYTICS');
  console.log('='.repeat(60));

  console.log('\nMeeting Overview:');
  console.log(`  Duration: ${Math.round(analytics.totalDuration / 60)} minutes`);
  console.log(`  Speakers: ${analytics.speakers.length}`);
  console.log(`  Sentences: ${analytics.totalSentences}`);
  console.log(`  Words: ${analytics.totalWords}`);
  console.log(`  Balance: ${analytics.balance}`);

  console.log(
    `\nDominant Speaker: ${analytics.dominantSpeaker} (${analytics.dominantSpeakerPercentage}%)`
  );

  console.log(`\n${'-'.repeat(60)}`);
  console.log('Per-Speaker Stats (sorted by talk time):');
  console.log('-'.repeat(60));

  for (const speaker of analytics.speakers) {
    console.log(`\n${speaker.name}:`);
    console.log(`  Talk Time: ${Math.round(speaker.talkTime)}s (${speaker.talkTimePercentage}%)`);
    console.log(`  Words: ${speaker.wordCount} (${speaker.wordsPerMinute} wpm)`);
    console.log(
      `  Sentences: ${speaker.sentenceCount} (avg ${speaker.averageSentenceLength.toFixed(1)} words)`
    );
    console.log(`  Speaking Turns: ${speaker.turnCount}`);
  }

  // Demo: Show difference with mergeSpeakersByName: false
  const rawAnalytics = analyzeSpeakers(transcript, { mergeSpeakersByName: false });
  if (rawAnalytics.speakers.length !== analytics.speakers.length) {
    console.log(`\n${'-'.repeat(60)}`);
    console.log('Note: Speaker merging combined some speakers with identical names.');
    console.log(`  With merging: ${analytics.speakers.length} speakers`);
    console.log(`  Without merging: ${rawAnalytics.speakers.length} speakers`);
    console.log('  Use { mergeSpeakersByName: false } to see raw speaker IDs.');
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
