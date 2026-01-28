import { aggregateActionItems } from '../../helpers/action-items-format.js';
import { extractDomain, hasExternalParticipants } from '../../helpers/domain-utils.js';
import { analyzeMeetings } from '../../helpers/meeting-insights.js';
import { paginate } from '../../helpers/pagination.js';
import { searchTranscript } from '../../helpers/search.js';
import type {
  AggregatedActionItemsResult,
  ExportActionItemsParams,
} from '../../types/action-items.js';
import type { MeetingInsights } from '../../types/meeting-insights.js';
import type {
  TranscriptGetParams,
  TranscriptsInsightsParams,
  TranscriptsListParams,
} from '../../types/params.js';
import type { SearchParams, SearchResults } from '../../types/search.js';
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
 * GraphQL fragment for base transcript fields (excludes sentences and summary).
 */
const TRANSCRIPT_BASE_FIELDS = `
  id
  title
  organizer_email
  host_email
  user {
    user_id
    email
    name
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
  calendar_id
  meeting_info {
    fred_joined
    silent_meeting
    summary_status
  }
  cal_id
  calendar_type
  apps_preview {
    outputs {
      transcript_id
      user_id
      app_id
      created_at
      title
      prompt
      response
    }
  }
  meeting_link
  analytics {
    sentiments {
      negative_pct
      neutral_pct
      positive_pct
    }
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
 * GraphQL fragment for sentences field.
 */
const SENTENCES_FIELDS = `
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
`;

/**
 * GraphQL fragment for summary field.
 */
const SUMMARY_FIELDS = `
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
`;

/**
 * Build transcript fields based on options.
 */
function buildTranscriptFields(params?: TranscriptGetParams): string {
  const includeSentences = params?.includeSentences !== false;
  const includeSummary = params?.includeSummary !== false;

  let fields = TRANSCRIPT_BASE_FIELDS;
  if (includeSentences) {
    fields += SENTENCES_FIELDS;
  }
  if (includeSummary) {
    fields += SUMMARY_FIELDS;
  }
  return fields;
}

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
  video_url
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
   * @param params - Optional parameters to exclude heavy fields
   * @returns Transcript (fields depend on params)
   * @throws NotFoundError if transcript doesn't exist
   *
   * @example
   * ```typescript
   * // Full transcript with all fields
   * const full = await client.transcripts.get('id');
   *
   * // Metadata only (faster, smaller response)
   * const meta = await client.transcripts.get('id', {
   *   includeSentences: false,
   *   includeSummary: false,
   * });
   * ```
   */
  get(id: string, params?: TranscriptGetParams): Promise<Transcript>;

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

  /**
   * Search across transcripts for matching sentences.
   *
   * This method first queries for transcripts matching the keyword,
   * then fetches each transcript with sentences and searches locally
   * for detailed matches with speaker filtering, question/task filtering,
   * and context extraction.
   *
   * @param query - The search query string
   * @param params - Search options including filters and context settings
   * @returns Search results with matches grouped by transcript
   *
   * @example
   * ```typescript
   * const results = await client.transcripts.search('budget', {
   *   speakers: ['Alice'],
   *   filterQuestions: true,
   *   fromDate: '2024-01-01',
   *   contextLines: 2,
   * });
   *
   * console.log(`Found ${results.totalMatches} matches`);
   * for (const match of results.matches) {
   *   console.log(`${match.sentence.speakerName}: ${match.sentence.text}`);
   * }
   * ```
   */
  search(query: string, params?: SearchParams): Promise<SearchResults>;

  /**
   * Compute aggregate meeting insights across transcripts.
   *
   * Fetches transcripts matching the filter criteria and computes
   * aggregate statistics including duration totals, day of week
   * distribution, participant counts, and speaker talk times.
   *
   * @param params - Filtering and analysis options
   * @returns Aggregate meeting insights
   *
   * @example
   * ```typescript
   * const insights = await client.transcripts.insights({
   *   fromDate: '2024-01-01',
   *   toDate: '2024-01-31',
   *   mine: true,
   *   groupBy: 'week',
   * });
   *
   * console.log(`${insights.totalMeetings} meetings`);
   * console.log(`${insights.totalDurationMinutes} total minutes`);
   * console.log(`Busiest day: ${getBusiestDay(insights.byDayOfWeek)}`);
   * ```
   */
  insights(params?: TranscriptsInsightsParams): Promise<MeetingInsights>;

  /**
   * Export action items from multiple transcripts.
   *
   * Fetches transcripts matching the filter criteria, extracts action
   * items from each, and aggregates them with source metadata.
   *
   * @param params - Filtering options for transcripts and action items
   * @returns Aggregated action items with statistics
   *
   * @example
   * ```typescript
   * const result = await client.transcripts.exportActionItems({
   *   fromDate: '2024-01-01',
   *   mine: true,
   *   filterOptions: { assignedOnly: true },
   * });
   *
   * console.log(`${result.totalItems} action items from ${result.transcriptsProcessed} meetings`);
   * for (const item of result.items) {
   *   console.log(`${item.text} (${item.transcriptTitle})`);
   * }
   * ```
   */
  exportActionItems(params?: ExportActionItemsParams): Promise<AggregatedActionItemsResult>;
}

/**
 * Create the transcripts API bound to a GraphQL client.
 */
export function createTranscriptsAPI(client: GraphQLClient): TranscriptsAPI {
  return {
    async get(id: string, params?: TranscriptGetParams): Promise<Transcript> {
      const fields = buildTranscriptFields(params);
      const query = `
        query GetTranscript($id: String!) {
          transcript(id: $id) {
            ${fields}
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
          $organizers: [String!]
          $participants: [String!]
          $user_id: String
          $mine: Boolean
          $channel_id: String
          $fromDate: DateTime
          $toDate: DateTime
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

      // Get internal domain if filtering for external meetings
      let internalDomain: string | undefined;
      if (params?.external) {
        const userQuery = 'query { user { email } }';
        const userData = await client.execute<{ user: { email: string } }>(userQuery);
        internalDomain = extractDomain(userData.user.email);
      }

      const variables = buildListVariables(params);
      const data = await client.execute<{ transcripts: TranscriptResponse[] }>(query, variables);

      let results = data.transcripts.map(normalizeTranscript);

      // Client-side filter for external participants
      if (internalDomain) {
        results = results.filter((t) => hasExternalParticipants(t.participants, internalDomain));
      }

      return results;
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

    async search(query: string, params: SearchParams = {}): Promise<SearchResults> {
      const {
        caseSensitive = false,
        scope = 'sentences',
        speakers,
        filterQuestions,
        filterTasks,
        contextLines = 1,
        limit,
        ...listParams
      } = params;

      // Phase 1: Find matching transcripts via server-side search
      const transcripts: Transcript[] = [];
      for await (const t of this.listAll({
        keyword: query,
        scope,
        ...listParams,
      })) {
        transcripts.push(t);
        if (limit && transcripts.length >= limit) break;
      }

      // Phase 2: Fetch full transcripts and search locally
      const allMatches: SearchResults['matches'] = [];
      let transcriptsWithMatches = 0;

      for (const t of transcripts) {
        const full = await this.get(t.id, { includeSentences: true });
        const matches = searchTranscript(full, {
          query,
          caseSensitive,
          speakers,
          filterQuestions,
          filterTasks,
          contextLines,
        });

        if (matches.length > 0) {
          transcriptsWithMatches++;
          allMatches.push(...matches);
        }
      }

      return {
        query,
        options: params,
        totalMatches: allMatches.length,
        transcriptsSearched: transcripts.length,
        transcriptsWithMatches,
        matches: allMatches,
      };
    },

    async insights(params: TranscriptsInsightsParams = {}): Promise<MeetingInsights> {
      const {
        fromDate,
        toDate,
        mine,
        organizers,
        participants,
        user_id,
        channel_id,
        limit,
        external,
        speakers,
        groupBy,
        topSpeakersCount,
        topParticipantsCount,
      } = params;

      // Get internal domain if filtering for external meetings
      let internalDomain: string | undefined;
      if (external) {
        const userQuery = 'query { user { email } }';
        const userData = await client.execute<{ user: { email: string } }>(userQuery);
        internalDomain = extractDomain(userData.user.email);
      }

      // Fetch transcripts with sentences (needed for speaker analysis)
      const transcripts: Transcript[] = [];
      for await (const t of this.listAll({
        fromDate,
        toDate,
        mine,
        organizers,
        participants,
        user_id,
        channel_id,
      })) {
        // Skip if filtering for external and no external participants
        if (internalDomain && !hasExternalParticipants(t.participants, internalDomain)) {
          continue;
        }

        // Fetch full transcript with sentences
        const full = await this.get(t.id, { includeSentences: true, includeSummary: false });
        transcripts.push(full);

        if (limit && transcripts.length >= limit) break;
      }

      // Analyze with the helper
      return analyzeMeetings(transcripts, {
        speakers,
        groupBy,
        topSpeakersCount,
        topParticipantsCount,
      });
    },

    async exportActionItems(
      params: ExportActionItemsParams = {}
    ): Promise<AggregatedActionItemsResult> {
      const { fromDate, toDate, mine, organizers, participants, limit, filterOptions } = params;

      // Fetch transcripts with summary (needed for action items)
      const transcripts: Transcript[] = [];
      for await (const t of this.listAll({
        fromDate,
        toDate,
        mine,
        organizers,
        participants,
      })) {
        // Fetch summary for action items
        const full = await this.get(t.id, { includeSentences: false, includeSummary: true });
        transcripts.push(full);

        if (limit && transcripts.length >= limit) break;
      }

      // Aggregate action items using the helper
      return aggregateActionItems(transcripts, {}, filterOptions);
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

/** Convert null to undefined for optional fields */
function orUndefined<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

/** Convert null to empty array for required array fields */
function orEmptyArray<T>(value: T[] | null | undefined): T[] {
  return value ?? [];
}

/** Normalize required string/number fields */
function normalizeRequiredFields(raw: TranscriptResponse) {
  return {
    id: raw.id,
    title: raw.title ?? '',
    organizer_email: raw.organizer_email ?? '',
    transcript_url: raw.transcript_url ?? '',
    duration: raw.duration ?? 0,
    dateString: raw.dateString ?? '',
    date: raw.date ?? 0,
  };
}

/** Normalize array fields */
function normalizeArrayFields(raw: TranscriptResponse) {
  return {
    speakers: orEmptyArray(raw.speakers),
    participants: orEmptyArray(raw.participants),
    meeting_attendees: orEmptyArray(raw.meeting_attendees),
    meeting_attendance: orEmptyArray(raw.meeting_attendance),
    fireflies_users: orEmptyArray(raw.fireflies_users),
    workspace_users: orEmptyArray(raw.workspace_users),
    sentences: orEmptyArray(raw.sentences),
    channels: orEmptyArray(raw.channels),
  };
}

/** Normalize optional fields */
function normalizeOptionalFields(raw: TranscriptResponse) {
  return {
    host_email: orUndefined(raw.host_email),
    user: orUndefined(raw.user),
    audio_url: orUndefined(raw.audio_url),
    video_url: orUndefined(raw.video_url),
    calendar_id: orUndefined(raw.calendar_id),
    summary: orUndefined(raw.summary),
    meeting_info: orUndefined(raw.meeting_info),
    cal_id: orUndefined(raw.cal_id),
    calendar_type: orUndefined(raw.calendar_type),
    apps_preview: orUndefined(raw.apps_preview),
    meeting_link: orUndefined(raw.meeting_link),
    analytics: orUndefined(raw.analytics),
  };
}

/**
 * Normalize a transcript response to ensure consistent types.
 */
function normalizeTranscript(raw: TranscriptResponse): Transcript {
  return {
    ...normalizeRequiredFields(raw),
    ...normalizeArrayFields(raw),
    ...normalizeOptionalFields(raw),
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
