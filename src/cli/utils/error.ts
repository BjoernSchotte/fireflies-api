import {
  AuthenticationError,
  FirefliesError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '../../errors.js';

/**
 * Handle an error and exit with appropriate code.
 */
export function handleError(error: unknown): never {
  if (error instanceof AuthenticationError) {
    console.error('Authentication failed: Check your API key');
    process.exit(1);
  }

  if (error instanceof NotFoundError) {
    console.error(`Not found: ${error.message}`);
    process.exit(1);
  }

  if (error instanceof RateLimitError) {
    console.error(`Rate limited: ${error.message}`);
    process.exit(1);
  }

  if (error instanceof ValidationError) {
    console.error(`Validation error: ${error.message}`);
    process.exit(1);
  }

  if (error instanceof FirefliesError) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }

  if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }

  console.error('An unexpected error occurred');
  process.exit(1);
}

/**
 * Wrap an async action with error handling.
 */
export function withErrorHandling<T extends unknown[]>(
  fn: (...args: T) => Promise<void>
): (...args: T) => Promise<void> {
  return async (...args: T) => {
    try {
      await fn(...args);
    } catch (error) {
      handleError(error);
    }
  };
}
