/**
 * Live E2E tests for Markdown export.
 * Run with: npm run test:live
 *
 * These tests are READ-ONLY and non-destructive.
 * Exports transcripts to markdown files for verification.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { FirefliesClient } from '../../src/client.js';
import { transcriptToMarkdown } from '../../src/helpers/markdown.js';
import type { Transcript } from '../../src/types/transcript.js';

const API_KEY = process.env.FIREFLIES_API_KEY;
const SHOULD_RUN = process.env.LIVE_TEST === '1' && !!API_KEY;

const OUTPUT_DIR = join(process.cwd(), 'test-output', 'markdown');

describe.skipIf(!SHOULD_RUN)('Markdown Export Live E2E Tests', () => {
  let client: FirefliesClient;
  let transcripts: Transcript[];

  beforeAll(async () => {
    if (!API_KEY) {
      throw new Error('FIREFLIES_API_KEY is required for live tests');
    }
    client = new FirefliesClient({ apiKey: API_KEY });

    // Create output directory
    await mkdir(OUTPUT_DIR, { recursive: true });

    // Fetch transcripts from last week with full data (sentences + summary)
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const fromDate = lastWeek.toISOString().split('T')[0];

    console.log(`Fetching transcripts from ${fromDate}...`);
    const listed = await client.transcripts.list({
      limit: 10,
      fromDate,
    });

    // Fetch full transcript data (with sentences and summary) for first 2
    console.log(`Found ${listed.length} transcripts, fetching full data...`);
    transcripts = [];
    for (const t of listed.slice(0, 3)) {
      const full = await client.transcripts.get(t.id);
      if (full.sentences && full.sentences.length > 0) {
        transcripts.push(full);
        console.log(`  - "${full.title}" (${full.sentences.length} sentences)`);
      }
    }

    console.log(`Using ${transcripts.length} transcripts with content`);
  }, 60000); // 60s timeout for API calls

  it('exports transcript with default options', async () => {
    if (transcripts.length === 0) {
      console.log('No transcripts available, skipping');
      return;
    }

    const transcript = transcripts[0];
    console.log(`\nExporting: "${transcript.title}"`);

    const markdown = await transcriptToMarkdown(transcript);
    const filename = `01-default-${sanitizeFilename(transcript.title)}.md`;
    const filepath = join(OUTPUT_DIR, filename);

    await writeFile(filepath, markdown, 'utf-8');
    console.log(`Written: ${filepath}`);

    expect(markdown).toContain(`# ${transcript.title}`);
    expect(markdown.length).toBeGreaterThan(0);
  });

  it('exports transcript with timestamps', async () => {
    if (transcripts.length === 0) {
      console.log('No transcripts available, skipping');
      return;
    }

    const transcript = transcripts[0];
    const markdown = await transcriptToMarkdown(transcript, {
      includeTimestamps: true,
    });

    const filename = `02-with-timestamps-${sanitizeFilename(transcript.title)}.md`;
    const filepath = join(OUTPUT_DIR, filename);

    await writeFile(filepath, markdown, 'utf-8');
    console.log(`Written: ${filepath}`);

    // Should contain timestamp format [M:SS] if there are sentences
    if (transcript.sentences && transcript.sentences.length > 0) {
      expect(markdown).toMatch(/\[\d+:\d{2}\]/);
    }
  });

  it('exports transcript with plain list action items', async () => {
    if (transcripts.length === 0) {
      console.log('No transcripts available, skipping');
      return;
    }

    const transcript = transcripts[0];
    const markdown = await transcriptToMarkdown(transcript, {
      actionItemFormat: 'list',
    });

    const filename = `03-plain-list-${sanitizeFilename(transcript.title)}.md`;
    const filepath = join(OUTPUT_DIR, filename);

    await writeFile(filepath, markdown, 'utf-8');
    console.log(`Written: ${filepath}`);

    expect(markdown.length).toBeGreaterThan(0);
  });

  it('exports transcript without grouping', async () => {
    if (transcripts.length === 0) {
      console.log('No transcripts available, skipping');
      return;
    }

    const transcript = transcripts[0];
    const markdown = await transcriptToMarkdown(transcript, {
      groupBySpeaker: false,
      includeTimestamps: true,
    });

    const filename = `04-no-grouping-${sanitizeFilename(transcript.title)}.md`;
    const filepath = join(OUTPUT_DIR, filename);

    await writeFile(filepath, markdown, 'utf-8');
    console.log(`Written: ${filepath}`);

    expect(markdown.length).toBeGreaterThan(0);
  });

  it('exports transcript with plain speaker format', async () => {
    if (transcripts.length === 0) {
      console.log('No transcripts available, skipping');
      return;
    }

    const transcript = transcripts[0];
    const markdown = await transcriptToMarkdown(transcript, {
      speakerFormat: 'plain',
      includeTimestamps: true,
      groupBySpeaker: false,
    });

    const filename = `05-plain-format-${sanitizeFilename(transcript.title)}.md`;
    const filepath = join(OUTPUT_DIR, filename);

    await writeFile(filepath, markdown, 'utf-8');
    console.log(`Written: ${filepath}`);

    // Should contain plain speaker format in transcript section
    if (transcript.sentences && transcript.sentences.length > 0) {
      // Extract transcript section and verify no bold speaker names
      const transcriptSection = markdown.split('## Transcript')[1] || '';
      expect(transcriptSection).toMatch(/\[\d+:\d{2}\] \w/); // [M:SS] Speaker: format
    }
  });

  it('exports transcript with minimal options', async () => {
    if (transcripts.length === 0) {
      console.log('No transcripts available, skipping');
      return;
    }

    const transcript = transcripts[0];
    const markdown = await transcriptToMarkdown(transcript, {
      includeMetadata: false,
      includeSummary: false,
      speakerFormat: 'plain',
    });

    const filename = `06-minimal-${sanitizeFilename(transcript.title)}.md`;
    const filepath = join(OUTPUT_DIR, filename);

    await writeFile(filepath, markdown, 'utf-8');
    console.log(`Written: ${filepath}`);

    // Should not have metadata
    expect(markdown).not.toContain('**Date:**');
    expect(markdown).not.toContain('## Summary');
  });

  it('exports second transcript if available', async () => {
    if (transcripts.length < 2) {
      console.log('Only one transcript available, skipping');
      return;
    }

    const transcript = transcripts[1];
    console.log(`\nExporting second: "${transcript.title}"`);

    const markdown = await transcriptToMarkdown(transcript);
    const filename = `07-second-${sanitizeFilename(transcript.title)}.md`;
    const filepath = join(OUTPUT_DIR, filename);

    await writeFile(filepath, markdown, 'utf-8');
    console.log(`Written: ${filepath}`);

    expect(markdown).toContain(`# ${transcript.title}`);
  });

  it('prints summary of exported files', async () => {
    console.log('\n========================================');
    console.log('EXPORTED FILES:');
    console.log(`Output directory: ${OUTPUT_DIR}`);
    console.log('========================================\n');

    const files = [
      '01-default-*.md',
      '02-with-timestamps-*.md',
      '03-plain-list-*.md',
      '04-no-grouping-*.md',
      '05-plain-format-*.md',
      '06-minimal-*.md',
      '07-second-*.md',
    ];

    for (const pattern of files) {
      console.log(`  - ${pattern}`);
    }

    expect(true).toBe(true);
  });
});

function sanitizeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}
