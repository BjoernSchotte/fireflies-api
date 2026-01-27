/**
 * Search-related types for searching across transcript content.
 */

/**
 * Options for searching transcripts.
 */
export interface SearchParams {
  // Search behavior
  /**
   * Whether to match case when searching.
   * @default false
   */
  caseSensitive?: boolean;

  /**
   * Where to search: 'title' searches transcript titles only,
   * 'sentences' searches transcript content, 'all' searches both.
   * @default 'sentences'
   */
  scope?: 'title' | 'sentences' | 'all';

  // Result filtering
  /**
   * Filter results to only include sentences from these speakers.
   * Case-insensitive matching.
   */
  speakers?: string[];

  /**
   * Only include sentences marked as questions by AI.
   */
  filterQuestions?: boolean;

  /**
   * Only include sentences marked as tasks/action items by AI.
   */
  filterTasks?: boolean;

  // Context
  /**
   * Number of sentences to include before and after each match.
   * @default 1
   */
  contextLines?: number;

  // Transcript filtering (same as TranscriptsListParams)
  /**
   * Filter transcripts from this date (ISO 8601 format).
   */
  fromDate?: string;

  /**
   * Filter transcripts to this date (ISO 8601 format).
   */
  toDate?: string;

  /**
   * Only include transcripts owned by the authenticated user.
   */
  mine?: boolean;

  /**
   * Filter by organizer email addresses.
   */
  organizers?: string[];

  /**
   * Filter by participant email addresses.
   */
  participants?: string[];

  /**
   * Filter by user ID.
   */
  user_id?: string;

  /**
   * Filter by channel ID.
   */
  channel_id?: string;

  // Pagination
  /**
   * Maximum number of transcripts to search.
   * If not specified, searches all matching transcripts.
   */
  limit?: number;
}

/**
 * Options for the pure searchTranscript helper function.
 */
export interface SearchTranscriptOptions {
  /**
   * The search query string.
   */
  query: string;

  /**
   * Whether to match case when searching.
   * @default false
   */
  caseSensitive?: boolean;

  /**
   * Filter results to only include sentences from these speakers.
   * Case-insensitive matching.
   */
  speakers?: string[];

  /**
   * Only include sentences marked as questions by AI.
   */
  filterQuestions?: boolean;

  /**
   * Only include sentences marked as tasks/action items by AI.
   */
  filterTasks?: boolean;

  /**
   * Number of sentences to include before and after each match.
   * @default 1
   */
  contextLines?: number;
}

/**
 * A single matched sentence with context from a transcript search.
 */
export interface SearchMatch {
  /**
   * ID of the transcript containing the match.
   */
  transcriptId: string;

  /**
   * Title of the transcript containing the match.
   */
  transcriptTitle: string;

  /**
   * Date of the transcript (ISO 8601 format).
   */
  transcriptDate: string;

  /**
   * URL to view the transcript on Fireflies.ai.
   */
  transcriptUrl: string;

  /**
   * The matched sentence details.
   */
  sentence: {
    /**
     * Index of the sentence in the transcript (0-based).
     */
    index: number;

    /**
     * Text content of the sentence.
     */
    text: string;

    /**
     * Name of the speaker.
     */
    speakerName: string;

    /**
     * Start time in seconds.
     */
    startTime: number;

    /**
     * End time in seconds.
     */
    endTime: number;

    /**
     * Whether the AI marked this sentence as a question.
     */
    isQuestion: boolean;

    /**
     * Whether the AI marked this sentence as a task/action item.
     */
    isTask: boolean;
  };

  /**
   * Context sentences before and after the match.
   */
  context: {
    /**
     * Sentences appearing before the match.
     */
    before: Array<{ speakerName: string; text: string }>;

    /**
     * Sentences appearing after the match.
     */
    after: Array<{ speakerName: string; text: string }>;
  };
}

/**
 * Results from a transcript search operation.
 */
export interface SearchResults {
  /**
   * The original search query.
   */
  query: string;

  /**
   * The search options that were used.
   */
  options: SearchParams;

  /**
   * Total number of matching sentences found.
   */
  totalMatches: number;

  /**
   * Number of transcripts that were searched.
   */
  transcriptsSearched: number;

  /**
   * Number of transcripts that had at least one match.
   */
  transcriptsWithMatches: number;

  /**
   * All matching sentences with context.
   */
  matches: SearchMatch[];
}
