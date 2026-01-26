import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RateLimitTracker } from '../../src/utils/rate-limit-tracker.js';

describe('RateLimitTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-26T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('starts with undefined values and zero updatedAt', () => {
      const tracker = new RateLimitTracker();

      expect(tracker.state).toEqual({
        remaining: undefined,
        limit: undefined,
        resetInSeconds: undefined,
        updatedAt: 0,
      });
    });

    it('isLow is false when remaining is undefined', () => {
      const tracker = new RateLimitTracker();

      expect(tracker.isLow).toBe(false);
    });
  });

  describe('update()', () => {
    it('parses x-ratelimit-remaining-api from Headers object', () => {
      const tracker = new RateLimitTracker();
      const headers = new Headers({ 'x-ratelimit-remaining-api': '42' });

      tracker.update(headers);

      expect(tracker.state.remaining).toBe(42);
      expect(tracker.state.updatedAt).toBe(Date.now());
    });

    it('parses x-ratelimit-remaining-api from plain object', () => {
      const tracker = new RateLimitTracker();

      tracker.update({ 'x-ratelimit-remaining-api': '25' });

      expect(tracker.state.remaining).toBe(25);
    });

    it('handles mixed-case header keys in plain object for remaining', () => {
      const tracker = new RateLimitTracker();

      tracker.update({ 'X-RateLimit-Remaining-API': '15' });

      expect(tracker.state.remaining).toBe(15);
    });

    it('handles mixed-case header keys in plain object for limit', () => {
      const tracker = new RateLimitTracker();

      tracker.update({ 'X-RateLimit-Limit-API': '60' });

      expect(tracker.state.limit).toBe(60);
    });

    it('handles mixed-case header keys in plain object for reset', () => {
      const tracker = new RateLimitTracker();

      tracker.update({ 'X-RateLimit-Reset-API': '45' });

      expect(tracker.state.resetInSeconds).toBe(45);
    });

    it('updates timestamp even when header is missing', () => {
      const tracker = new RateLimitTracker();
      const headers = new Headers();

      tracker.update(headers);

      expect(tracker.state.remaining).toBeUndefined();
      expect(tracker.state.updatedAt).toBe(Date.now());
    });

    it('ignores invalid (non-numeric) header values', () => {
      const tracker = new RateLimitTracker();

      // First set a valid value
      tracker.update({ 'x-ratelimit-remaining-api': '50' });
      expect(tracker.state.remaining).toBe(50);

      // Then try an invalid value - remaining should stay 50
      tracker.update({ 'x-ratelimit-remaining-api': 'invalid' });
      expect(tracker.state.remaining).toBe(50);
    });

    it('ignores negative header values', () => {
      const tracker = new RateLimitTracker();

      tracker.update({ 'x-ratelimit-remaining-api': '-5' });

      expect(tracker.state.remaining).toBeUndefined();
    });

    it('accepts zero as valid value', () => {
      const tracker = new RateLimitTracker();

      tracker.update({ 'x-ratelimit-remaining-api': '0' });

      expect(tracker.state.remaining).toBe(0);
    });

    it('parses x-ratelimit-limit-api header', () => {
      const tracker = new RateLimitTracker();

      tracker.update({ 'x-ratelimit-limit-api': '60' });

      expect(tracker.state.limit).toBe(60);
    });

    it('parses x-ratelimit-reset-api header', () => {
      const tracker = new RateLimitTracker();

      tracker.update({ 'x-ratelimit-reset-api': '45' });

      expect(tracker.state.resetInSeconds).toBe(45);
    });

    it('parses all three headers together', () => {
      const tracker = new RateLimitTracker();
      const headers = new Headers({
        'x-ratelimit-remaining-api': '59',
        'x-ratelimit-limit-api': '60',
        'x-ratelimit-reset-api': '60',
      });

      tracker.update(headers);

      expect(tracker.state.remaining).toBe(59);
      expect(tracker.state.limit).toBe(60);
      expect(tracker.state.resetInSeconds).toBe(60);
    });
  });

  describe('isLow', () => {
    it('returns false when remaining is above threshold', () => {
      const tracker = new RateLimitTracker(10);

      tracker.update({ 'x-ratelimit-remaining-api': '15' });

      expect(tracker.isLow).toBe(false);
    });

    it('returns true when remaining is below threshold', () => {
      const tracker = new RateLimitTracker(10);

      tracker.update({ 'x-ratelimit-remaining-api': '5' });

      expect(tracker.isLow).toBe(true);
    });

    it('returns true when remaining equals threshold minus one', () => {
      const tracker = new RateLimitTracker(10);

      tracker.update({ 'x-ratelimit-remaining-api': '9' });

      expect(tracker.isLow).toBe(true);
    });

    it('returns false when remaining equals threshold', () => {
      const tracker = new RateLimitTracker(10);

      tracker.update({ 'x-ratelimit-remaining-api': '10' });

      expect(tracker.isLow).toBe(false);
    });

    it('uses default threshold of 10', () => {
      const tracker = new RateLimitTracker();

      tracker.update({ 'x-ratelimit-remaining-api': '9' });
      expect(tracker.isLow).toBe(true);

      tracker.update({ 'x-ratelimit-remaining-api': '10' });
      expect(tracker.isLow).toBe(false);
    });
  });

  describe('reset()', () => {
    it('clears all fields', () => {
      const tracker = new RateLimitTracker();

      tracker.update({
        'x-ratelimit-remaining-api': '42',
        'x-ratelimit-limit-api': '60',
        'x-ratelimit-reset-api': '45',
      });
      expect(tracker.state.remaining).toBe(42);
      expect(tracker.state.limit).toBe(60);
      expect(tracker.state.resetInSeconds).toBe(45);

      tracker.reset();

      expect(tracker.state).toEqual({
        remaining: undefined,
        limit: undefined,
        resetInSeconds: undefined,
        updatedAt: 0,
      });
    });

    it('resets isLow to false', () => {
      const tracker = new RateLimitTracker(10);

      tracker.update({ 'x-ratelimit-remaining-api': '5' });
      expect(tracker.isLow).toBe(true);

      tracker.reset();

      expect(tracker.isLow).toBe(false);
    });
  });

  describe('getThrottleDelay()', () => {
    it('returns 0 when config is undefined', () => {
      const tracker = new RateLimitTracker();
      tracker.update({ 'x-ratelimit-remaining-api': '5' });

      expect(tracker.getThrottleDelay(undefined)).toBe(0);
    });

    it('returns 0 when throttle is not enabled', () => {
      const tracker = new RateLimitTracker();
      tracker.update({ 'x-ratelimit-remaining-api': '5' });

      expect(tracker.getThrottleDelay({ enabled: false })).toBe(0);
    });

    it('returns 0 when remaining is undefined', () => {
      const tracker = new RateLimitTracker();

      expect(tracker.getThrottleDelay({ enabled: true })).toBe(0);
    });

    it('returns 0 when remaining is at or above threshold', () => {
      const tracker = new RateLimitTracker();
      tracker.update({ 'x-ratelimit-remaining-api': '20' });

      expect(tracker.getThrottleDelay({ enabled: true, startThreshold: 20 })).toBe(0);
    });

    it('returns maxDelay when remaining is 0', () => {
      const tracker = new RateLimitTracker();
      tracker.update({ 'x-ratelimit-remaining-api': '0' });

      expect(
        tracker.getThrottleDelay({
          enabled: true,
          startThreshold: 20,
          maxDelay: 2000,
        })
      ).toBe(2000);
    });

    it('calculates linear interpolation between min and max delay', () => {
      const tracker = new RateLimitTracker();
      const config = {
        enabled: true,
        startThreshold: 20,
        minDelay: 100,
        maxDelay: 2000,
      };

      // At threshold (20): 0 delay
      tracker.update({ 'x-ratelimit-remaining-api': '20' });
      expect(tracker.getThrottleDelay(config)).toBe(0);

      // At half (10): ratio = 0.5, delay = 100 + 0.5 * (2000 - 100) = 1050
      tracker.update({ 'x-ratelimit-remaining-api': '10' });
      expect(tracker.getThrottleDelay(config)).toBe(1050);

      // At quarter (5): ratio = 0.75, delay = 100 + 0.75 * 1900 = 1525
      tracker.update({ 'x-ratelimit-remaining-api': '5' });
      expect(tracker.getThrottleDelay(config)).toBe(1525);

      // At 1: ratio = 0.95, delay = 100 + 0.95 * 1900 = 1905
      tracker.update({ 'x-ratelimit-remaining-api': '1' });
      expect(tracker.getThrottleDelay(config)).toBe(1905);
    });

    it('uses default values when not specified', () => {
      const tracker = new RateLimitTracker();

      // Defaults: startThreshold=20, minDelay=100, maxDelay=2000
      tracker.update({ 'x-ratelimit-remaining-api': '10' }); // half

      expect(tracker.getThrottleDelay({ enabled: true })).toBe(1050);
    });

    it('rounds delay to integer', () => {
      const tracker = new RateLimitTracker();
      tracker.update({ 'x-ratelimit-remaining-api': '7' });

      const config = {
        enabled: true,
        startThreshold: 20,
        minDelay: 100,
        maxDelay: 2000,
      };

      // ratio = 1 - 7/20 = 0.65, delay = 100 + 0.65 * 1900 = 1335
      const delay = tracker.getThrottleDelay(config);
      expect(delay).toBe(Math.round(delay));
    });

    it('handles minDelay > maxDelay by swapping them', () => {
      const tracker = new RateLimitTracker();
      tracker.update({ 'x-ratelimit-remaining-api': '0' });

      // Misconfigured: minDelay > maxDelay
      const config = {
        enabled: true,
        startThreshold: 20,
        minDelay: 2000,
        maxDelay: 100,
      };

      // Should swap and return maxDelay (which becomes 2000 after swap)
      expect(tracker.getThrottleDelay(config)).toBe(2000);
    });

    it('calculates correctly when minDelay > maxDelay at intermediate values', () => {
      const tracker = new RateLimitTracker();
      tracker.update({ 'x-ratelimit-remaining-api': '10' }); // half of 20

      // Misconfigured: minDelay > maxDelay
      const config = {
        enabled: true,
        startThreshold: 20,
        minDelay: 2000,
        maxDelay: 100,
      };

      // After swap: minDelay=100, maxDelay=2000
      // ratio = 0.5, delay = 100 + 0.5 * 1900 = 1050
      expect(tracker.getThrottleDelay(config)).toBe(1050);
    });
  });
});
