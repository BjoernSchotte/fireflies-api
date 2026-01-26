import type { UserProfile, UserRole } from '../../types/user.js';
import type { GraphQLClient } from '../client.js';

/**
 * API for user mutations.
 */
export interface UsersMutationsAPI {
  /**
   * Set user role (admin or user).
   *
   * @param userId - User ID to update
   * @param role - New role
   * @returns Updated user (partial fields)
   */
  setRole(userId: string, role: UserRole): Promise<UserProfile>;
}

/**
 * Create the users mutations API bound to a GraphQL client.
 */
export function createUsersMutationsAPI(client: GraphQLClient): UsersMutationsAPI {
  return {
    async setRole(userId: string, role: UserRole): Promise<UserProfile> {
      const mutation = `
        mutation setUserRole($userId: String!, $role: Role!) {
          setUserRole(user_id: $userId, role: $role) {
            id
            name
            email
            role
          }
        }
      `;
      const data = await client.execute<{ setUserRole: UserProfile }>(mutation, {
        userId,
        role,
      });
      return data.setUserRole;
    },
  };
}
