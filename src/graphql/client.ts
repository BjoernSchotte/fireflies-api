import {
  FirefliesError,
  GraphQLError,
  type GraphQLErrorDetail,
  NetworkError,
  parseErrorResponse,
  TimeoutError,
} from '../errors.js';
import type {
  FirefliesConfig,
  RateLimitConfig,
  RateLimitState,
  RetryConfig,
} from '../types/config.js';
import { RateLimitTracker } from '../utils/rate-limit-tracker.js';
import { type RetryOptions, retry } from '../utils/retry.js';

const DEFAULT_BASE_URL = 'https://api.fireflies.ai/graphql';
const DEFAULT_TIMEOUT = 30000;

/**
 * Response structure from GraphQL API.
 */
interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLErrorDetail[];
}

/**
 * Low-level GraphQL client for Fireflies API.
 * Handles authentication, retries, and error parsing.
 */
export class GraphQLClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly retryOptions: RetryOptions;
  private readonly rateLimitTracker: RateLimitTracker | null;
  private readonly rateLimitConfig: RateLimitConfig | null;
  private lastWarningRemaining: number | undefined;

  constructor(config: FirefliesConfig) {
    if (!config.apiKey) {
      throw new FirefliesError('API key is required');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.retryOptions = buildRetryOptions(config.retry);

    // Initialize rate limit tracking if configured
    if (config.rateLimit) {
      const warningThreshold = config.rateLimit.warningThreshold ?? 10;
      this.rateLimitTracker = new RateLimitTracker(warningThreshold);
      this.rateLimitConfig = config.rateLimit;
    } else {
      this.rateLimitTracker = null;
      this.rateLimitConfig = null;
    }
  }

  /**
   * Get the current rate limit state.
   * Returns undefined if rate limit tracking is not configured.
   */
  get rateLimitState(): RateLimitState | undefined {
    return this.rateLimitTracker?.state;
  }

  /**
   * Execute a GraphQL query or mutation.
   *
   * @param query - GraphQL query string
   * @param variables - Optional query variables
   * @returns The data from the GraphQL response
   * @throws GraphQLError if the response contains errors
   * @throws AuthenticationError if the API key is invalid
   * @throws RateLimitError if rate limits are exceeded
   */
  async execute<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    return retry(() => this.executeOnce<T>(query, variables), this.retryOptions);
  }

  private async executeOnce<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    // Apply throttle delay if enabled
    await this.applyThrottleDelay();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Update rate limit tracker from response headers
      this.updateRateLimitState(response.headers);

      if (!response.ok) {
        const body = await this.safeParseJson(response);

        // Handle rate limit error specially
        if (response.status === 429) {
          const retryAfter = this.parseRetryAfter(response.headers);
          this.invokeRateLimitedCallback(retryAfter);
          throw parseErrorResponse(
            response.status,
            body,
            `GraphQL request failed with status ${response.status}`
          );
        }

        throw parseErrorResponse(
          response.status,
          body,
          `GraphQL request failed with status ${response.status}`
        );
      }

      const json = (await response.json()) as GraphQLResponse<T>;

      if (json.errors && json.errors.length > 0) {
        throw this.parseGraphQLErrors(json.errors);
      }

      if (json.data === undefined) {
        throw new FirefliesError('GraphQL response missing data field');
      }

      return json.data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof FirefliesError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new TimeoutError(`Request timed out after ${this.timeout}ms`);
        }
        throw new NetworkError(`Network request failed: ${error.message}`, error);
      }

      throw new NetworkError('Unknown network error occurred', error);
    }
  }

  private async safeParseJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Apply throttle delay before request if configured.
   */
  private async applyThrottleDelay(): Promise<void> {
    if (!this.rateLimitTracker || !this.rateLimitConfig?.throttle) {
      return;
    }

    const delay = this.rateLimitTracker.getThrottleDelay(this.rateLimitConfig.throttle);
    if (delay > 0) {
      await sleep(delay);
    }
  }

  /**
   * Update rate limit state from response headers and invoke callbacks.
   */
  private updateRateLimitState(headers: Headers): void {
    if (!this.rateLimitTracker || !this.rateLimitConfig) {
      return;
    }

    const wasLow = this.rateLimitTracker.isLow;

    this.rateLimitTracker.update(headers);

    const state = this.rateLimitTracker.state;

    // Always invoke onUpdate callback
    this.safeCallback(() => this.rateLimitConfig?.onUpdate?.(state));

    // Invoke onWarning when crossing the threshold (going from above to below)
    // Also invoke if we haven't warned yet at this level
    if (this.rateLimitTracker.isLow) {
      const shouldWarn =
        !wasLow || // Just crossed threshold
        (state.remaining !== undefined &&
          this.lastWarningRemaining !== undefined &&
          state.remaining < this.lastWarningRemaining); // Dropped further

      if (shouldWarn) {
        this.lastWarningRemaining = state.remaining;
        this.safeCallback(() => this.rateLimitConfig?.onWarning?.(state));
      }
    }
  }

  /**
   * Parse Retry-After header value.
   */
  private parseRetryAfter(headers: Headers): number | undefined {
    const value = headers.get('retry-after');
    if (!value) return undefined;

    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  /**
   * Invoke the onRateLimited callback.
   */
  private invokeRateLimitedCallback(retryAfter?: number): void {
    if (!this.rateLimitTracker || !this.rateLimitConfig?.onRateLimited) {
      return;
    }
    const state = this.rateLimitTracker.state;
    this.safeCallback(() => this.rateLimitConfig?.onRateLimited?.(state, retryAfter));
  }

  /**
   * Safely invoke a callback, catching any errors to prevent user code from breaking the SDK.
   */
  private safeCallback(fn: () => void): void {
    try {
      fn();
    } catch {
      // Ignore callback errors
    }
  }

  private parseGraphQLErrors(errors: GraphQLErrorDetail[]): FirefliesError {
    const firstError = errors[0];
    if (!firstError) {
      return new GraphQLError('Unknown GraphQL error', errors);
    }

    const message = firstError.message;

    // Check for specific error types based on message content
    if (
      message.toLowerCase().includes('unauthorized') ||
      message.toLowerCase().includes('authentication')
    ) {
      return parseErrorResponse(401, { message }, message);
    }

    if (message.toLowerCase().includes('not found')) {
      return parseErrorResponse(404, { message }, message);
    }

    return new GraphQLError(message, errors);
  }
}

function buildRetryOptions(config?: RetryConfig): RetryOptions {
  if (!config) {
    return {};
  }
  return {
    maxRetries: config.maxRetries,
    baseDelay: config.baseDelay,
    maxDelay: config.maxDelay,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
