/**
 * Example: Realtime Transcription Streaming
 *
 * Demonstrates connecting to a live meeting and streaming transcription
 * chunks in real-time. This is a simpler example than realtime-accumulator.ts,
 * focused on connection basics and streaming.
 *
 * Usage:
 *   FIREFLIES_API_KEY=your-key npx tsx examples/realtime-stream.ts <meeting-id>
 *
 * Requirements:
 *   - An active meeting with Fireflies bot transcribing
 *   - Your Fireflies API key
 *
 * To find active meetings:
 *   const meetings = await client.meetings.active();
 */

import { FirefliesClient } from 'fireflies-api';

const apiKey = process.env.FIREFLIES_API_KEY;
const meetingId = process.argv[2];

if (!apiKey) {
  console.error('Error: FIREFLIES_API_KEY environment variable is required');
  process.exit(1);
}

if (!meetingId) {
  console.error('Error: Meeting ID required');
  console.error('Usage: npx tsx examples/realtime-stream.ts <meeting-id>');
  console.error('\nTip: Find active meetings with client.meetings.active()');
  process.exit(1);
}

async function main() {
  const client = new FirefliesClient({ apiKey });

  console.log(`Connecting to meeting: ${meetingId}`);
  console.log('Press Ctrl+C to stop\n');

  // Method 1: Event-based streaming (more control)
  await streamWithEvents(client);

  // Method 2: Async iterator (simpler, shown below for reference)
  // await streamWithIterator(client);
}

/**
 * Stream using event-based API for fine-grained control.
 */
async function streamWithEvents(client: FirefliesClient) {
  const stream = await client.realtime.connect(meetingId);

  // Track statistics
  let chunkCount = 0;
  let finalChunkCount = 0;

  // Handle incoming transcription chunks
  stream.on('chunk', (chunk) => {
    chunkCount++;

    // Partial chunks show in-progress speech
    if (!chunk.isFinal) {
      process.stdout.write(`\r  [${chunk.speaker_name}]: ${chunk.text.slice(0, 70).padEnd(70)}`);
      return;
    }

    // Final chunks are complete utterances
    finalChunkCount++;
    console.log(`\r[${chunk.speaker_name}]: ${chunk.text}`);
  });

  // Handle errors
  stream.on('error', (error) => {
    console.error('\nStream error:', error.message);
  });

  // Handle disconnection
  stream.on('disconnected', (reason) => {
    console.log(`\nDisconnected: ${reason}`);
    printStats(chunkCount, finalChunkCount);
    process.exit(0);
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n\nStopping stream...');
    stream.close();
    printStats(chunkCount, finalChunkCount);
    process.exit(0);
  });
}

/**
 * Stream using async iterator (simpler approach).
 * Automatically handles connection and cleanup.
 * Kept as reference - uncomment the call in main() to use.
 */
async function _streamWithIterator(client: FirefliesClient) {
  let chunkCount = 0;

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n\nStream interrupted');
    process.exit(0);
  });

  try {
    for await (const chunk of client.realtime.stream(meetingId)) {
      chunkCount++;

      if (chunk.isFinal) {
        console.log(`[${chunk.speaker_name}]: ${chunk.text}`);
      } else {
        process.stdout.write(`\r  [${chunk.speaker_name}]: ${chunk.text.slice(0, 70).padEnd(70)}`);
      }
    }

    console.log(`\nStream ended. Received ${chunkCount} chunks.`);
  } catch (error) {
    if (error instanceof Error) {
      console.error('Stream error:', error.message);
    }
    throw error;
  }
}

function printStats(total: number, final: number) {
  console.log(`\n${'-'.repeat(40)}`);
  console.log('Statistics:');
  console.log(`  Total chunks: ${total}`);
  console.log(`  Final chunks: ${final}`);
  console.log(`  Partial chunks: ${total - final}`);
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
