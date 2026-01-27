/**
 * Example: Basic SDK Usage
 *
 * Demonstrates essential operations with the Fireflies SDK:
 * - Client initialization
 * - List and filter transcripts
 * - Get transcript details
 * - Get summary only (lighter weight)
 * - Auto-pagination with listAll()
 * - Search transcripts
 * - Extract action items
 * - Export to markdown
 *
 * Usage:
 *   FIREFLIES_API_KEY=your-key npx tsx examples/basic-usage.ts
 */

import {
  collectAll,
  extractActionItems,
  FirefliesClient,
  type Transcript,
  transcriptToMarkdown,
} from 'fireflies-api';

const apiKey = process.env.FIREFLIES_API_KEY;

if (!apiKey) {
  console.error('Error: FIREFLIES_API_KEY environment variable is required');
  process.exit(1);
}

// --- Helper functions for each demo section ---

function printSection(num: number, title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${num}. ${title}`);
  console.log('='.repeat(60));
}

async function demoListTranscripts(client: FirefliesClient) {
  printSection(2, 'List Recent Transcripts');

  const transcripts = await client.transcripts.list({ limit: 5 });
  console.log(`Found ${transcripts.length} recent transcripts:`);
  for (const t of transcripts) {
    console.log(`  - ${t.title} (${t.dateString})`);
  }
  return transcripts;
}

async function demoGetTranscript(client: FirefliesClient, transcriptId: string) {
  printSection(3, 'Get Transcript Details');

  const transcript = await client.transcripts.get(transcriptId);
  console.log(`Title: ${transcript.title}`);
  console.log(`Date: ${transcript.dateString}`);
  console.log(`Duration: ${Math.round(transcript.duration / 60)} minutes`);
  console.log(`Participants: ${transcript.participants.join(', ')}`);
  console.log(`Sentences: ${transcript.sentences.length}`);
  console.log(`Speakers: ${transcript.speakers.map((s) => s.name).join(', ')}`);
  return transcript;
}

async function demoGetSummary(client: FirefliesClient, transcriptId: string) {
  printSection(4, 'Get Summary Only (Lighter Request)');

  const summary = await client.transcripts.getSummary(transcriptId);
  if (summary) {
    console.log('Gist:', `${summary.gist?.slice(0, 150)}...`);
    console.log('Keywords:', `${summary.keywords?.slice(0, 100)}...`);
  } else {
    console.log('No summary available (meeting may still be processing)');
  }
}

async function demoPagination(client: FirefliesClient) {
  printSection(5, 'Auto-Pagination with listAll()');

  // Count total transcripts (demo - stops after 100)
  let count = 0;
  for await (const _t of client.transcripts.listAll({ mine: true })) {
    count++;
    if (count >= 100) {
      console.log('Stopping at 100 for demo...');
      break;
    }
  }
  console.log(`Iterated through ${count} transcripts`);

  // Alternative: collect all into array
  const allRecent = await collectAll(
    (async function* () {
      let i = 0;
      for await (const t of client.transcripts.listAll({ mine: true })) {
        yield t;
        if (++i >= 10) break; // Limit for demo
      }
    })()
  );
  console.log(`Collected ${allRecent.length} transcripts into array`);
}

async function demoSearch(client: FirefliesClient) {
  printSection(6, 'Search Transcripts');

  const results = await client.transcripts.search('action', {
    limit: 5,
    contextLines: 1,
  });

  console.log(`Query: "action"`);
  console.log(
    `Found ${results.totalMatches} matches in ${results.transcriptsWithMatches} transcripts`
  );

  if (results.matches.length > 0) {
    console.log('\nSample matches:');
    for (const match of results.matches.slice(0, 3)) {
      console.log(`  [${match.sentence.speakerName}]: "${match.sentence.text.slice(0, 60)}..."`);
    }
  }
}

function demoActionItems(transcript: Transcript) {
  printSection(7, 'Extract Action Items');

  const result = extractActionItems(transcript, {
    detectAssignees: true,
    detectDueDates: true,
  });

  console.log(`Total action items: ${result.totalItems}`);
  console.log(`Assigned: ${result.assignedItems}`);
  console.log(`With due dates: ${result.datedItems}`);

  if (result.items.length > 0) {
    console.log('\nSample items:');
    for (const item of result.items.slice(0, 3)) {
      const assignee = item.assignee ? ` (${item.assignee})` : '';
      const due = item.dueDate ? ` [${item.dueDate}]` : '';
      console.log(`  - ${item.text.slice(0, 50)}...${assignee}${due}`);
    }
  }
}

async function demoMarkdownExport(transcript: Transcript) {
  printSection(8, 'Export to Markdown');

  const markdown = await transcriptToMarkdown(transcript, {
    includeMetadata: true,
    includeSummary: true,
    includeActionItems: true,
    actionItemFormat: 'checkbox',
  });

  console.log(`Markdown generated: ${markdown.length} characters`);
  console.log('\nPreview (first 500 chars):');
  console.log('-'.repeat(40));
  console.log(`${markdown.slice(0, 500)}...`);

  // Optionally write to file
  // await transcriptToMarkdown(transcript, { outputPath: './meeting-notes.md' });
  // console.log('Saved to ./meeting-notes.md');
}

// --- Main function ---

async function main() {
  // 1. Initialize client
  console.log('='.repeat(60));
  console.log('1. Initialize Client');
  console.log('='.repeat(60));

  const client = new FirefliesClient({ apiKey });
  console.log('Client initialized successfully');

  // 2. List recent transcripts
  const recentTranscripts = await demoListTranscripts(client);

  if (recentTranscripts.length === 0) {
    console.log('\nNo transcripts found. Upload or record a meeting first.');
    return;
  }

  const transcriptId = recentTranscripts[0].id;

  // 3. Get single transcript
  const transcript = await demoGetTranscript(client, transcriptId);

  // 4. Get summary only
  await demoGetSummary(client, transcriptId);

  // 5. Pagination
  await demoPagination(client);

  // 6. Search
  await demoSearch(client);

  // 7. Action items
  demoActionItems(transcript);

  // 8. Markdown export
  await demoMarkdownExport(transcript);

  console.log(`\n${'='.repeat(60)}`);
  console.log('Done! See the SDK documentation for more features.');
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
