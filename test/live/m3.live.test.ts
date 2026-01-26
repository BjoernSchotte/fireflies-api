/**
 * Live E2E tests for M3 APIs.
 * Run with: npm run test:live
 *
 * These tests are READ-ONLY and non-destructive.
 * Skipped: setRole, addBot, upload, delete
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { FirefliesClient } from '../../src/client.js';

const API_KEY = process.env.FIREFLIES_API_KEY;
const SHOULD_RUN = process.env.LIVE_TEST === '1' && !!API_KEY;

describe.skipIf(!SHOULD_RUN)('M3 Live E2E Tests', () => {
  let client: FirefliesClient;

  beforeAll(() => {
    if (!API_KEY) {
      throw new Error('FIREFLIES_API_KEY is required for live tests');
    }
    client = new FirefliesClient({ apiKey: API_KEY });
  });

  describe('users', () => {
    it('me() returns current user', async () => {
      const user = await client.users.me();

      expect(user).toBeDefined();
      expect(user.user_id).toBeDefined();
      expect(user.email).toBeDefined();
      expect(typeof user.email).toBe('string');
      expect(user.email).toContain('@');

      console.log(`Current user: ${user.name} (${user.email})`);
      console.log(`  - user_id: ${user.user_id}`);
      console.log(`  - is_admin: ${user.is_admin}`);
      console.log(`  - num_transcripts: ${user.num_transcripts}`);
      console.log(`  - minutes_consumed: ${user.minutes_consumed}`);
    });

    it('list() returns team users', async () => {
      const users = await client.users.list();

      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);

      console.log(`Team has ${users.length} users:`);
      for (const user of users.slice(0, 5)) {
        console.log(`  - ${user.name} (${user.email}) - admin: ${user.is_admin}`);
      }
      if (users.length > 5) {
        console.log(`  ... and ${users.length - 5} more`);
      }
    });

    it('get(id) returns specific user', async () => {
      // First get current user to have a valid ID
      const me = await client.users.me();
      const user = await client.users.get(me.user_id);

      expect(user).toBeDefined();
      expect(user.user_id).toBe(me.user_id);
      expect(user.email).toBe(me.email);

      console.log(`Got user by ID: ${user.name}`);
    });
  });

  describe('bites', () => {
    it('list() returns bites', async () => {
      const bites = await client.bites.list({ mine: true, limit: 10 });

      expect(Array.isArray(bites)).toBe(true);

      console.log(`Found ${bites.length} bites:`);
      for (const bite of bites.slice(0, 5)) {
        console.log(`  - ${bite.name} (${bite.id})`);
        console.log(`    status: ${bite.status}, media: ${bite.media_type}`);
        console.log(`    time: ${bite.start_time}s - ${bite.end_time}s`);
      }

      if (bites.length === 0) {
        console.log('  (no bites found - this is OK if account has no bites)');
      }
    });

    it('get(id) returns specific bite if available', async () => {
      const bites = await client.bites.list({ mine: true, limit: 1 });

      if (bites.length === 0) {
        console.log('Skipping get() test - no bites available');
        return;
      }

      const bite = await client.bites.get(bites[0]!.id);

      expect(bite).toBeDefined();
      expect(bite.id).toBe(bites[0]!.id);

      console.log(`Got bite: ${bite.name}`);
      console.log(`  - captions: ${bite.captions?.length ?? 0}`);
      console.log(`  - sources: ${bite.sources?.length ?? 0}`);
    });
  });

  describe('meetings', () => {
    it('active() returns active meetings', async () => {
      const meetings = await client.meetings.active();

      expect(Array.isArray(meetings)).toBe(true);

      console.log(`Found ${meetings.length} active meetings:`);
      for (const meeting of meetings) {
        console.log(`  - ${meeting.title} (${meeting.id})`);
        console.log(`    organizer: ${meeting.organizer_email}`);
        console.log(`    state: ${meeting.state}`);
        console.log(`    link: ${meeting.meeting_link}`);
      }

      if (meetings.length === 0) {
        console.log('  (no active meetings - this is expected when no meetings are in progress)');
      }
    });

    it('active() with state filter', async () => {
      const activeMeetings = await client.meetings.active({ states: ['active'] });

      expect(Array.isArray(activeMeetings)).toBe(true);

      console.log(`Found ${activeMeetings.length} meetings in 'active' state`);

      // All returned meetings should be in 'active' state
      for (const meeting of activeMeetings) {
        expect(meeting.state).toBe('active');
      }
    });
  });

  describe('aiApps', () => {
    it('list() returns AI App outputs', async () => {
      const outputs = await client.aiApps.list({ limit: 10 });

      expect(Array.isArray(outputs)).toBe(true);

      console.log(`Found ${outputs.length} AI App outputs:`);
      for (const output of outputs.slice(0, 5)) {
        console.log(`  - ${output.title} (app: ${output.app_id})`);
        console.log(`    transcript: ${output.transcript_id}`);
        console.log(`    response preview: ${output.response?.slice(0, 100)}...`);
      }

      if (outputs.length === 0) {
        console.log('  (no AI App outputs found - this is OK if no AI Apps are configured)');
      }
    });

    it('list() with transcript filter', async () => {
      // First get a transcript ID
      const transcripts = await client.transcripts.list({ limit: 1 });

      if (transcripts.length === 0) {
        console.log('Skipping transcript filter test - no transcripts available');
        return;
      }

      const transcriptId = transcripts[0]!.id;
      const outputs = await client.aiApps.list({ transcript_id: transcriptId, limit: 5 });

      expect(Array.isArray(outputs)).toBe(true);

      console.log(`Found ${outputs.length} AI App outputs for transcript ${transcriptId}`);

      // All returned outputs should be for this transcript
      for (const output of outputs) {
        expect(output.transcript_id).toBe(transcriptId);
      }
    });
  });

  describe('integration', () => {
    it('can fetch user, their transcripts, and related data', async () => {
      // Get current user
      const me = await client.users.me();
      console.log(`\nIntegration test for user: ${me.name}`);

      // Get their transcripts
      const transcripts = await client.transcripts.list({ mine: true, limit: 3 });
      console.log(`User has ${transcripts.length} recent transcripts`);

      if (transcripts.length > 0) {
        const transcript = transcripts[0]!;
        console.log(`\nFirst transcript: "${transcript.title}"`);

        // Get bites for this transcript
        const bites = await client.bites.list({
          transcript_id: transcript.id,
          limit: 5,
        });
        console.log(`  - ${bites.length} bites`);

        // Get AI App outputs for this transcript
        const aiOutputs = await client.aiApps.list({
          transcript_id: transcript.id,
          limit: 5,
        });
        console.log(`  - ${aiOutputs.length} AI App outputs`);
      }

      console.log('\nIntegration test completed successfully!');
    });
  });
});
