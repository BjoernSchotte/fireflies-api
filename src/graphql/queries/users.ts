import type { UserProfile } from '../../types/user.js';
import type { GraphQLClient } from '../client.js';

const USER_FIELDS = `
  user_id
  email
  name
  num_transcripts
  recent_meeting
  recent_transcript
  minutes_consumed
  is_admin
  integrations
  user_groups {
    id
    name
    handle
    members {
      user_id
      email
    }
  }
`;

/**
 * API for user operations.
 */
export interface UsersAPI {
  /**
   * Get current user (API key owner).
   *
   * @returns Current user profile
   */
  me(): Promise<UserProfile>;

  /**
   * Get user by ID.
   *
   * @param id - User ID
   * @returns User profile
   */
  get(id: string): Promise<UserProfile>;

  /**
   * List all team users.
   *
   * @returns Array of user profiles
   */
  list(): Promise<UserProfile[]>;
}

/**
 * Create the users API bound to a GraphQL client.
 */
export function createUsersAPI(client: GraphQLClient): UsersAPI {
  return {
    async me(): Promise<UserProfile> {
      const query = `query { user { ${USER_FIELDS} } }`;
      const data = await client.execute<{ user: UserProfile }>(query);
      return data.user;
    },

    async get(id: string): Promise<UserProfile> {
      const query = `
        query User($userId: String!) {
          user(id: $userId) { ${USER_FIELDS} }
        }
      `;
      const data = await client.execute<{ user: UserProfile }>(query, { userId: id });
      return data.user;
    },

    async list(): Promise<UserProfile[]> {
      const query = `query Users { users { ${USER_FIELDS} } }`;
      const data = await client.execute<{ users: UserProfile[] }>(query);
      return data.users;
    },
  };
}
