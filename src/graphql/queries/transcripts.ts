import { paginate } from '../../helpers/pagination.js';
import type { TranscriptsListParams } from '../../types/params.js';
import type {
  AppsPreview,
  Channel,
  MeetingAnalytics,
  MeetingAttendance,
  MeetingAttendee,
  MeetingInfo,
  Sentence,
  Speaker,
  Summary,
  Transcript,
  User,
} from '../../types/transcript.js';
import type { GraphQLClient } from '../client.js';

/**
 * GraphQL fragment for full transcript fields.
 */
const TRANSCRIPT_FIELDS = `
  id
  title
  organizer_email
  host_email
  user {
    user_id
    email
    name
    plan
  }
  speakers {
    id
    name
  }
  transcript_url
  participants
  meeting_attendees {
    displayName
    email
    phoneNumber
    name
    location
  }
  meeting_attendance {
    name
    join_time
    leave_time
  }
  fireflies_users
  workspace_users
  duration
  dateString
  date
  audio_url
  video_url
  sentences {
    index
    text
    raw_text
    start_time
    end_time
    speaker_id
    speaker_name
    ai_filters {
      task
      pricing
      metric
      question
      date_and_time
      text_cleanup
      sentiment
    }
  }
  calendar_id
  summary {
    action_items
    keywords
    outline
    overview
    shorthand_bullet
    notes
    gist
    bullet_gist
    short_summary
    short_overview
    meeting_type
    topics_discussed
    transcript_chapters
    extended_sections {
      title
      content
    }
  }
  meeting_info {
    fred_joined
    silent_meeting
    summary_status
  }
  cal_id
  calendar_type
  apps_preview {
    outputs {
      app_id
      app_name
      content
      created_at
    }
  }
  meeting_link
  analytics {
    sentiment
    speaker_talk_time
    questions_count
    filler_words
  }
  channels {
    id
    title
    is_private
    created_at
    updated_at
    created_by
    members {
      user_id
      email
      name
    }
  }
`;

/**
 * GraphQL fragment for transcript list fields (lighter weight).
 */
const TRANSCRIPT_LIST_FIELDS = `
  id
  title
  organizer_email
  transcript_url
  participants
  duration
  dateString
  date
  meeting_info {
    fred_joined
    silent_meeting
    summary_status
  }
`;

/**
 * API for transcript operations.
 */
export interface TranscriptsAPI {
  /**
   * Get a single transcript by ID.
   *
   * @param id - Transcript ID
   * @returns Full transcript with all fields
   * @throws NotFoundError if transcript doesn't exist
   */
  get(id: string): Promise<Transcript>;

  /**
   * List transcripts with optional filtering.
   *
   * @param params - Filter and pagination options
   * @returns Array of transcripts (max 50 per call)
   */
  list(params?: TranscriptsListParams): Promise<Transcript[]>;

  /**
   * Get just the summary for a transcript.
   * Lighter weight than fetching the full transcript.
   *
   * @param id - Transcript ID
   * @returns Summary object
   */
  getSummary(id: string): Promise<Summary | null>;

  /**
   * Iterate through all transcripts matching the filter.
   * Automatically handles pagination.
   *
   * @param params - Filter options (skip and limit are ignored)
   * @returns Async iterable of transcripts
   *
   * @example
   * ```typescript
   * for await (const transcript of client.transcripts.listAll({ mine: true })) {
   *   console.log(transcript.title);
   * }
   * ```
   */
  listAll(params?: Omit<TranscriptsListParams, 'skip' | 'limit'>): AsyncIterable<Transcript>;
}

/**
 * Create the transcripts API bound to a GraphQL client.
 */
