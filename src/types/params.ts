/**
 * Scope for transcript search queries.
 */
export type TranscriptsQueryScope = 'title' | 'sentences' | 'all';

/**
 * Parameters for listing transcripts.
 */
export interface TranscriptsListParams {
  // Search options

  /**
   * Search keyword. Searches title and/or content based on scope.
   * This is the recommended search parameter (replaces title).
   */
  keyword?: string;

  /**
   * Where to search for the keyword.
   * - 'title': Search only in titles
   * - 'sentences': Search only in transcript content
   * - 'all': Search in both title and content
   * @default 'all'
   */
  scope?: TranscriptsQueryScope;

  // Filter options

  /**
   * Filter by organizer emails (array).
   * Use this instead of the deprecated organizer_email.
   */
  organizers?: string[];

  /**
   * Filter by participant emails (array).
   * Use this instead of the deprecated participant_email.
   */
  participants?: string[];

  /**
   * Filter by specific user ID.
   */
  user_id?: string;

  /**
   * Only return transcripts owned by the authenticated user.
   */
  mine?: boolean;

  /**
   * Filter by channel ID (v2.11.0+).
   */
  channel_id?: string;

  // Date range options

  /**
   * Start of date range (ISO 8601 string).
   * Returns transcripts from this date onwards.
   */
  fromDate?: string;

  /**
   * End of date range (ISO 8601 string).
   * Returns transcripts up to this date.
   */
  toDate?: string;

  // Pagination options

  /**
   * Maximum number of transcripts to return.
   * @default 50
   * @max 50
   */
  limit?: number;

  /**
   * Number of transcripts to skip (for pagination).
   * @default 0
   */
  skip?: number;

  // Deprecated options (still supported for backwards compatibility)

  /**
   * Search by title only.
   * @deprecated Use keyword with scope='title' instead.
   */
  title?: string;

  /**
   * Filter by host email.
   * @deprecated Use organizers instead.
   */
  host_email?: string;

  /**
   * Filter by organizer email (single).
   * @deprecated Use organizers array instead.
   */
  organizer_email?: string;

  /**
   * Filter by participant email (single).
   * @deprecated Use participants array instead.
   */
  participant_email?: string;

  /**
   * Filter by date (Unix timestamp).
   * @deprecated Use fromDate and toDate instead.
   */
  date?: number;
}

/**
 * Parameters for getting a single transcript.
 */
export interface TranscriptGetParams {
  /**
   * Include the full sentences array.
   * Set to false for faster response when you only need metadata.
   * @default true
   */
  includeSentences?: boolean;

  /**
   * Include the summary object.
   * @default true
   */
  includeSummary?: boolean;
}
