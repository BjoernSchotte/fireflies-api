/**
 * Base error class for all Fireflies API errors.
 * All errors include a code for programmatic handling.
 */
export class FirefliesError extends Error {
  readonly code: string = 'FIREFLIES_ERROR';
  readonly status?: number;

  constructor(message: string, options?: { status?: number; cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.name = 'FirefliesError';
    this.status = options?.status;
  }
}

/**
 * Thrown when the API key is invalid or missing.
 */
export class AuthenticationError extends FirefliesError {
  override readonly code = 'AUTHENTICATION_ERROR';

  constructor(message = 'Invalid or missing API key') {
    super(message, { status: 401 });
    this.name = 'AuthenticationError';
  }
}

/**
 * Thrown when rate limits are exceeded.
 * Check retryAfter for suggested wait time in milliseconds.
 */
export class RateLimitError extends FirefliesError {
  override readonly code = 'RATE_LIMIT_ERROR';
  /** Suggested wait time in milliseconds before retrying. */
  readonly retryAfter?: number;

  constructor(message = 'Rate limit exceeded', retryAfter?: number) {
    super(message, { status: 429 });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Thrown when a requested resource is not found.
 */
export class NotFoundError extends FirefliesError {
  override readonly code = 'NOT_FOUND';

  constructor(message = 'Resource not found') {
    super(message, { status: 404 });
    this.name = 'NotFoundError';
  }
}

/**
 * Thrown when request validation fails.
 */
export class ValidationError extends FirefliesError {
  override readonly code = 'VALIDATION_ERROR';

  constructor(message: string) {
    super(message, { status: 400 });
    this.name = 'ValidationError';
  }
}

/**
 * Thrown when the GraphQL API returns errors.
 */
export class GraphQLError extends FirefliesError {
  override readonly code = 'GRAPHQL_ERROR';
  readonly errors: GraphQLErrorDetail[];

  constructor(message: string, errors: GraphQLErrorDetail[]) {
    super(message);
    this.name = 'GraphQLError';
    this.errors = errors;
  }
}

/**
 * Detail from a GraphQL error response.
 */
export interface GraphQLErrorDetail {
  message: string;
  path?: string[];
  extensions?: Record<string, unknown>;
}

/**
 * Thrown when a request times out.
 */
export class TimeoutError extends FirefliesError {
  override readonly code = 'TIMEOUT_ERROR';

  constructor(message = 'Request timed out') {
    super(message, { status: 408 });
    this.name = 'TimeoutError';
  }
}

/**
 * Thrown when a network error occurs.
 */
export class NetworkError extends FirefliesError {
  override readonly code = 'NETWORK_ERROR';

  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'NetworkError';
  }
}

/**
 * Base error for realtime operations.
 */
export class RealtimeError extends FirefliesError {
  override readonly code: string = 'REALTIME_ERROR';

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'RealtimeError';
  }
}

/**
 * Thrown when realtime connection fails.
 */
export class ConnectionError extends RealtimeError {
  override readonly code = 'CONNECTION_ERROR';

  constructor(message = 'Failed to establish realtime connection', options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ConnectionError';
  }
}

/**
 * Thrown when stream is accessed after close.
 */
export class StreamClosedError extends RealtimeError {
  override readonly code = 'STREAM_CLOSED';

  constructor(message = 'Stream has been closed') {
    super(message);
    this.name = 'StreamClosedError';
  }
}

/**
 * Thrown when no chunks received for configured timeout.
 * Consumer should check if meeting is still active and decide whether to reconnect.
 */
export class ChunkTimeoutError extends RealtimeError {
  override readonly code = 'CHUNK_TIMEOUT';
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`No chunks received for ${timeoutMs}ms`);
    this.name = 'ChunkTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Parse error response and return appropriate error class.
 */
export function parseErrorResponse(
  status: number,
  body: unknown,
  defaultMessage: string
): FirefliesError {
  const message = extractErrorMessage(body) ?? defaultMessage;

  switch (status) {
    case 401:
      return new AuthenticationError(message);
    case 404:
      return new NotFoundError(message);
    case 429: {
      const retryAfter = extractRetryAfter(body);
      return new RateLimitError(message, retryAfter);
    }
    case 400:
      return new ValidationError(message);
    default:
      return new FirefliesError(message, { status });
  }
}

function extractErrorMessage(body: unknown): string | undefined {
  if (typeof body === 'object' && body !== null) {
    const obj = body as Record<string, unknown>;
    if (typeof obj['message'] === 'string') {
      return obj['message'];
    }
    if (typeof obj['error'] === 'string') {
      return obj['error'];
    }
  }
  return undefined;
}

function extractRetryAfter(body: unknown): number | undefined {
  if (typeof body === 'object' && body !== null) {
    const obj = body as Record<string, unknown>;
    if (typeof obj['retryAfter'] === 'number') {
      return obj['retryAfter'];
    }
  }
  return undefined;
}
