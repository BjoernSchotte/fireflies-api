import type { Transcript } from '../../types/transcript.js';
import type { GraphQLClient } from '../client.js';

/**
 * API for transcript mutations.
 */
export interface TranscriptsMutationsAPI {
  /**
   * Delete a transcript.
   *
   * Rate limit: 10/min
   *
   * @param id - Transcript ID to delete
   * @returns Deleted transcript (partial fields)
   */
  delete(id: string): Promise<Transcript>;
}

/**
 * Create the transcripts mutations API bound to a GraphQL client.
 */
export function createTranscriptsMutationsAPI(client: GraphQLClient): TranscriptsMutationsAPI {
  return {
    async delete(id: string): Promise<Transcript> {
      const mutation = `
        mutation deleteTranscript($id: String!) {
          deleteTranscript(id: $id) {
            id
            title
            organizer_email
            date
            duration
          }
        }
      `;
      const data = await client.execute<{ deleteTranscript: Transcript }>(mutation, { id });
      return data.deleteTranscript;
    },
  };
}
