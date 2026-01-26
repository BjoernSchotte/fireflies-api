/**
 * Caption entry in a bite.
 */
export interface BiteCaption {
  index: number;
  text: string;
  start_time: number;
  end_time: number;
  speaker_id: string;
  speaker_name: string;
}

/**
 * Media source for a bite.
 */
export interface BiteSource {
  src: string;
  type: string;
}

/**
 * User info in bite.
 */
export interface BiteUser {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  picture?: string;
}

/**
 * Creation source info.
 */
export interface BiteCreatedFrom {
  id: string;
  name: string;
  type: string;
  description?: string;
  duration?: number;
}

/**
 * Soundbite/clip from a transcript.
 */
export interface Bite {
  id: string;
  transcript_id: string;
  user_id: string;
  name: string;
  status: string;
  summary?: string;
  summary_status?: string;
  media_type: string;
  start_time: number;
  end_time: number;
  created_at: string;
  thumbnail?: string;
  preview?: string;
  captions: BiteCaption[];
  sources: BiteSource[];
  user?: BiteUser;
  created_from?: BiteCreatedFrom;
  privacies?: string[];
}
