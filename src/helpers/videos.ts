import type { FirefliesClient } from '../client.js';
import type { TranscriptsListParams } from '../types/params.js';
import type { Transcript } from '../types/transcript.js';

/**
 * A transcript with a guaranteed video URL.
 */
export interface TranscriptWithVideo {
  /** The full transcript object */
  transcript: Transcript;
  /** URL to download video (expires after 24h) */
  videoUrl: string;
}

/**
 * Iterate through transcripts that have video recordings.
 *
 * This function filters transcripts to only yield those with video_url set.
 * Video recordings require Business plan or higher.
 *
 * @param client - FirefliesClient instance
 * @param options - Optional filter parameters (pagination is handled automatically)
 * @returns AsyncIterable yielding transcripts with their video URLs
 *
 * @example
 * ```typescript
 * import { FirefliesClient, getMeetingVideos } from 'fireflies-api';
 *
 * const client = new FirefliesClient({ apiKey: 'your-api-key' });
 *
 * for await (const { transcript, videoUrl } of getMeetingVideos(client)) {
 *   console.log(`${transcript.title}: ${videoUrl}`);
 * }
 *
 * // With filters
 * for await (const item of getMeetingVideos(client, {
 *   fromDate: '2024-01-01',
 *   mine: true,
 * })) {
 *   console.log(item.videoUrl);
 * }
 * ```
 */
export async function* getMeetingVideos(
  client: FirefliesClient,
  options?: Omit<TranscriptsListParams, 'skip' | 'limit'>
): AsyncIterable<TranscriptWithVideo> {
  for await (const transcript of client.transcripts.listAll(options)) {
    if (transcript.video_url) {
      yield {
        transcript,
        videoUrl: transcript.video_url,
      };
    }
  }
}

/**
 * Check if a transcript has a video recording.
 *
 * @param transcript - Transcript to check
 * @returns true if the transcript has a video URL
 */
export function hasVideo(transcript: Transcript): transcript is Transcript & { video_url: string } {
  return typeof transcript.video_url === 'string' && transcript.video_url.length > 0;
}
