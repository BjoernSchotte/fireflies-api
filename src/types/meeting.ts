/**
 * Meeting state for active meetings.
 */
export type MeetingState = 'active' | 'paused';

/**
 * Privacy setting for meetings.
 */
export type MeetingPrivacy = 'public' | 'team' | 'private';

/**
 * Active meeting in progress.
 */
export interface ActiveMeeting {
  id: string;
  title: string;
  organizer_email: string;
  meeting_link?: string;
  start_time?: string;
  end_time?: string;
  privacy?: MeetingPrivacy;
  state: MeetingState;
}
