import type {
  ActionItemsFilterOptions,
  ActionItemsMarkdownOptions,
  AggregatedActionItem,
  AggregatedActionItemsResult,
} from '../types/action-items.js';
import type { Transcript } from '../types/transcript.js';
import {
  type ActionItem,
  type ActionItemOptions,
  type ActionItemsResult,
  extractActionItems,
} from './action-items.js';

/**
 * Filter action items by criteria.
 *
 * Filters can be combined with AND logic - items must match all specified criteria.
 *
 * @param items - Action items to filter
 * @param options - Filter criteria
 * @returns Filtered items preserving original type and order
 *
 * @example
 * ```typescript
 * // Filter to Alice's items with due dates
 * const filtered = filterActionItems(items, {
 *   assignees: ['Alice'],
 *   datedOnly: true,
 * });
 * ```
 */
export function filterActionItems<T extends ActionItem>(
  items: T[],
  options: ActionItemsFilterOptions
): T[] {
  const { assignees, assignedOnly, datedOnly } = options;

  // Normalize assignees to lowercase for case-insensitive matching
  const normalizedAssignees = assignees?.map((a) => a.toLowerCase());

  return items.filter((item) => {
    // Assignee filter (case-insensitive)
    if (normalizedAssignees && normalizedAssignees.length > 0) {
      if (!item.assignee) return false;
      if (!normalizedAssignees.includes(item.assignee.toLowerCase())) return false;
    }

    // Assigned-only filter
    if (assignedOnly && !item.assignee) {
      return false;
    }

    // Dated-only filter
    if (datedOnly && !item.dueDate) {
      return false;
    }

    return true;
  });
}

/**
 * Aggregate action items from multiple transcripts.
 *
 * Extracts action items from each transcript and attaches source metadata
 * (transcript ID, title, date) to each item.
 *
 * @param transcripts - Transcripts to extract action items from
 * @param extractionOptions - Options for action item extraction
 * @param filterOptions - Options to filter extracted items
 * @returns Aggregated result with items and statistics
 *
 * @example
 * ```typescript
 * const result = aggregateActionItems(transcripts);
 * console.log(`${result.totalItems} items from ${result.transcriptsProcessed} meetings`);
 * ```
 */
export function aggregateActionItems(
  transcripts: Transcript[],
  extractionOptions?: ActionItemOptions,
  filterOptions?: ActionItemsFilterOptions
): AggregatedActionItemsResult {
  if (transcripts.length === 0) {
    return emptyAggregatedResult();
  }

  const allItems: AggregatedActionItem[] = [];
  let transcriptsWithItems = 0;

  for (const transcript of transcripts) {
    const extracted = extractActionItems(transcript, extractionOptions);

    if (extracted.items.length > 0) {
      transcriptsWithItems++;

      for (const item of extracted.items) {
        allItems.push({
          ...item,
          transcriptId: transcript.id,
          transcriptTitle: transcript.title,
          transcriptDate: transcript.dateString,
        });
      }
    }
  }

  // Apply filter if provided
  const filteredItems = filterOptions ? filterActionItems(allItems, filterOptions) : allItems;

  return buildAggregatedResult(filteredItems, transcripts.length, transcriptsWithItems);
}

function emptyAggregatedResult(): AggregatedActionItemsResult {
  return {
    items: [],
    totalItems: 0,
    transcriptsProcessed: 0,
    transcriptsWithItems: 0,
    assignedItems: 0,
    datedItems: 0,
    assignees: [],
    dateRange: { earliest: '', latest: '' },
  };
}

function buildAggregatedResult(
  items: AggregatedActionItem[],
  transcriptsProcessed: number,
  transcriptsWithItems: number
): AggregatedActionItemsResult {
  const assigneeSet = new Set<string>();
  let assignedItems = 0;
  let datedItems = 0;

  for (const item of items) {
    if (item.assignee) {
      assigneeSet.add(item.assignee);
      assignedItems++;
    }
    if (item.dueDate) {
      datedItems++;
    }
  }

  const dates = items
    .map((i) => i.transcriptDate)
    .filter(Boolean)
    .sort();

  return {
    items,
    totalItems: items.length,
    transcriptsProcessed,
    transcriptsWithItems,
    assignedItems,
    datedItems,
    assignees: Array.from(assigneeSet),
    dateRange: {
      earliest: dates[0] ?? '',
      latest: dates[dates.length - 1] ?? '',
    },
  };
}

/** Check if result is an aggregated result (has transcript metadata) */
function isAggregatedResult(
  result: ActionItemsResult | AggregatedActionItemsResult
): result is AggregatedActionItemsResult {
  return 'transcriptsProcessed' in result;
}

/** Check if item is an aggregated item (has transcript metadata) */
function isAggregatedItem(item: ActionItem): item is AggregatedActionItem {
  return 'transcriptId' in item;
}

