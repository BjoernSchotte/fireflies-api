import type { RateLimitState, ThrottleConfig } from '../types/config.js';

const RATE_LIMIT_REMAINING_HEADER = 'x-ratelimit-remaining-api';
const RATE_LIMIT_LIMIT_HEADER = 'x-ratelimit-limit-api';
const RATE_LIMIT_RESET_HEADER = 'x-ratelimit-reset-api';

/**
 * Tracks rate limit state from API response headers.
 * Provides state management and throttle delay calculation.
 */
export class RateLimitTracker {
  private _remaining: number | undefined;
  private _limit: number | undefined;
  private _resetInSeconds: number | undefined;
  private _updatedAt: number;
  private readonly warningThreshold: number;

  /**
   * Create a new RateLimitTracker.
   * @param warningThreshold - Threshold below which isLow returns true
   */
  constructor(warningThreshold = 10) {
    this._remaining = undefined;
    this._limit = undefined;
    this._resetInSeconds = undefined;
    this._updatedAt = 0;
    this.warningThreshold = warningThreshold;
  }

  /**
   * Get the current rate limit state.
   */
  get state(): RateLimitState {
    return {
      remaining: this._remaining,
      limit: this._limit,
      resetInSeconds: this._resetInSeconds,
      updatedAt: this._updatedAt,
    };
  }

  /**
   * Check if remaining requests are below the warning threshold.
   * Returns false if remaining is undefined (header not received).
   */
  get isLow(): boolean {
    return this._remaining !== undefined && this._remaining < this.warningThreshold;
  }

  /**
   * Update state from response headers.
   * Extracts x-ratelimit-remaining-api, x-ratelimit-limit-api, and x-ratelimit-reset-api headers.
   *
   * @param headers - Response headers (Headers object or plain object)
   */
  update(headers: Headers | Record<string, string>): void {
    const remaining = this.getHeader(headers, RATE_LIMIT_REMAINING_HEADER);
    if (remaining !== null) {
      const parsed = Number.parseInt(remaining, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        this._remaining = parsed;
      }
    }

    const limit = this.getHeader(headers, RATE_LIMIT_LIMIT_HEADER);
    if (limit !== null) {
      const parsed = Number.parseInt(limit, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        this._limit = parsed;
      }
    }

    const reset = this.getHeader(headers, RATE_LIMIT_RESET_HEADER);
    if (reset !== null) {
      const parsed = Number.parseInt(reset, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        this._resetInSeconds = parsed;
      }
    }

    this._updatedAt = Date.now();
  }

  /**
   * Reset the tracker to initial state.
   */
  reset(): void {
    this._remaining = undefined;
    this._limit = undefined;
    this._resetInSeconds = undefined;
    this._updatedAt = 0;
  }

  /**
   * Calculate the delay to apply before the next request.
   * Returns 0 if throttling is disabled or not needed.
   *
   * Uses linear interpolation: more delay as remaining approaches 0.
   * - remaining >= startThreshold: no delay
   * - remaining = 0: maxDelay
   * - remaining in between: proportional delay
   *
   * @param config - Throttle configuration
   * @returns Delay in milliseconds
   */
  getThrottleDelay(config?: ThrottleConfig): number {
    if (!config?.enabled) {
      return 0;
    }

    if (this._remaining === undefined) {
      return 0;
    }

    const startThreshold = config.startThreshold ?? 20;
    let minDelay = config.minDelay ?? 100;
    let maxDelay = config.maxDelay ?? 2000;

    // Handle misconfiguration: swap if minDelay > maxDelay
    if (minDelay > maxDelay) {
      [minDelay, maxDelay] = [maxDelay, minDelay];
    }

    if (this._remaining >= startThreshold) {
      return 0;
    }

    if (this._remaining <= 0) {
      return maxDelay;
    }

    // Linear interpolation: ratio goes from 0 (at threshold) to 1 (at 0)
    const ratio = 1 - this._remaining / startThreshold;
    return Math.round(minDelay + ratio * (maxDelay - minDelay));
  }

  /**
   * Extract a header value from Headers object or plain object.
   * For plain objects, performs case-insensitive key lookup.
   */
  private getHeader(headers: Headers | Record<string, string>, name: string): string | null {
    if (headers instanceof Headers) {
      return headers.get(name);
    }
    // Plain object - case-insensitive key lookup
    const lowerName = name.toLowerCase();
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === lowerName) {
        return headers[key] ?? null;
      }
    }
    return null;
  }
}
