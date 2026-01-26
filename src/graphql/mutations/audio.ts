import type { UploadAudioParams } from '../../types/params.js';
import type { GraphQLClient } from '../client.js';

/**
 * Result from audio upload.
 */
export interface UploadAudioResult {
  success: boolean;
  title: string;
  message: string;
}

/**
 * API for audio operations.
 */
export interface AudioAPI {
  /**
   * Upload audio/video file for transcription.
   *
   * @param params - Upload parameters
   * @returns Upload result
   */
  upload(params: UploadAudioParams): Promise<UploadAudioResult>;
}

/**
 * Create the audio API bound to a GraphQL client.
 */
export function createAudioAPI(client: GraphQLClient): AudioAPI {
  return {
    async upload(params: UploadAudioParams): Promise<UploadAudioResult> {
      const mutation = `
        mutation UploadAudio($input: AudioUploadInput!) {
          uploadAudio(input: $input) {
            success
            title
            message
          }
        }
      `;
      const data = await client.execute<{ uploadAudio: UploadAudioResult }>(mutation, {
        input: params,
      });
      return data.uploadAudio;
    },
  };
}