/** Escape markdown special characters in text */
function escapeMarkdown(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/#/g, '\\#')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/_/g, '\\_')
    .replace(/`/g, '\\`');
}

/** Get preset options */
function getPresetOptions(
  preset: ActionItemsMarkdownOptions['preset']
): Partial<ActionItemsMarkdownOptions> {
  switch (preset) {
    case 'notion':
      return {
        style: 'checkbox',
        includeAssignee: true,
        includeDueDate: true,
      };
    case 'obsidian':
      return {
        style: 'checkbox',
        includeAssignee: false,
        includeDueDate: true,
      };
    case 'github':
      return {
        style: 'checkbox',
        includeAssignee: true,
        includeDueDate: true,
      };
    default:
      return {};
  }
}

/** Format a single item as markdown */
function formatItem(
  item: ActionItem | AggregatedActionItem,
  index: number,
  options: Required<
    Pick<
      ActionItemsMarkdownOptions,
      'style' | 'includeAssignee' | 'includeDueDate' | 'includeMeetingTitle'
    >
  >
): string {
  const { style, includeAssignee, includeDueDate, includeMeetingTitle } = options;

  // Build prefix based on style
  let prefix: string;
  switch (style) {
    case 'bullet':
      prefix = '-';
      break;
    case 'numbered':
      prefix = `${index + 1}.`;
      break;
    default:
      prefix = '- [ ]';
      break;
  }

  // Build the item text
  let text = escapeMarkdown(item.text);

  // Add inline metadata
  const metadata: string[] = [];
  if (includeAssignee && item.assignee) {
    metadata.push(`@${item.assignee}`);
  }
  if (includeDueDate && item.dueDate) {
    metadata.push(`due: ${item.dueDate}`);
  }
  if (includeMeetingTitle && isAggregatedItem(item)) {
    metadata.push(`*${item.transcriptTitle}*`);
  }

  if (metadata.length > 0) {
    text += ` (${metadata.join(', ')})`;
  }

  return `${prefix} ${text}`;
}

/** Group items by a key function */
function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}

/** Format summary line for aggregated result */
function formatSummaryLine(result: AggregatedActionItemsResult): string {
  return `**Summary:** ${result.totalItems} items from ${result.transcriptsProcessed} meetings (${result.assignedItems} assigned, ${result.datedItems} with due dates)`;
}

/** Sort group keys with Unassigned last */
function sortGroupKeys(keys: string[]): string[] {
  return keys.sort((a, b) => {
    if (a === 'Unassigned') return 1;
    if (b === 'Unassigned') return -1;
    return a.localeCompare(b);
  });
}

type ItemOptions = Required<
  Pick<
    ActionItemsMarkdownOptions,
    'style' | 'includeAssignee' | 'includeDueDate' | 'includeMeetingTitle'
  >
>;

/** Format items as grouped markdown sections */
function formatGroupedItems(
  result: AggregatedActionItemsResult,
  groupByOption: 'assignee' | 'transcript' | 'date',
  itemOptions: ItemOptions
): string[] {
  const lines: string[] = [];
  const keyFn = getGroupKeyFn(groupByOption);
  const groups = groupBy(result.items, keyFn);
  const sortedKeys = sortGroupKeys(Array.from(groups.keys()));

  for (const key of sortedKeys) {
    const groupItems = groups.get(key);
    if (!groupItems) continue;

    lines.push(`### ${key}`);
    lines.push('');
    groupItems.forEach((item, index) => {
      lines.push(formatItem(item, index, itemOptions));
    });
    lines.push('');
  }

  return lines;
}

/** Format items as flat list */
function formatFlatItems(items: ActionItem[], itemOptions: ItemOptions): string[] {
  return items.map((item, index) => formatItem(item, index, itemOptions));
}

/**
 * Format action items as Markdown.
 *
 * Supports multiple styles (checkbox, bullet, numbered), grouping options,
 * inline metadata, and presets for popular tools.
 *
 * @param result - Action items result (single or aggregated)
 * @param options - Formatting options
 * @returns Formatted markdown string
 *
 * @example
 * ```typescript
 * const markdown = formatActionItemsMarkdown(result, {
 *   style: 'checkbox',
 *   groupBy: 'assignee',
 *   includeSummary: true,
 *   preset: 'notion',
 * });
 * ```
 */
export function formatActionItemsMarkdown(
  result: ActionItemsResult | AggregatedActionItemsResult,
  options: ActionItemsMarkdownOptions = {}
): string {
  if (result.items.length === 0) {
    return '';
  }

  const presetOptions = getPresetOptions(options.preset);
  const mergedOptions = { ...presetOptions, ...options };

  const {
    style = 'checkbox',
    groupBy: groupByOption = 'none',
    includeAssignee = false,
    includeDueDate = false,
    includeMeetingTitle = false,
    includeSummary = false,
  } = mergedOptions;

  const lines: string[] = [];

  if (includeSummary && isAggregatedResult(result)) {
    lines.push(formatSummaryLine(result));
    lines.push('');
  }

  const itemOptions = { style, includeAssignee, includeDueDate, includeMeetingTitle };

  const shouldGroup = groupByOption !== 'none' && isAggregatedResult(result);
  if (shouldGroup) {
    lines.push(...formatGroupedItems(result, groupByOption, itemOptions));
  } else {
    lines.push(...formatFlatItems(result.items, itemOptions));
  }

  return lines.join('\n').trim();
}

/** Get the grouping key function */
function getGroupKeyFn(
  groupBy: 'assignee' | 'transcript' | 'date'
): (item: AggregatedActionItem) => string {
  switch (groupBy) {
    case 'assignee':
      return (item) => item.assignee ?? 'Unassigned';
    case 'transcript':
      return (item) => item.transcriptTitle;
    case 'date':
      return (item) => item.transcriptDate;
  }
}
