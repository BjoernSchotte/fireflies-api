import type { MeetingState } from './meeting.js';

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

// === Bites ===

/**
 * Parameters for listing bites.
 */
export interface BitesListParams {
  /** Filter by transcript ID */
  transcript_id?: string;
  /** Only my bites */
  mine?: boolean;
  /** All team bites */
  my_team?: boolean;
  /** Max results (max 50) */
  limit?: number;
  /** Pagination offset */
  skip?: number;
}

/**
 * Parameters for creating a bite.
 */
export interface CreateBiteParams {
  /** Transcript ID */
  transcript_id: string;
  /** Start time in seconds */
  start_time: number;
  /** End time in seconds */
  end_time: number;
  /** Bite name (max 256 chars) */
  name?: string;
  /** Media type: 'video' or 'audio' */
  media_type?: 'video' | 'audio';
  /** Summary (max 500 chars) */
  summary?: string;
  /** Privacy settings */
  privacies?: Array<'public' | 'team' | 'participants'>;
}

// === Meetings ===

/**
 * Parameters for listing active meetings.
 */
export interface ActiveMeetingsParams {
  /** Filter by user email (admin only for other users) */
  email?: string;
  /** Filter by state */
  states?: MeetingState[];
}

/**
 * Parameters for adding a bot to a meeting.
 */
export interface AddBotParams {
  /** Meeting URL (Zoom, Google Meet, etc.) */
  meeting_link: string;
  /** Meeting title (max 256 chars) */
  title?: string;
  /** Meeting password (max 32 chars) */
  password?: string;
  /** Duration in minutes (15-120, default 60) */
  duration?: number;
  /** Language code */
  language?: string;
}

// === Audio ===

/**
 * Attendee for audio upload.
 */
export interface UploadAudioAttendee {
  displayName?: string;
  email?: string;
  phoneNumber?: string;
}

/**
 * Parameters for uploading audio for transcription.
 */
export interface UploadAudioParams {
  /** Public URL of audio/video file */
  url: string;
  /** Title for the transcript (max 256 chars) */
  title?: string;
  /** Webhook URL for completion notification */
  webhook?: string;
  /** Language code */
  custom_language?: string;
  /** Save video if applicable */
  save_video?: boolean;
  /** Meeting attendees */
  attendees?: UploadAudioAttendee[];
  /** Custom reference ID (max 128 chars) */
  client_reference_id?: string;
  /** Allow files < 50kb */
  bypass_size_check?: boolean;
}

// === AI Apps ===

/**
 * Parameters for listing AI App outputs.
 */
export interface AIAppsListParams {
  /** Filter by app ID */
  app_id?: string;
  /** Filter by transcript ID */
  transcript_id?: string;
  /** Max results (max 10) */
  limit?: number;
  /** Pagination offset */
  skip?: number;
}
