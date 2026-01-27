import { paginate } from '../../helpers/pagination.js';
import type { Bite } from '../../types/bite.js';
import type { BitesListParams, CreateBiteParams } from '../../types/params.js';
import type { GraphQLClient } from '../client.js';

const BITE_FIELDS = `
  id
  transcript_id
  user_id
  name
  status
  summary
  summary_status
  media_type
  start_time
  end_time
  created_at
  thumbnail
  preview
  captions {
    index
    text
    start_time
    end_time
    speaker_id
    speaker_name
  }
  sources {
    src
    type
  }
  user {
    id
    name
    first_name
    last_name
    picture
  }
  created_from {
    id
    name
    type
    description
    duration
  }
  privacies
`;

/**
 * API for bite (soundbite/clip) operations.
 */
export interface BitesAPI {
  /**
   * Get a single bite by ID.
   *
   * @param id - Bite ID
   * @returns Bite details
   */
  get(id: string): Promise<Bite>;

  /**
   * List bites with filtering.
   *
   * @param params - Filter and pagination options
   * @returns Array of bites (max 50 per call)
   */
  list(params: BitesListParams): Promise<Bite[]>;

  /**
   * Iterate through all bites matching the filter.
   * Automatically handles pagination.
   *
   * @param params - Filter options (skip and limit are ignored)
   * @returns Async iterable of bites
   */
  listAll(params: Omit<BitesListParams, 'skip' | 'limit'>): AsyncIterable<Bite>;

  /**
   * Create a new bite from a transcript.
   *
   * @param params - Bite creation parameters
   * @returns Created bite (partial fields)
   */
  create(params: CreateBiteParams): Promise<Bite>;
}

/**
 * Create the bites API bound to a GraphQL client.
 */
export function createBitesAPI(client: GraphQLClient): BitesAPI {
  return {
    async get(id: string): Promise<Bite> {
      const query = `
        query Bite($biteId: ID!) {
          bite(id: $biteId) { ${BITE_FIELDS} }
        }
      `;
      const data = await client.execute<{ bite: Bite }>(query, { biteId: id });
      return data.bite;
    },

    async list(params: BitesListParams): Promise<Bite[]> {
      const query = `
        query Bites(
          $transcriptId: ID
          $mine: Boolean
          $myTeam: Boolean
          $limit: Int
          $skip: Int
        ) {
          bites(
            transcript_id: $transcriptId
            mine: $mine
            my_team: $myTeam
            limit: $limit
            skip: $skip
          ) { ${BITE_FIELDS} }
        }
      `;
      const data = await client.execute<{ bites: Bite[] }>(query, {
        transcriptId: params.transcript_id,
        mine: params.mine,
        myTeam: params.my_team,
        limit: params.limit ?? 50,
        skip: params.skip,
      });
      return data.bites;
    },

    listAll(params: Omit<BitesListParams, 'skip' | 'limit'>): AsyncIterable<Bite> {
      return paginate((skip, limit) => this.list({ ...params, skip, limit }), 50);
    },

    async create(params: CreateBiteParams): Promise<Bite> {
      const mutation = `
        mutation CreateBite(
          $transcriptId: ID!
          $startTime: Float!
          $endTime: Float!
          $name: String
          $mediaType: String
          $summary: String
          $privacies: [BitePrivacy!]
        ) {
          createBite(
            transcript_Id: $transcriptId
            start_time: $startTime
            end_time: $endTime
            name: $name
            media_type: $mediaType
            summary: $summary
            privacies: $privacies
          ) {
            id
            name
            status
            summary
          }
        }
      `;
      const data = await client.execute<{ createBite: Bite }>(mutation, {
        transcriptId: params.transcript_id,
        startTime: params.start_time,
        endTime: params.end_time,
        name: params.name,
        mediaType: params.media_type,
        summary: params.summary,
        privacies: params.privacies,
      });
      return data.createBite;
    },
  };
}
