/**
 * A meeting transcript from Fireflies.
 */
export interface Transcript {
  /** Unique identifier for the transcript */
  id: string;
  /** Title of the meeting */
  title: string;
  /** Email of the meeting organizer */
  organizer_email: string;
  /**
   * Email of the meeting host
   * @deprecated Use organizer_email instead
   */
  host_email?: string;
  /** User who owns this transcript */
  user?: User;
  /** List of speakers identified in the transcript */
  speakers: Speaker[];
  /** URL to view the transcript in Fireflies app */
  transcript_url: string;
  /** List of participant email addresses */
  participants: string[];
  /** Detailed attendee information from calendar invite */
  meeting_attendees: MeetingAttendee[];
  /** Attendance tracking with join/leave times (v2.10.0+) */
  meeting_attendance: MeetingAttendance[];
  /** Fireflies user IDs with access */
  fireflies_users: string[];
  /** Workspace user IDs with access (v2.20.0+) */
  workspace_users: string[];
  /** Duration of the meeting in seconds */
  duration: number;
  /** ISO 8601 date string of the meeting */
  dateString: string;
  /** Unix timestamp in milliseconds */
  date: number;
  /**
   * URL to download audio (expires after 24h).
   * Requires Pro plan or higher.
   */
  audio_url?: string;
  /**
   * URL to download video (expires after 24h).
   * Requires Business plan or higher.
   */
  video_url?: string;
  /** Transcribed sentences with speaker attribution */
  sentences: Sentence[];
  /** Calendar event ID */
  calendar_id?: string;
  /** AI-generated meeting summary */
  summary?: Summary;
  /** Meeting metadata and processing status */
  meeting_info?: MeetingInfo;
  /** Alternative calendar ID field */
  cal_id?: string;
  /** Type of calendar (google, outlook, etc.) */
  calendar_type?: string;
  /** AI Apps output preview */
  apps_preview?: AppsPreview;
  /** Link to the original meeting */
  meeting_link?: string;
  /**
   * Meeting analytics and metrics.
   * Requires Pro plan or higher.
   */
  analytics?: MeetingAnalytics;
  /** Channels this transcript is shared to (v2.11.0+) */
  channels: Channel[];
}

/**
 * A Fireflies user.
 */
export interface User {
  /** Unique user ID */
  user_id: string;
  /** User's email address */
  email: string;
  /** User's display name */
  name?: string;
  /** Fireflies plan (free, pro, business, enterprise) */
  plan?: string;
}

/**
 * A speaker identified in the transcript.
 */
export interface Speaker {
  /** Unique speaker ID within this transcript */
  id: string;
  /** Speaker's name (may be auto-detected or manually assigned) */
  name: string;
}

/**
 * A single sentence in the transcript.
 */
export interface Sentence {
  /** Zero-based index of the sentence */
  index: number;
  /** Processed text with formatting */
  text: string;
  /** Original unprocessed text */
  raw_text: string;
  /** Start time as decimal seconds string */
  start_time: string;
  /** End time as decimal seconds string */
  end_time: string;
  /** ID of the speaker */
  speaker_id: string;
  /** Name of the speaker */
  speaker_name: string;
  /** AI-detected filters and tags */
  ai_filters?: AIFilter;
}

/**
 * AI-generated meeting summary sections.
 */
export interface Summary {
  /** Action items extracted from the meeting */
  action_items?: string;
  /** Key topics and keywords */
  keywords?: string;
  /** Structured outline of the meeting */
  outline?: string;
  /** High-level overview */
  overview?: string;
  /** Shorthand bullet point summary */
  shorthand_bullet?: string;
  /** Detailed meeting notes */
  notes?: string;
  /** Very brief summary (1-2 sentences) */
  gist?: string;
  /** Brief bullet point summary */
  bullet_gist?: string;
  /** Short summary paragraph */
  short_summary?: string;
  /** Short overview paragraph */
  short_overview?: string;
  /** Detected meeting type (standup, interview, etc.) */
  meeting_type?: string;
  /** List of topics discussed */
  topics_discussed?: string[];
  /** Chapter markers for the transcript */
  transcript_chapters?: string[];
  /** Custom summary sections */
  extended_sections?: SummarySection[];
}

/**
 * Custom summary section from AI Apps.
 */
export interface SummarySection {
  /** Section title */
  title: string;
  /** Section content */
  content: string;
}

/**
 * Attendee information from calendar invite.
 */
export interface MeetingAttendee {
  /** Display name */
  displayName: string;
  /** Email address */
  email: string;
  /** Phone number if provided */
  phoneNumber?: string;
  /** Full name */
  name: string;
  /** Location if provided */
  location?: string;
}

/**
 * Attendance tracking with join/leave times.
 * Available in API v2.10.0+.
 */
export interface MeetingAttendance {
  /** Attendee name */
  name: string;
  /** ISO 8601 timestamp when they joined */
  join_time: string;
  /** ISO 8601 timestamp when they left (null if still in meeting) */
  leave_time?: string;
}

/**
 * Meeting metadata and processing status.
 */
export interface MeetingInfo {
  /** Whether the Fireflies bot (Fred) joined the meeting */
  fred_joined: boolean;
  /** Whether this was a silent recording (no bot audio) */
  silent_meeting: boolean;
  /** Status of AI summary processing */
  summary_status: SummaryStatus;
}

/**
 * Summary processing status.
 */
export type SummaryStatus = 'processing' | 'processed' | 'failed' | 'skipped';

/**
 * AI-detected content filters for a sentence.
 */
export interface AIFilter {
  /** Task or action item */
  task?: string;
  /** Pricing discussion */
  pricing?: string;
  /** Metric or KPI mentioned */
  metric?: string;
  /** Question asked */
  question?: string;
  /** Date and time mention */
  date_and_time?: string;
  /** Cleaned up text */
  text_cleanup?: string;
  /** Sentiment analysis (positive, negative, neutral) */
  sentiment?: string;
}

/**
 * Channel for sharing transcripts (v2.11.0+).
 */
export interface Channel {
  /** Unique channel ID */
  id: string;
  /** Channel title */
  title: string;
  /** Whether the channel is private */
  is_private?: boolean;
  /** ISO 8601 creation timestamp */
  created_at?: string;
  /** ISO 8601 last update timestamp */
  updated_at?: string;
  /** User ID of channel creator */
  created_by?: string;
  /** Channel members */
  members?: ChannelMember[];
}

/**
 * A member of a channel.
 */
export interface ChannelMember {
  /** User ID */
  user_id: string;
  /** Email address */
  email: string;
  /** Display name */
  name: string;
}

/**
 * AI Apps output preview.
 */
export interface AppsPreview {
  /** Array of AI app outputs */
  outputs: AIAppOutput[];
}

/**
 * Output from an AI App.
 */
export interface AIAppOutput {
  /** App identifier */
  app_id?: string;
  /** App name */
  app_name?: string;
  /** Output content */
  content?: string;
  /** Timestamp when generated */
  created_at?: string;
}

/**
 * Meeting analytics and metrics.
 * Requires Pro plan or higher.
 */
export interface MeetingAnalytics {
  /** Overall sentiment score */
  sentiment?: number;
  /** Talk time per speaker in seconds */
  speaker_talk_time?: Record<string, number>;
  /** Number of questions asked */
  questions_count?: number;
  /** Filler word usage */
  filler_words?: Record<string, number>;
}
