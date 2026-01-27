/**
 * Example: Real-time Transcript Accumulator
 *
 * Demonstrates using TranscriptAccumulator to build a coherent transcript
 * from streaming chunks, with live statistics and speaker grouping.
 *
 * Usage:
 *   FIREFLIES_API_KEY=your-key MEETING_ID=your-meeting-id npx tsx examples/realtime-accumulator.ts
 *
 * Requirements:
 *   - An active meeting with Fireflies bot transcribing
 *   - Your Fireflies API key
 */

import { FirefliesClient, TranscriptAccumulator } from 'fireflies-api';

const apiKey = process.env.FIREFLIES_API_KEY;
const meetingId = process.env.MEETING_ID;

if (!apiKey) {
  console.error('Error: FIREFLIES_API_KEY environment variable is required');
  process.exit(1);
}

if (!meetingId) {
  console.error('Error: MEETING_ID environment variable is required');
  console.error('Tip: Find active meetings with: client.meetings.active()');
  process.exit(1);
}

async function main() {
  const client = new FirefliesClient({ apiKey });
  const accumulator = new TranscriptAccumulator();

  console.log(`Connecting to meeting: ${meetingId}`);
  console.log('Listening for transcription... (Ctrl+C to stop)\n');

  // Connect and listen for chunks
  const stream = await client.realtime.connect(meetingId);

  stream.on('chunk', (chunk) => {
    // Add chunk to accumulator (non-final chunks are automatically ignored)
    accumulator.add(chunk);

    // Show real-time progress for partial chunks
    if (!chunk.isFinal) {
      process.stdout.write(`\r  [${chunk.speaker_name}]: ${chunk.text.slice(0, 60).padEnd(60)}`);
      return;
    }

    // Final chunk - show accumulated state
    const transcript = accumulator.getTranscript();
    console.log(`\r✓ [${chunk.speaker_name}]: "${chunk.text}"`);
    console.log(
      `  Stats: ${transcript.turns.length} turns, ${transcript.speakers.length} speakers, ` +
        `${transcript.wordCount} words, ${transcript.duration.toFixed(1)}s\n`
    );
  });

  stream.on('error', (error) => {
    console.error('Stream error:', error.message);
  });

  stream.on('disconnected', (reason) => {
    console.log(`\nDisconnected: ${reason}`);
    printFinalTranscript(accumulator);
    process.exit(0);
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n\nStopping...');
    stream.close();
    printFinalTranscript(accumulator);
    process.exit(0);
  });
}

function printFinalTranscript(accumulator: TranscriptAccumulator) {
  const transcript = accumulator.getTranscript();

  console.log(`\n${'='.repeat(60)}`);
  console.log('FINAL TRANSCRIPT');
  console.log('='.repeat(60));

  if (transcript.turns.length === 0) {
    console.log('(No final chunks received)');
    return;
  }

  // Print each turn
  for (const turn of transcript.turns) {
    console.log(
      `\n[${turn.speaker}] (${turn.startTime.toFixed(1)}s - ${turn.endTime.toFixed(1)}s)`
    );
    console.log(`  "${turn.text}"`);
  }

  // Print summary
  console.log(`\n${'-'.repeat(60)}`);
  console.log('Summary:');
  console.log(`  Speakers: ${transcript.speakers.join(', ')}`);
  console.log(`  Turns: ${transcript.turns.length}`);
  console.log(`  Words: ${transcript.wordCount}`);
  console.log(`  Duration: ${transcript.duration.toFixed(1)}s`);
  console.log(`  Chunks processed: ${transcript.chunkCount}`);
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