export function createTranscriptsAPI(client: GraphQLClient): TranscriptsAPI {
  return {
    async get(id: string): Promise<Transcript> {
      const query = `
        query GetTranscript($id: String!) {
          transcript(id: $id) {
            ${TRANSCRIPT_FIELDS}
          }
        }
      `;

      const data = await client.execute<{ transcript: TranscriptResponse }>(query, { id });

      return normalizeTranscript(data.transcript);
    },

    async list(params?: TranscriptsListParams): Promise<Transcript[]> {
      const query = `
        query ListTranscripts(
          $keyword: String
          $scope: String
          $organizers: [String]
          $participants: [String]
          $user_id: String
          $mine: Boolean
          $channel_id: String
          $fromDate: String
          $toDate: String
          $limit: Int
          $skip: Int
          $title: String
          $host_email: String
          $organizer_email: String
          $participant_email: String
          $date: Float
        ) {
          transcripts(
            keyword: $keyword
            scope: $scope
            organizers: $organizers
            participants: $participants
            user_id: $user_id
            mine: $mine
            channel_id: $channel_id
            fromDate: $fromDate
            toDate: $toDate
            limit: $limit
            skip: $skip
            title: $title
            host_email: $host_email
            organizer_email: $organizer_email
            participant_email: $participant_email
            date: $date
          ) {
            ${TRANSCRIPT_LIST_FIELDS}
          }
        }
      `;

      const variables = buildListVariables(params);
      const data = await client.execute<{ transcripts: TranscriptResponse[] }>(query, variables);

      return data.transcripts.map(normalizeTranscript);
    },

    async getSummary(id: string): Promise<Summary | null> {
      const query = `
        query GetTranscriptSummary($id: String!) {
          transcript(id: $id) {
            summary {
              action_items
              keywords
              outline
              overview
              shorthand_bullet
              notes
              gist
              bullet_gist
              short_summary
              short_overview
              meeting_type
              topics_discussed
              transcript_chapters
              extended_sections {
                title
                content
              }
            }
          }
        }
      `;

      const data = await client.execute<{
        transcript: { summary: Summary | null };
      }>(query, { id });

      return data.transcript.summary;
    },

    listAll(params?: Omit<TranscriptsListParams, 'skip' | 'limit'>): AsyncIterable<Transcript> {
      return paginate((skip, limit) => this.list({ ...params, skip, limit }), 50);
    },
  };
}

/**
 * Raw transcript response from GraphQL (may have nulls).
 */
type TranscriptResponse = {
  id: string;
  title: string | null;
  organizer_email: string | null;
  host_email?: string | null;
  user?: User | null;
  speakers?: Speaker[] | null;
  transcript_url: string | null;
  participants?: string[] | null;
  meeting_attendees?: MeetingAttendee[] | null;
  meeting_attendance?: MeetingAttendance[] | null;
  fireflies_users?: string[] | null;
  workspace_users?: string[] | null;
  duration: number | null;
  dateString: string | null;
  date: number | null;
  audio_url?: string | null;
  video_url?: string | null;
  sentences?: Sentence[] | null;
  calendar_id?: string | null;
  summary?: Summary | null;
  meeting_info?: MeetingInfo | null;
  cal_id?: string | null;
  calendar_type?: string | null;
  apps_preview?: AppsPreview | null;
  meeting_link?: string | null;
  analytics?: MeetingAnalytics | null;
  channels?: Channel[] | null;
};

/**
 * Normalize a transcript response to ensure consistent types.
 */
function normalizeTranscript(raw: TranscriptResponse): Transcript {
  return {
    id: raw.id,
    title: raw.title ?? '',
    organizer_email: raw.organizer_email ?? '',
    host_email: raw.host_email ?? undefined,
    user: raw.user ?? undefined,
    speakers: raw.speakers ?? [],
    transcript_url: raw.transcript_url ?? '',
    participants: raw.participants ?? [],
    meeting_attendees: raw.meeting_attendees ?? [],
    meeting_attendance: raw.meeting_attendance ?? [],
    fireflies_users: raw.fireflies_users ?? [],
    workspace_users: raw.workspace_users ?? [],
    duration: raw.duration ?? 0,
    dateString: raw.dateString ?? '',
    date: raw.date ?? 0,
    audio_url: raw.audio_url ?? undefined,
    video_url: raw.video_url ?? undefined,
    sentences: raw.sentences ?? [],
    calendar_id: raw.calendar_id ?? undefined,
    summary: raw.summary ?? undefined,
    meeting_info: raw.meeting_info ?? undefined,
    cal_id: raw.cal_id ?? undefined,
    calendar_type: raw.calendar_type ?? undefined,
    apps_preview: raw.apps_preview ?? undefined,
    meeting_link: raw.meeting_link ?? undefined,
    analytics: raw.analytics ?? undefined,
    channels: raw.channels ?? [],
  };
}

/**
 * Build GraphQL variables from list params.
 */
function buildListVariables(params?: TranscriptsListParams): Record<string, unknown> {
  if (!params) {
    return { limit: 50 };
  }

  return {
    keyword: params.keyword,
    scope: params.scope,
    organizers: params.organizers,
    participants: params.participants,
    user_id: params.user_id,
    mine: params.mine,
    channel_id: params.channel_id,
    fromDate: params.fromDate,
    toDate: params.toDate,
    limit: params.limit ?? 50,
    skip: params.skip,
    title: params.title,
    host_email: params.host_email,
    organizer_email: params.organizer_email,
    participant_email: params.participant_email,
    date: params.date,
  };
}
