import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { daysAgo, resolveDateRange, startOfToday } from '../../src/cli/utils/date.js';

describe('CLI date utilities', () => {
  beforeEach(() => {
    // Mock Date to ensure consistent tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-27T15:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('startOfToday', () => {
    it('returns start of today as ISO string', () => {
      const result = startOfToday();
      // Should be midnight of Jan 27, 2026 in local timezone
      const date = new Date(result);
      expect(date.getHours()).toBe(0);
      expect(date.getMinutes()).toBe(0);
      expect(date.getSeconds()).toBe(0);
      expect(date.getMilliseconds()).toBe(0);
    });
  });

  describe('daysAgo', () => {
    it('returns date N days ago at midnight', () => {
      const result = daysAgo(7);
      const date = new Date(result);
      // Should be 7 days before Jan 27 = Jan 20
      expect(date.getDate()).toBe(20);
      expect(date.getHours()).toBe(0);
      expect(date.getMinutes()).toBe(0);
    });

    it('returns today at midnight for 0 days ago', () => {
      const result = daysAgo(0);
      const date = new Date(result);
      expect(date.getDate()).toBe(27);
      expect(date.getHours()).toBe(0);
    });

    it('handles month boundaries', () => {
      const result = daysAgo(30);
      const date = new Date(result);
      // 30 days before Jan 27 = Dec 28
      expect(date.getMonth()).toBe(11); // December (0-indexed)
      expect(date.getDate()).toBe(28);
    });
  });

  describe('resolveDateRange', () => {
    it('returns fromDate for --today', () => {
      const result = resolveDateRange({ today: true });
      expect(result.fromDate).toBeDefined();
      expect(result.toDate).toBeUndefined();
      const date = new Date(result.fromDate as string);
      expect(date.getDate()).toBe(27);
    });

    it('returns fromDate and toDate for --yesterday', () => {
      const result = resolveDateRange({ yesterday: true });
      expect(result.fromDate).toBeDefined();
      expect(result.toDate).toBeDefined();
      const from = new Date(result.fromDate as string);
      expect(from.getDate()).toBe(26);
    });

    it('returns fromDate for --last-week', () => {
      const result = resolveDateRange({ lastWeek: true });
      expect(result.fromDate).toBeDefined();
      const date = new Date(result.fromDate as string);
      expect(date.getDate()).toBe(20); // 7 days ago
    });

    it('returns fromDate for --last-month', () => {
      const result = resolveDateRange({ lastMonth: true });
      expect(result.fromDate).toBeDefined();
      const date = new Date(result.fromDate as string);
      expect(date.getMonth()).toBe(11); // December (30 days ago from Jan 27)
    });

    it('returns fromDate for --days N', () => {
      const result = resolveDateRange({ days: '14' });
      expect(result.fromDate).toBeDefined();
      const date = new Date(result.fromDate as string);
      expect(date.getDate()).toBe(13); // 14 days ago
    });

    it('ignores invalid --days value', () => {
      const result = resolveDateRange({ days: 'invalid' });
      expect(result.fromDate).toBeUndefined();
      expect(result.toDate).toBeUndefined();
    });

    it('ignores zero --days value', () => {
      const result = resolveDateRange({ days: '0' });
      expect(result.fromDate).toBeUndefined();
    });

    it('ignores negative --days value', () => {
      const result = resolveDateRange({ days: '-5' });
      expect(result.fromDate).toBeUndefined();
    });

    it('returns explicit dates when no relative option', () => {
      const result = resolveDateRange({
        from: '2026-01-01',
        to: '2026-01-15',
      });
      expect(result.fromDate).toBe('2026-01-01');
      expect(result.toDate).toBe('2026-01-15');
    });

    it('prefers relative dates over explicit dates', () => {
      const result = resolveDateRange({
        today: true,
        from: '2026-01-01',
        to: '2026-01-15',
      });
      // Should use today, not explicit dates
      const date = new Date(result.fromDate as string);
      expect(date.getDate()).toBe(27);
      expect(result.toDate).toBeUndefined();
    });

    it('returns empty range when no options', () => {
      const result = resolveDateRange({});
      expect(result.fromDate).toBeUndefined();
      expect(result.toDate).toBeUndefined();
    });
  });
});
