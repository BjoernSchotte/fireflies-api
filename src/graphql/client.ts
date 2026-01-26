import {
  FirefliesError,
  GraphQLError,
  type GraphQLErrorDetail,
  NetworkError,
  parseErrorResponse,
  TimeoutError,
} from '../errors.js';
import type { FirefliesConfig, RetryConfig } from '../types/config.js';
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

  constructor(config: FirefliesConfig) {
    if (!config.apiKey) {
      throw new FirefliesError('API key is required');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.retryOptions = buildRetryOptions(config.retry);
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

      if (!response.ok) {
        const body = await this.safeParseJson(response);
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
