import { describe, expect, it } from 'vitest';
import {
  AuthenticationError,
  FirefliesError,
  GraphQLError,
  NetworkError,
  NotFoundError,
  parseErrorResponse,
  RateLimitError,
  TimeoutError,
  ValidationError,
} from '../../src/errors.js';

describe('FirefliesError', () => {
  it('creates error with message', () => {
    const error = new FirefliesError('Something went wrong');

    expect(error.message).toBe('Something went wrong');
    expect(error.name).toBe('FirefliesError');
    expect(error.code).toBe('FIREFLIES_ERROR');
    expect(error.status).toBeUndefined();
  });

  it('creates error with status', () => {
    const error = new FirefliesError('Bad request', { status: 400 });

    expect(error.status).toBe(400);
  });

  it('creates error with cause', () => {
    const cause = new Error('Original error');
    const error = new FirefliesError('Wrapped error', { cause });

    expect(error.cause).toBe(cause);
  });
});

describe('AuthenticationError', () => {
  it('creates error with default message', () => {
    const error = new AuthenticationError();

    expect(error.message).toBe('Invalid or missing API key');
    expect(error.name).toBe('AuthenticationError');
    expect(error.code).toBe('AUTHENTICATION_ERROR');
    expect(error.status).toBe(401);
  });

  it('creates error with custom message', () => {
    const error = new AuthenticationError('Token expired');

    expect(error.message).toBe('Token expired');
  });
});

describe('RateLimitError', () => {
  it('creates error with default message', () => {
    const error = new RateLimitError();

    expect(error.message).toBe('Rate limit exceeded');
    expect(error.name).toBe('RateLimitError');
    expect(error.code).toBe('RATE_LIMIT_ERROR');
    expect(error.status).toBe(429);
    expect(error.retryAfter).toBeUndefined();
  });

  it('creates error with retryAfter', () => {
    const error = new RateLimitError('Slow down', 30);

    expect(error.retryAfter).toBe(30);
  });
});

describe('NotFoundError', () => {
  it('creates error with default message', () => {
    const error = new NotFoundError();

    expect(error.message).toBe('Resource not found');
    expect(error.name).toBe('NotFoundError');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.status).toBe(404);
  });
});

describe('ValidationError', () => {
  it('creates error with message', () => {
    const error = new ValidationError('Invalid email format');

    expect(error.message).toBe('Invalid email format');
    expect(error.name).toBe('ValidationError');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.status).toBe(400);
  });
});

describe('GraphQLError', () => {
  it('creates error with errors array', () => {
    const errors = [
      { message: 'Field not found', path: ['transcript', 'invalid'] },
      { message: 'Another error' },
    ];
    const error = new GraphQLError('Query failed', errors);

    expect(error.message).toBe('Query failed');
    expect(error.name).toBe('GraphQLError');
    expect(error.code).toBe('GRAPHQL_ERROR');
    expect(error.errors).toEqual(errors);
  });
});

describe('TimeoutError', () => {
  it('creates error with default message', () => {
    const error = new TimeoutError();

    expect(error.message).toBe('Request timed out');
    expect(error.name).toBe('TimeoutError');
    expect(error.code).toBe('TIMEOUT_ERROR');
    expect(error.status).toBe(408);
  });
});

describe('NetworkError', () => {
  it('creates error with message and cause', () => {
    const cause = new TypeError('fetch failed');
    const error = new NetworkError('Network request failed', cause);

    expect(error.message).toBe('Network request failed');
    expect(error.name).toBe('NetworkError');
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.cause).toBe(cause);
  });
});

describe('parseErrorResponse', () => {
  it('returns AuthenticationError for 401', () => {
    const error = parseErrorResponse(401, { message: 'Unauthorized' }, 'Default');

    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error.message).toBe('Unauthorized');
  });

  it('returns NotFoundError for 404', () => {
    const error = parseErrorResponse(404, { message: 'Not found' }, 'Default');

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.message).toBe('Not found');
  });

  it('returns RateLimitError for 429 with retryAfter', () => {
    const error = parseErrorResponse(
      429,
      { message: 'Too many requests', retryAfter: 60 },
      'Default'
    );

    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAfter).toBe(60);
  });

  it('returns ValidationError for 400', () => {
    const error = parseErrorResponse(400, { message: 'Bad input' }, 'Default');

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toBe('Bad input');
  });

  it('returns generic FirefliesError for other status codes', () => {
    const error = parseErrorResponse(500, { error: 'Server error' }, 'Default');

    expect(error).toBeInstanceOf(FirefliesError);
    expect(error.message).toBe('Server error');
    expect(error.status).toBe(500);
  });

  it('uses default message when body has no message', () => {
    const error = parseErrorResponse(500, null, 'Default message');

    expect(error.message).toBe('Default message');
  });

  it('extracts error field from body', () => {
    const error = parseErrorResponse(500, { error: 'Error from body' }, 'Default');

    expect(error.message).toBe('Error from body');
  });
});
