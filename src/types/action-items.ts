import type { ActionItem } from '../helpers/action-items.js';

/**
 * Style for formatting action items in Markdown.
 */
export type ActionItemStyle = 'checkbox' | 'bullet' | 'numbered';

/**
 * How to group action items in output.
 */
export type ActionItemGrouping = 'none' | 'assignee' | 'transcript' | 'date';

/**
 * Preset formatting styles for different tools.
 */
export type ActionItemPreset = 'default' | 'notion' | 'obsidian' | 'github';

/**
 * Options for formatting action items as Markdown.
 */
export interface ActionItemsMarkdownOptions {
  /** List item style: checkbox (- [ ]), bullet (-), or numbered (1.) */
  style?: ActionItemStyle;
  /** Group items by: none, assignee, transcript, or date */
  groupBy?: ActionItemGrouping;
  /** Show assignee inline (e.g., @Alice) */
  includeAssignee?: boolean;
  /** Show due date inline (e.g., due: Friday) */
  includeDueDate?: boolean;
  /** Show meeting title for each item */
  includeMeetingTitle?: boolean;
  /** Include summary statistics at the top */
  includeSummary?: boolean;
  /** Formatting preset for specific tools */
  preset?: ActionItemPreset;
}

/**
 * Options for filtering action items.
 */
export interface ActionItemsFilterOptions {
  /** Filter to items assigned to these people (case-insensitive) */
  assignees?: string[];
  /** Only include items with an assignee */
  assignedOnly?: boolean;
  /** Only include items with a due date */
  datedOnly?: boolean;
}

/**
 * An action item with metadata from its source transcript.
 */
export interface AggregatedActionItem extends ActionItem {
  /** ID of the source transcript */
  transcriptId: string;
  /** Title of the source transcript */
  transcriptTitle: string;
  /** Date string of the source transcript (YYYY-MM-DD format or similar) */
  transcriptDate: string;
}

/**
 * Result of aggregating action items across multiple transcripts.
 */
export interface AggregatedActionItemsResult {
  /** All aggregated action items */
  items: AggregatedActionItem[];
  /** Total count of action items */
  totalItems: number;
  /** Number of transcripts processed */
  transcriptsProcessed: number;
  /** Number of transcripts that had action items */
  transcriptsWithItems: number;
  /** Count of items with assignees */
  assignedItems: number;
  /** Count of items with due dates */
  datedItems: number;
  /** Unique assignees found across all items */
  assignees: string[];
  /** Date range of source transcripts */
  dateRange: { earliest: string; latest: string };
}

/**
 * Parameters for exporting action items via SDK.
 */
export interface ExportActionItemsParams {
  /** Start date for transcript filter (ISO 8601) */
  fromDate?: string;
  /** End date for transcript filter (ISO 8601) */
  toDate?: string;
  /** Only transcripts owned by authenticated user */
  mine?: boolean;
  /** Filter by organizer emails */
  organizers?: string[];
  /** Filter by participant emails */
  participants?: string[];
  /** Maximum transcripts to process */
  limit?: number;
  /** Filter options for action items themselves */
  filterOptions?: ActionItemsFilterOptions;
}
