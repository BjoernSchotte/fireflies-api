import ora, { type Ora } from 'ora';

/**
 * Options for creating a progress indicator.
 */
export interface ProgressOptions {
  /** Whether progress is enabled. */
  enabled: boolean;
  /** Initial text to display. */
  text?: string;
}

/**
 * Create a progress spinner.
 *
 * Returns null if progress is disabled or stdout is not a TTY.
 * The spinner writes to stderr to avoid interfering with piped output.
 *
 * @param opts - Progress options
 * @returns Ora spinner instance or null
 */
export function createProgress(opts: ProgressOptions): Ora | null {
  if (!opts.enabled || !process.stderr.isTTY) {
    return null;
  }
  return ora({ text: opts.text, stream: process.stderr });
}

/**
 * Execute a task with progress indication.
 *
 * Shows a spinner while the task runs, updating text via the callback.
 * Spinner shows success/failure state when complete.
 *
 * @param opts - Progress options
 * @param task - Async function to execute, receives an update callback
 * @returns Result of the task
 *
 * @example
 * ```typescript
 * const result = await withProgress(
 *   { enabled: true, text: 'Loading...' },
 *   async (update) => {
 *     for await (const item of items) {
 *       count++;
 *       update(`Loading... ${count}`);
 *     }
 *     return items;
 *   }
 * );
 * ```
 */
export async function withProgress<T>(
  opts: ProgressOptions,
  task: (update: (text: string) => void) => Promise<T>
): Promise<T> {
  const spinner = createProgress(opts);
  spinner?.start();

  const update = (text: string): void => {
    if (spinner) {
      spinner.text = text;
    }
  };

  try {
    const result = await task(update);
    spinner?.succeed();
    return result;
  } catch (err) {
    spinner?.fail();
    throw err;
  }
}
