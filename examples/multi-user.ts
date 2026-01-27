/**
 * Example: Multi-User Meeting Aggregation
 *
 * Demonstrates fetching transcripts from multiple Fireflies accounts
 * with automatic deduplication and batch processing.
 *
 * Use cases:
 * - Aggregate meetings across a team
 * - Find all meetings involving specific people
 * - Generate cross-account reports
 *
 * Usage:
 *   FIREFLIES_API_KEY_1=key1 FIREFLIES_API_KEY_2=key2 npx tsx examples/multi-user.ts
 *
 * Or with a single key for demonstration:
 *   FIREFLIES_API_KEY=your-key npx tsx examples/multi-user.ts
 */

import {
  batch,
  batchAll,
  collectAll,
  FirefliesClient,
  getMeetingsForMultipleUsers,
} from 'fireflies-api';

// Collect API keys from environment
const apiKeys = getApiKeys();

if (apiKeys.length === 0) {
  console.error('Error: No API keys found');
  console.error('Set FIREFLIES_API_KEY or FIREFLIES_API_KEY_1, FIREFLIES_API_KEY_2, etc.');
  process.exit(1);
}

async function main() {
  console.log('='.repeat(60));
  console.log('Multi-User Meeting Aggregation');
  console.log('='.repeat(60));
  console.log(`Using ${apiKeys.length} API key(s)\n`);

  // 1. Fetch meetings from multiple users with deduplication
  await demonstrateMultiUserFetch();

  // 2. Batch processing with rate limiting
  await demonstrateBatchProcessing();

  // 3. Aggregate statistics across accounts
  await demonstrateAggregation();
}

/**
 * Fetch transcripts from multiple accounts with automatic deduplication.
 */
async function demonstrateMultiUserFetch() {
  console.log('-'.repeat(60));
  console.log('1. Multi-User Fetch with Deduplication');
  console.log('-'.repeat(60));

  // Get last 30 days of meetings
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let totalFetched = 0;
  const transcriptsByUser: Map<number, number> = new Map();

  for await (const { transcript, sourceIndex } of getMeetingsForMultipleUsers(apiKeys, {
    deduplicate: true, // Remove duplicates across accounts
    filter: {
      fromDate: thirtyDaysAgo.toISOString(),
    },
    delayMs: 100, // Throttle between API calls
  })) {
    totalFetched++;
    transcriptsByUser.set(sourceIndex, (transcriptsByUser.get(sourceIndex) || 0) + 1);

    // Show progress
    if (totalFetched === 1) {
      console.log(`First transcript: ${transcript.title}`);
    }

    // Stop after 20 for demo
    if (totalFetched >= 20) break;
  }

  console.log(`Fetched ${totalFetched} unique transcripts`);
  for (const [userIndex, count] of Array.from(transcriptsByUser.entries())) {
    console.log(`  User ${userIndex + 1}: ${count} transcripts`);
  }
  console.log();
}

/**
 * Process items in batches with automatic rate limit handling.
 */
async function demonstrateBatchProcessing() {
  console.log('-'.repeat(60));
  console.log('2. Batch Processing');
  console.log('-'.repeat(60));

  const client = new FirefliesClient({ apiKey: apiKeys[0] });

  // Get some transcript IDs to process
  const transcripts = await client.transcripts.list({ limit: 5 });
  const ids = transcripts.map((t) => t.id);

  console.log(`Processing ${ids.length} transcripts in batch...\n`);

  // Method 1: Streaming results with batch()
  console.log('Streaming batch results:');
  for await (const result of batch(ids, (id) => client.transcripts.getSummary(id), {
    delayMs: 100,
    handleRateLimit: true,
  })) {
    if (result.error) {
      console.log(`  Error for ${result.item}: ${result.error.message}`);
    } else {
      const gist = result.result?.gist?.slice(0, 50) || 'No summary';
      console.log(`  ${result.item.slice(0, 8)}...: ${gist}...`);
    }
  }

  // Method 2: Collect all results with batchAll()
  console.log('\nCollecting all results:');
  const summaries = await batchAll(
    ids,
    (id) => client.transcripts.getSummary(id),
    { continueOnError: true } // Don't stop on individual failures
  );
  console.log(`  Successfully fetched ${summaries.length} summaries`);
  console.log();
}

/**
 * Aggregate statistics across multiple accounts.
 */
async function demonstrateAggregation() {
  console.log('-'.repeat(60));
  console.log('3. Cross-Account Aggregation');
  console.log('-'.repeat(60));

  // Get last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Collect all transcripts
  const allTranscripts = await collectAll(
    (async function* () {
      let count = 0;
      for await (const { transcript } of getMeetingsForMultipleUsers(apiKeys, {
        deduplicate: true,
        filter: { fromDate: sevenDaysAgo.toISOString() },
      })) {
        yield transcript;
        if (++count >= 50) break; // Limit for demo
      }
    })()
  );

  // Calculate statistics
  const totalMeetings = allTranscripts.length;
  const totalDuration = allTranscripts.reduce((sum, t) => sum + (t.duration || 0), 0);
  const participantSet = new Set<string>();

  for (const t of allTranscripts) {
    for (const p of t.participants) {
      participantSet.add(p.toLowerCase());
    }
  }

  console.log('Last 7 days summary:');
  console.log(`  Total meetings: ${totalMeetings}`);
  console.log(`  Total duration: ${Math.round(totalDuration / 60)} minutes`);
  console.log(`  Unique participants: ${participantSet.size}`);
  console.log(`  Avg meeting length: ${Math.round(totalDuration / totalMeetings / 60)} minutes`);

  // Group by day
  const byDay = new Map<string, number>();
  for (const t of allTranscripts) {
    const day = t.dateString?.split('T')[0] || 'unknown';
    byDay.set(day, (byDay.get(day) || 0) + 1);
  }

  console.log('\nMeetings by day:');
  const sortedDays = Array.from(byDay.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  for (const [day, count] of sortedDays.slice(0, 7)) {
    console.log(`  ${day}: ${count} meetings`);
  }
}

/**
 * Get API keys from environment variables.
 * Supports both single key and numbered keys.
 */
function getApiKeys(): string[] {
  const keys: string[] = [];

  // Check for single key
  if (process.env.FIREFLIES_API_KEY) {
    keys.push(process.env.FIREFLIES_API_KEY);
  }

  // Check for numbered keys (FIREFLIES_API_KEY_1, FIREFLIES_API_KEY_2, etc.)
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`FIREFLIES_API_KEY_${i}`];
    if (key && !keys.includes(key)) {
      keys.push(key);
    }
  }

  return keys;
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
