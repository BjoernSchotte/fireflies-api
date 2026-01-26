import { paginate } from '../../helpers/pagination.js';
import type { AIApp } from '../../types/ai-app.js';
import type { AIAppsListParams } from '../../types/params.js';
import type { GraphQLClient } from '../client.js';

const AI_APP_OUTPUT_FIELDS = `
  transcript_id
  user_id
  app_id
  created_at
  title
  prompt
  response
`;

/**
 * API for AI Apps operations.
 */
export interface AIAppsAPI {
  /**
   * List AI App outputs.
   *
   * @param params - Optional filter and pagination parameters
   * @returns Array of AI App outputs
   */
  list(params?: AIAppsListParams): Promise<AIApp[]>;

  /**
   * Iterate through all AI App outputs matching the filter.
   * Automatically handles pagination.
   *
   * @param params - Filter options (skip and limit are ignored)
   * @returns Async iterable of AI App outputs
   */
  listAll(params?: Omit<AIAppsListParams, 'skip' | 'limit'>): AsyncIterable<AIApp>;
}

/**
 * Create the AI Apps API bound to a GraphQL client.
 */
export function createAIAppsAPI(client: GraphQLClient): AIAppsAPI {
  return {
    async list(params?: AIAppsListParams): Promise<AIApp[]> {
      const query = `
        query GetAIAppsOutputs(
          $appId: String
          $transcriptId: String
          $skip: Float
          $limit: Float
        ) {
          apps(
            app_id: $appId
            transcript_id: $transcriptId
            skip: $skip
            limit: $limit
          ) {
            outputs { ${AI_APP_OUTPUT_FIELDS} }
          }
        }
      `;
      const data = await client.execute<{ apps: { outputs: AIApp[] } }>(query, {
        appId: params?.app_id,
        transcriptId: params?.transcript_id,
        skip: params?.skip,
        limit: params?.limit ?? 10,
      });
      return data.apps.outputs;
    },

    listAll(params?: Omit<AIAppsListParams, 'skip' | 'limit'>): AsyncIterable<AIApp> {
      return paginate((skip, limit) => this.list({ ...params, skip, limit }), 10);
    },
  };
}
