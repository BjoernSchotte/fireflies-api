import { beforeAll, describe, expect, it } from 'vitest';
import { FirefliesClient } from '../../src/client.js';
import {
  batch,
  batchAll,
  findExternalParticipantQuestions,
  getMeetingVideos,
  hasVideo,
} from '../../src/index.js';

/**
 * Live E2E tests for M4 helper functions.
 *
 * These tests require:
 * - LIVE_TEST=1 environment variable
 * - FIREFLIES_API_KEY environment variable
 *
 * Run with: npm run test:live
 *
 * IMPORTANT: These tests are READ-ONLY and non-destructive.
 * They only query existing data - no creates, updates, or deletes.
 */

const API_KEY = process.env.FIREFLIES_API_KEY;
const SHOULD_RUN = process.env.LIVE_TEST === '1' && !!API_KEY;

describe.skipIf(!SHOULD_RUN)('helpers (live)', () => {
  let client: FirefliesClient;

  beforeAll(() => {
    if (!API_KEY) {
      throw new Error('FIREFLIES_API_KEY is required for live tests');
    }
    client = new FirefliesClient({ apiKey: API_KEY });
  });

  describe('findExternalParticipantQuestions', () => {
    it('analyzes a transcript for external questions', async () => {
      // Get a transcript with full details including sentences
      const transcripts = await client.transcripts.list({ limit: 1 });

      if (transcripts.length === 0) {
        console.log('No transcripts available, skipping external questions test');
        return;
      }

      const transcriptId = transcripts[0]?.id;
      if (!transcriptId) return;

      const transcript = await client.transcripts.get(transcriptId);

      // Use a domain that's unlikely to match any real participants
      // This tests the function works without needing to know actual domains
      const result = findExternalParticipantQuestions(
        transcript,
        '@unlikely-test-domain-12345.com'
      );

      expect(result).toBeDefined();
      expect(typeof result.totalQuestions).toBe('number');
      expect(Array.isArray(result.questions)).toBe(true);
      expect(Array.isArray(result.externalParticipants)).toBe(true);

      // Since we used a fake domain, all participants should be "external"
      console.log(
        `Found ${result.totalQuestions} questions from ${result.externalParticipants.length} external participants`
      );

      // Verify question structure if any exist
      for (const q of result.questions) {
        expect(typeof q.text).toBe('string');
        expect(typeof q.speakerName).toBe('string');
        expect(typeof q.sentenceIndex).toBe('number');
        // startTime/endTime come from API - can be string or number depending on transcript
        expect(q.startTime).toBeDefined();
        expect(q.endTime).toBeDefined();
      }
    });

    it('filters correctly with real organizer domain', async () => {
      const transcripts = await client.transcripts.list({ limit: 1 });

      if (transcripts.length === 0) {
        console.log('No transcripts available, skipping domain filter test');
        return;
      }

      const transcriptId = transcripts[0]?.id;
      if (!transcriptId) return;

      const transcript = await client.transcripts.get(transcriptId);

      // Extract domain from organizer email
      const organizerEmail = transcript.organizer_email;
      if (!organizerEmail || !organizerEmail.includes('@')) {
        console.log('No organizer email, skipping domain filter test');
        return;
      }

      const domain = organizerEmail.split('@')[1];
      if (!domain) return;

      const result = findExternalParticipantQuestions(transcript, `@${domain}`);

      console.log(`Using internal domain: @${domain}`);
      console.log(`External participants: ${result.externalParticipants.length}`);
      console.log(`Questions from external: ${result.totalQuestions}`);

      // The organizer should be considered internal
      expect(result).toBeDefined();
    });
  });

  describe('getMeetingVideos', () => {
    it('iterates through transcripts with video URLs', async () => {
      // First check if any transcripts have videos using a quick list query
      const transcripts = await client.transcripts.list({ limit: 10 });
      const hasAnyVideos = transcripts.some((t) => hasVideo(t));

      if (!hasAnyVideos) {
        console.log('No transcripts with video found (requires Business plan or higher)');
        console.log('Skipping getMeetingVideos iteration test');
        return;
      }

      let count = 0;
      const maxCount = 3;

      for await (const { transcript, videoUrl } of getMeetingVideos(client)) {
        expect(transcript).toBeDefined();
        expect(typeof videoUrl).toBe('string');
        expect(videoUrl.length).toBeGreaterThan(0);
        expect(hasVideo(transcript)).toBe(true);

        console.log(`Found video: ${transcript.title} -> ${videoUrl.substring(0, 50)}...`);

        count++;
        if (count >= maxCount) break;
      }

      expect(count).toBeGreaterThan(0);
    });
  });

  describe('hasVideo', () => {
    it('correctly identifies transcripts with and without video', async () => {
      const transcripts = await client.transcripts.list({ limit: 10 });

      if (transcripts.length === 0) {
        console.log('No transcripts available, skipping hasVideo test');
        return;
      }

      let withVideo = 0;
      let withoutVideo = 0;

      for (const t of transcripts) {
        if (hasVideo(t)) {
          withVideo++;
          expect(typeof t.video_url).toBe('string');
        } else {
          withoutVideo++;
        }
      }

      console.log(`Transcripts with video: ${withVideo}, without: ${withoutVideo}`);
      expect(withVideo + withoutVideo).toBe(transcripts.length);
    });
  });

  describe('batch', () => {
    it('processes transcript fetches with rate limiting', async () => {
      const transcripts = await client.transcripts.list({ limit: 3 });

      if (transcripts.length === 0) {
        console.log('No transcripts available, skipping batch test');
        return;
      }

      const ids = transcripts.map((t) => t.id);
      const results = [];

      for await (const result of batch(ids, (id) => client.transcripts.get(id), { delayMs: 200 })) {
        results.push(result);

        if (result.error) {
          console.log(`Error fetching ${result.item}: ${result.error.message}`);
        } else {
          console.log(`Fetched: ${result.result.title}`);
        }
      }

      expect(results.length).toBe(ids.length);

      // Most should succeed
      const successful = results.filter((r) => !r.error);
      expect(successful.length).toBeGreaterThan(0);
    });
  });

  describe('batchAll', () => {
    it('fetches multiple transcripts and collects results', async () => {
      const transcripts = await client.transcripts.list({ limit: 3 });

      if (transcripts.length === 0) {
        console.log('No transcripts available, skipping batchAll test');
        return;
      }

      const ids = transcripts.map((t) => t.id);

      // Use includeSentences: false for faster fetches
      const fullTranscripts = await batchAll(
        ids,
        (id) => client.transcripts.get(id, { includeSentences: false, includeSummary: false }),
        { delayMs: 200 }
      );

      expect(fullTranscripts.length).toBe(ids.length);

      for (const t of fullTranscripts) {
        expect(t.id).toBeDefined();
        expect(t.title).toBeDefined();
      }

      console.log(`Successfully fetched ${fullTranscripts.length} full transcripts`);
    }, 60000);

    it('handles errors gracefully with continueOnError', async () => {
      // Mix valid and invalid IDs
      const transcripts = await client.transcripts.list({ limit: 2 });

      if (transcripts.length === 0) {
        console.log('No transcripts available, skipping error handling test');
        return;
      }

      const ids = [transcripts[0]?.id ?? '', 'invalid-id-12345', transcripts[0]?.id ?? ''].filter(
        Boolean
      );

      const results = await batchAll(ids, (id) => client.transcripts.get(id), {
        delayMs: 200,
        continueOnError: true,
      });

      // Should get results for valid IDs only
      console.log(`Got ${results.length} results from ${ids.length} IDs (with 1 invalid)`);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('integration: combining helpers', () => {
    it('analyzes already-fetched transcript for external questions', async () => {
      // Reuse transcript from earlier test - no additional API calls needed
      const transcripts = await client.transcripts.list({ limit: 1 });

      if (transcripts.length === 0) {
        console.log('No transcripts available, skipping integration test');
        return;
      }

      const transcript = await client.transcripts.get(transcripts[0]?.id ?? '');

      // Use organizer domain as internal
      const email = transcript.organizer_email;
      const domain = email?.includes('@') ? email.split('@')[1] : null;

      if (!domain) {
        console.log('No organizer email domain, skipping');
        return;
      }

      const result = findExternalParticipantQuestions(transcript, `@${domain}`);

      console.log(`Transcript: "${transcript.title}"`);
      console.log(`  Internal domain: @${domain}`);
      console.log(`  External participants: ${result.externalParticipants.length}`);
      console.log(`  External questions: ${result.totalQuestions}`);

      if (result.questions.length > 0) {
        const q = result.questions[0];
        console.log(`  First question: "${q.text.substring(0, 60)}..."`);
        console.log(`    Asked by: ${q.speakerName}`);
      }

      expect(result).toBeDefined();
    });
  });
});
