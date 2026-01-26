import { defineConfig } from 'vitest/config';

/**
 * Configuration for live E2E tests.
 *
 * Run with: LIVE_TEST=1 FIREFLIES_API_KEY=your-key npm run test:live
 *
 * These tests hit the real Fireflies API and validate that:
 * 1. Our types match the actual API responses
 * 2. Our client works with real authentication
 * 3. Recorded fixtures are still accurate
 */
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['test/live/**/*.test.ts'],
    testTimeout: 30000,
    // Only run if LIVE_TEST=1
    // Tests will skip themselves if FIREFLIES_API_KEY is missing
  },
});
