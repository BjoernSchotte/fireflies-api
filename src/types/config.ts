/**
 * Configuration options for the Fireflies client.
 */
export interface FirefliesConfig {
  /**
   * Your Fireflies API key.
   * Get one from: https://app.fireflies.ai/integrations/custom/fireflies
   */
  apiKey: string;

  /**
   * Base URL for the GraphQL API.
   * @default 'https://api.fireflies.ai/graphql'
   */
  baseUrl?: string;

  /**
   * Request timeout in milliseconds.
   * @default 30000
   */
  timeout?: number;

  /**
   * Retry configuration for transient failures.
   */
  retry?: RetryConfig;

  /**
   * Rate limit tracking and throttling configuration.
   * Optional - if not provided, rate limit headers are not tracked.
   */
  rateLimit?: RateLimitConfig;
}

/**
 * Configuration for retry behavior on transient failures.
 */
export interface RetryConfig {
  /**
   * Maximum number of retry attempts.
   * @default 3
   */
  maxRetries?: number;

  /**
   * Base delay between retries in milliseconds.
   * @default 1000
   */
  baseDelay?: number;

  /**
   * Maximum delay between retries in milliseconds.
   * @default 30000
   */
  maxDelay?: number;
}

/**
 * Current rate limit state from API responses.
 */
export interface RateLimitState {
  /**
   * Remaining requests in current window (from x-ratelimit-remaining-api header).
   * Undefined if header was not present in the last response.
   */
  remaining?: number;

  /**
   * Maximum requests allowed in current window (from x-ratelimit-limit-api header).
   * Undefined if header was not present in the last response.
   */
  limit?: number;

  /**
   * Seconds until the rate limit window resets (from x-ratelimit-reset-api header).
   * Undefined if header was not present in the last response.
   */
  resetInSeconds?: number;

  /**
   * Timestamp (ms since epoch) when this state was last updated.
   */
  updatedAt: number;
}

/**
 * Configuration for adaptive throttling behavior.
 * When enabled, requests are proactively delayed when approaching rate limits.
 */
export interface ThrottleConfig {
  /**
   * Enable adaptive throttling.
   * Must be explicitly set to true to enable.
   */
  enabled: boolean;

  /**
   * Start throttling when remaining requests falls below this threshold.
   * @default 20
   */
  startThreshold?: number;

  /**
   * Minimum delay between requests in milliseconds.
   * @default 100
   */
  minDelay?: number;

  /**
   * Maximum delay when nearly exhausted in milliseconds.
   * @default 2000
   */
  maxDelay?: number;
}

/**
 * Configuration for rate limit tracking and callbacks.
 */
export interface RateLimitConfig {
  /**
   * Called after each request with the updated rate limit state.
   */
  onUpdate?: (state: RateLimitState) => void;

  /**
   * Called when remaining requests falls below the warning threshold.
   */
  onWarning?: (state: RateLimitState) => void;

  /**
   * Called when a 429 rate limit error is received.
   * @param state - Current rate limit state
   * @param retryAfter - Seconds to wait before retrying (if provided by server)
   */
  onRateLimited?: (state: RateLimitState, retryAfter?: number) => void;

  /**
   * Warning threshold for remaining requests.
   * When remaining falls below this, onWarning is called.
   * @default 10
   */
  warningThreshold?: number;

  /**
   * Optional adaptive throttling configuration.
   * Disabled by default.
   */
  throttle?: ThrottleConfig;
}
