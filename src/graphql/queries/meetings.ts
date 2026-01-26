import type { ActiveMeeting } from '../../types/meeting.js';
import type { ActiveMeetingsParams, AddBotParams } from '../../types/params.js';
import type { GraphQLClient } from '../client.js';

const ACTIVE_MEETING_FIELDS = `
  id
  title
  organizer_email
  meeting_link
  start_time
  end_time
  privacy
  state
`;

/**
 * API for meeting operations.
 */
export interface MeetingsAPI {
  /**
   * List active meetings in progress.
   *
   * @param params - Optional filter parameters
   * @returns Array of active meetings
   */
  active(params?: ActiveMeetingsParams): Promise<ActiveMeeting[]>;

  /**
   * Add Fireflies bot to a live meeting.
   *
   * @param params - Meeting parameters
   * @returns Success result
   */
  addBot(params: AddBotParams): Promise<{ success: boolean }>;
}

/**
 * Create the meetings API bound to a GraphQL client.
 */
export function createMeetingsAPI(client: GraphQLClient): MeetingsAPI {
  return {
    async active(params?: ActiveMeetingsParams): Promise<ActiveMeeting[]> {
      const query = `
        query ActiveMeetings($email: String, $states: [MeetingState!]) {
          active_meetings(input: { email: $email, states: $states }) {
            ${ACTIVE_MEETING_FIELDS}
          }
        }
      `;
      const data = await client.execute<{ active_meetings: ActiveMeeting[] }>(query, {
        email: params?.email,
        states: params?.states,
      });
      return data.active_meetings;
    },

    async addBot(params: AddBotParams): Promise<{ success: boolean }> {
      const mutation = `
        mutation AddToLiveMeeting(
          $meetingLink: String!
          $title: String
          $meetingPassword: String
          $duration: Int
          $language: String
        ) {
          addToLiveMeeting(
            meeting_link: $meetingLink
            title: $title
            meeting_password: $meetingPassword
            duration: $duration
            language: $language
          ) {
            success
          }
        }
      `;
      const data = await client.execute<{ addToLiveMeeting: { success: boolean } }>(mutation, {
        meetingLink: params.meeting_link,
        title: params.title,
        meetingPassword: params.password,
        duration: params.duration,
        language: params.language,
      });
      return data.addToLiveMeeting;
    },
  };
}
