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
