/**
 * User role in Fireflies.
 */
export type UserRole = 'admin' | 'user';

/**
 * User group member.
 */
export interface UserGroupMember {
  user_id: string;
  email: string;
}

/**
 * User group.
 */
export interface UserGroup {
  id: string;
  name: string;
  handle: string;
  members: UserGroupMember[];
}

/**
 * Full user profile.
 */
export interface UserProfile {
  /** User ID */
  user_id: string;
  /** Also returned as 'id' by setUserRole mutation */
  id?: string;
  /** User's email address */
  email: string;
  /** User's display name */
  name: string;
  /** Role (returned by setUserRole) */
  role?: UserRole;
  /** Number of transcripts */
  num_transcripts?: number;
  /** Recent meeting timestamp */
  recent_meeting?: string;
  /** Recent transcript ID */
  recent_transcript?: string;
  /** Minutes consumed */
  minutes_consumed?: number;
  /** Whether user is admin */
  is_admin?: boolean;
  /** Connected integrations */
  integrations?: string[] | null;
  /** User groups */
  user_groups?: UserGroup[];
}
