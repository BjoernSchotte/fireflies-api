import { beforeAll, describe, expect, it } from 'vitest';
import { FirefliesClient } from '../../src/client.js';
import { buildDigest, renderDigest, renderDigestHtml } from '../../src/index.js';

/**
 * Live E2E tests for digest functionality.
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

describe.skipIf(!SHOULD_RUN)('digest (live)', () => {
  let client: FirefliesClient;

  beforeAll(() => {
    if (!API_KEY) {
      throw new Error('FIREFLIES_API_KEY is required for live tests');
    }
    client = new FirefliesClient({ apiKey: API_KEY });
  });

  describe('buildDigest', () => {
    it('builds digest from real transcripts', async () => {
      // Fetch transcripts from last 7 days
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const transcripts = await client.transcripts.list({
        fromDate: lastWeek.toISOString().split('T')[0],
        toDate: now.toISOString().split('T')[0],
        limit: 10,
        includeSummary: true,
      });

      // Build digest - should work even with empty array
      const digest = buildDigest(transcripts);

      // Verify structure
      expect(digest).toBeDefined();
      expect(digest.totalMeetings).toBe(transcripts.length);
      expect(digest.period).toBeDefined();
      expect(digest.period.from).toBeDefined();
      expect(digest.period.to).toBeDefined();
      expect(digest.stats).toBeDefined();
      expect(typeof digest.stats.totalMeetings).toBe('number');
      expect(typeof digest.stats.totalMinutes).toBe('number');
      expect(typeof digest.stats.averageDuration).toBe('number');
      expect(digest.actionItems).toBeDefined();
      expect(typeof digest.actionItems.total).toBe('number');
      expect(digest.highlights).toBeDefined();
      expect(Array.isArray(digest.highlights)).toBe(true);
      expect(digest.participants).toBeDefined();
      expect(Array.isArray(digest.participants)).toBe(true);
      expect(digest.meetings).toBeDefined();
      expect(Array.isArray(digest.meetings)).toBe(true);

      console.log(
        `Built digest with ${digest.totalMeetings} meetings, ${digest.actionItems.total} action items`
      );
    });

    it('handles empty transcript list gracefully', async () => {
      const digest = buildDigest([]);

      expect(digest.totalMeetings).toBe(0);
      expect(digest.totalDuration).toBe(0);
      expect(digest.actionItems.total).toBe(0);
      expect(digest.highlights).toHaveLength(0);
      expect(digest.participants).toHaveLength(0);
      expect(digest.meetings).toHaveLength(0);
    });
  });

  describe('renderDigest', () => {
    it('renders with default template', async () => {
      const transcripts = await client.transcripts.list({
        limit: 3,
        includeSummary: true,
      });

      const digest = buildDigest(transcripts);
      const markdown = renderDigest(digest);

      expect(markdown).toContain('# Weekly Meeting Digest');
      expect(markdown).toContain('meetings');
      expect(markdown).toContain('action items');

      console.log('Default template renders successfully');
    });

    it('renders with compact template', async () => {
      const transcripts = await client.transcripts.list({
        limit: 3,
        includeSummary: true,
      });

      const digest = buildDigest(transcripts);
      const markdown = renderDigest(digest, { template: 'compact' });

      expect(markdown).toBeDefined();
      expect(markdown.length).toBeGreaterThan(0);
      // Compact template is shorter
      expect(markdown).toContain('meetings');

      console.log('Compact template renders successfully');
    });

    it('renders with executive template', async () => {
      const transcripts = await client.transcripts.list({
        limit: 3,
        includeSummary: true,
      });

      const digest = buildDigest(transcripts);
      const markdown = renderDigest(digest, { template: 'executive' });

      expect(markdown).toBeDefined();
      expect(markdown.length).toBeGreaterThan(0);
      expect(markdown).toContain('Executive Summary');

      console.log('Executive template renders successfully');
    });
  });

  describe('renderDigestHtml', () => {
    it('renders digest as HTML', async () => {
      const transcripts = await client.transcripts.list({
        limit: 3,
        includeSummary: true,
      });

      const digest = buildDigest(transcripts);
      const html = renderDigestHtml(digest);

      // Verify it's valid HTML
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('Weekly Meeting Digest');
      expect(html).toContain('<style>');

      // Verify structure elements
      expect(html).toContain('stat-card');
      expect(html).toContain('Meetings');
      expect(html).toContain('Total Time');
      expect(html).toContain('Action Items');

      console.log(`HTML output generated: ${html.length} bytes`);
    });

    it('escapes HTML in content', async () => {
      const transcripts = await client.transcripts.list({
        limit: 1,
        includeSummary: true,
      });

      const digest = buildDigest(transcripts);
      const html = renderDigestHtml(digest);

      // Should not contain unescaped angle brackets in content areas
      // (except for HTML tags)
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('</script>');

      console.log('HTML escaping verified');
    });
  });

  describe('JSON output', () => {
    it('digest serializes to valid JSON', async () => {
      const transcripts = await client.transcripts.list({
        limit: 3,
        includeSummary: true,
      });

      const digest = buildDigest(transcripts);
      const json = JSON.stringify(digest, null, 2);

      // Should be valid JSON
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(digest);

      // Should have expected structure
      expect(parsed.totalMeetings).toBeDefined();
      expect(parsed.stats).toBeDefined();
      expect(parsed.actionItems).toBeDefined();

      console.log(`JSON output: ${json.length} bytes, valid structure`);
    });
  });

  describe('external participant filtering', () => {
    it('builds digest with external filter', async () => {
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const transcripts = await client.transcripts.list({
        fromDate: lastWeek.toISOString().split('T')[0],
        toDate: now.toISOString().split('T')[0],
        limit: 10,
        external: true,
        includeSummary: true,
      });

      const digest = buildDigest(transcripts);

      expect(digest).toBeDefined();
      expect(digest.totalMeetings).toBe(transcripts.length);

      console.log(
        `External filter: found ${transcripts.length} meetings with external participants`
      );
    });
  });
});
