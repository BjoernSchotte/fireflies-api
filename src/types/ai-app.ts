/**
 * AI App output for a transcript.
 */
export interface AIApp {
  transcript_id: string;
  user_id: string;
  app_id: string;
  created_at: string;
  title: string;
  prompt: string;
  response: string;
}
