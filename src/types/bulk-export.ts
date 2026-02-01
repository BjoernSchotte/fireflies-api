/**
 * Export format types supported by bulk export.
 */
export type ExportFormat = 'markdown' | 'json' | 'txt' | 'csv';

/**
 * A single exported file ready for writing.
 */
export interface ExportedFile {
  /** Transcript ID */
  id: string;
  /** Original transcript title */
  title: string;
  /** Generated filename with extension */
  filename: string;
  /** Formatted file content */
  content: string;
}

/**
 * Result of a bulk export operation.
 */
export interface BulkExportResult {
  /** Successfully exported files */
  files: ExportedFile[];
  /** Zip archive buffer if asZip was true */
  zip?: Buffer;
  /** Export format used */
  format: ExportFormat;
  /** Total number of transcripts exported */
  totalExported: number;
}

/**
 * Parameters for bulk export operation.
 */
export interface BulkExportParams {
  // Date filters
  /** Start date (YYYY-MM-DD or ISO 8601) */
  fromDate?: string;
  /** End date (YYYY-MM-DD or ISO 8601) */
  toDate?: string;

  // Transcript filters
  /** Export specific transcript IDs */
  ids?: string[];
  /** Only export my transcripts */
  mine?: boolean;
  /** Filter by organizer emails */
  organizers?: string[];
  /** Filter by participant emails */
  participants?: string[];
  /** Only meetings with external participants */
  external?: boolean;
  /** Maximum number of transcripts to export */
  limit?: number;

  // Export options
  /**
   * Output format.
   * @default 'markdown'
   */
  format?: ExportFormat;
  /**
   * Package exported files as a zip archive.
   * @default false
   */
  asZip?: boolean;

  /**
   * Progress callback called as each transcript is processed.
   * @param completed - Number of transcripts processed so far
   * @param total - Total number of transcripts to process
   */
  onProgress?: (completed: number, total: number) => void;
}
