import { describe, expect, it } from 'vitest';
import type { ActionItem, ActionItemsResult } from '../../src/helpers/action-items.js';
import {
  aggregateActionItems,
  filterActionItems,
  formatActionItemsMarkdown,
} from '../../src/helpers/action-items-format.js';
import type {
  AggregatedActionItem,
  AggregatedActionItemsResult,
} from '../../src/types/action-items.js';
import type { Transcript } from '../../src/types/transcript.js';

// Test data factory functions
function createActionItem(overrides: Partial<ActionItem> = {}): ActionItem {
  return {
    text: 'Complete task',
    lineNumber: 1,
    ...overrides,
  };
}

function createAggregatedItem(overrides: Partial<AggregatedActionItem> = {}): AggregatedActionItem {
  return {
    text: 'Complete task',
    lineNumber: 1,
    transcriptId: 'transcript-1',
    transcriptTitle: 'Weekly Standup',
    transcriptDate: '2024-01-15',
    ...overrides,
  };
}

function createTranscript(overrides: Partial<Transcript> = {}): Transcript {
  return {
    id: 'test-id',
    title: 'Test Meeting',
    organizer_email: 'host@company.com',
    speakers: [],
    transcript_url: 'https://app.fireflies.ai/transcript/test-id',
    participants: [],
    meeting_attendees: [],
    meeting_attendance: [],
    fireflies_users: [],
    workspace_users: [],
    duration: 3600,
    dateString: '2024-01-15',
    date: 1705312800000,
    sentences: [],
    channels: [],
    ...overrides,
  };
}

function createActionItemsResult(items: ActionItem[]): ActionItemsResult {
  const assignedItems = items.filter((i) => i.assignee !== undefined).length;
  const datedItems = items.filter((i) => i.dueDate !== undefined).length;
  const itemsWithAssignee = items.filter((i): i is ActionItem & { assignee: string } =>
    Boolean(i.assignee)
  );
  const assignees = [...new Set(itemsWithAssignee.map((i) => i.assignee))];
  return {
    items,
    totalItems: items.length,
    assignedItems,
    datedItems,
    assignees,
  };
}

function createAggregatedResult(items: AggregatedActionItem[]): AggregatedActionItemsResult {
  const assignedItems = items.filter((i) => i.assignee !== undefined).length;
  const datedItems = items.filter((i) => i.dueDate !== undefined).length;
  const itemsWithAssignee = items.filter((i): i is AggregatedActionItem & { assignee: string } =>
    Boolean(i.assignee)
  );
  const assignees = [...new Set(itemsWithAssignee.map((i) => i.assignee))];
  const dates = items.map((i) => i.transcriptDate).filter(Boolean);
  return {
    items,
    totalItems: items.length,
    transcriptsProcessed: new Set(items.map((i) => i.transcriptId)).size,
    transcriptsWithItems: new Set(items.map((i) => i.transcriptId)).size,
    assignedItems,
    datedItems,
    assignees,
    dateRange: {
      earliest: dates.sort()[0] ?? '',
      latest: dates.sort().reverse()[0] ?? '',
    },
  };
}

describe('filterActionItems', () => {
  describe('assignee filtering', () => {
    it('filters by single assignee (case-insensitive)', () => {
      const items = [
        createActionItem({ text: 'Task 1', assignee: 'Alice' }),
        createActionItem({ text: 'Task 2', assignee: 'Bob' }),
        createActionItem({ text: 'Task 3', assignee: 'ALICE' }),
        createActionItem({ text: 'Task 4' }),
      ];

      const result = filterActionItems(items, { assignees: ['alice'] });

      expect(result).toHaveLength(2);
      expect(result.map((i) => i.text)).toEqual(['Task 1', 'Task 3']);
    });

    it('filters by multiple assignees', () => {
      const items = [
        createActionItem({ text: 'Task 1', assignee: 'Alice' }),
        createActionItem({ text: 'Task 2', assignee: 'Bob' }),
        createActionItem({ text: 'Task 3', assignee: 'Charlie' }),
        createActionItem({ text: 'Task 4' }),
      ];

      const result = filterActionItems(items, { assignees: ['Alice', 'Charlie'] });

      expect(result).toHaveLength(2);
      expect(result.map((i) => i.text)).toEqual(['Task 1', 'Task 3']);
    });

    it('returns all items when assignees is empty array', () => {
      const items = [
        createActionItem({ text: 'Task 1', assignee: 'Alice' }),
        createActionItem({ text: 'Task 2' }),
      ];

      const result = filterActionItems(items, { assignees: [] });

      expect(result).toHaveLength(2);
    });
  });

  describe('assigned-only filtering', () => {
    it('filters to assigned-only items', () => {
      const items = [
        createActionItem({ text: 'Task 1', assignee: 'Alice' }),
        createActionItem({ text: 'Task 2' }),
        createActionItem({ text: 'Task 3', assignee: 'Bob' }),
        createActionItem({ text: 'Task 4' }),
      ];

      const result = filterActionItems(items, { assignedOnly: true });

      expect(result).toHaveLength(2);
      expect(result.map((i) => i.text)).toEqual(['Task 1', 'Task 3']);
    });

    it('returns all items when assignedOnly is false', () => {
      const items = [
        createActionItem({ text: 'Task 1', assignee: 'Alice' }),
        createActionItem({ text: 'Task 2' }),
      ];

      const result = filterActionItems(items, { assignedOnly: false });

      expect(result).toHaveLength(2);
    });
  });

  describe('dated-only filtering', () => {
    it('filters to dated-only items', () => {
      const items = [
        createActionItem({ text: 'Task 1', dueDate: 'Friday' }),
        createActionItem({ text: 'Task 2' }),
        createActionItem({ text: 'Task 3', dueDate: 'EOD' }),
        createActionItem({ text: 'Task 4' }),
      ];

      const result = filterActionItems(items, { datedOnly: true });

      expect(result).toHaveLength(2);
      expect(result.map((i) => i.text)).toEqual(['Task 1', 'Task 3']);
    });

    it('returns all items when datedOnly is false', () => {
      const items = [
        createActionItem({ text: 'Task 1', dueDate: 'Friday' }),
        createActionItem({ text: 'Task 2' }),
      ];

      const result = filterActionItems(items, { datedOnly: false });

      expect(result).toHaveLength(2);
    });
  });

  describe('combined filters', () => {
    it('combines filters with AND logic', () => {
      const items = [
        createActionItem({ text: 'Task 1', assignee: 'Alice', dueDate: 'Friday' }),
        createActionItem({ text: 'Task 2', assignee: 'Alice' }),
        createActionItem({ text: 'Task 3', dueDate: 'Friday' }),
        createActionItem({ text: 'Task 4', assignee: 'Bob', dueDate: 'EOD' }),
        createActionItem({ text: 'Task 5' }),
      ];

      const result = filterActionItems(items, {
        assignees: ['Alice'],
        datedOnly: true,
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.text).toBe('Task 1');
    });

    it('combines assignedOnly and datedOnly', () => {
      const items = [
        createActionItem({ text: 'Task 1', assignee: 'Alice', dueDate: 'Friday' }),
        createActionItem({ text: 'Task 2', assignee: 'Alice' }),
        createActionItem({ text: 'Task 3', dueDate: 'Friday' }),
        createActionItem({ text: 'Task 4' }),
      ];

      const result = filterActionItems(items, {
        assignedOnly: true,
        datedOnly: true,
      });

      expect(result).toHaveLength(1);
      expect(result[0]?.text).toBe('Task 1');
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty input', () => {
      const result = filterActionItems([], { assignees: ['Alice'] });
      expect(result).toEqual([]);
    });

    it('returns all items when no filters specified', () => {
      const items = [
        createActionItem({ text: 'Task 1', assignee: 'Alice' }),
        createActionItem({ text: 'Task 2' }),
      ];

      const result = filterActionItems(items, {});

      expect(result).toHaveLength(2);
    });

    it('preserves item order after filtering', () => {
      const items = [
        createActionItem({ text: 'Task 1', assignee: 'Alice', lineNumber: 1 }),
        createActionItem({ text: 'Task 2', lineNumber: 2 }),
        createActionItem({ text: 'Task 3', assignee: 'Alice', lineNumber: 3 }),
      ];

      const result = filterActionItems(items, { assignees: ['Alice'] });

      expect(result[0]?.lineNumber).toBe(1);
      expect(result[1]?.lineNumber).toBe(3);
    });

    it('works with aggregated action items', () => {
      const items = [
        createAggregatedItem({ text: 'Task 1', assignee: 'Alice' }),
        createAggregatedItem({ text: 'Task 2', assignee: 'Bob' }),
      ];

      const result = filterActionItems(items, { assignees: ['Alice'] });

      expect(result).toHaveLength(1);
      expect(result[0]?.text).toBe('Task 1');
      // Type should be preserved
      expect((result[0] as AggregatedActionItem).transcriptId).toBe('transcript-1');
    });
  });
});

describe('aggregateActionItems', () => {
  describe('basic aggregation', () => {
    it('extracts items from all transcripts', () => {
      const transcripts = [
        createTranscript({
          id: 'transcript-1',
          title: 'Meeting 1',
          dateString: '2024-01-15',
          summary: { action_items: 'Task 1\nTask 2' },
        }),
        createTranscript({
          id: 'transcript-2',
          title: 'Meeting 2',
          dateString: '2024-01-16',
          summary: { action_items: 'Task 3' },
        }),
      ];

      const result = aggregateActionItems(transcripts);

      expect(result.items).toHaveLength(3);
      expect(result.totalItems).toBe(3);
      expect(result.transcriptsProcessed).toBe(2);
    });

    it('attaches transcript metadata to each item', () => {
      const transcripts = [
        createTranscript({
          id: 'transcript-1',
          title: 'Weekly Standup',
          dateString: '2024-01-15',
          summary: { action_items: 'Complete docs' },
        }),
      ];

      const result = aggregateActionItems(transcripts);

      expect(result.items[0]).toMatchObject({
        transcriptId: 'transcript-1',
        transcriptTitle: 'Weekly Standup',
        transcriptDate: '2024-01-15',
      });
    });

    it('handles transcripts with no action items', () => {
      const transcripts = [
        createTranscript({
          id: 'transcript-1',
          title: 'Meeting 1',
          summary: { action_items: 'Task 1' },
        }),
        createTranscript({
          id: 'transcript-2',
          title: 'Meeting 2',
          summary: {}, // No action items
        }),
        createTranscript({
          id: 'transcript-3',
          title: 'Meeting 3',
          // No summary at all
        }),
      ];

      const result = aggregateActionItems(transcripts);

      expect(result.items).toHaveLength(1);
      expect(result.transcriptsProcessed).toBe(3);
      expect(result.transcriptsWithItems).toBe(1);
    });
  });

  describe('statistics calculation', () => {
    it('calculates stats correctly', () => {
      const transcripts = [
        createTranscript({
          id: 't1',
          dateString: '2024-01-15',
          summary: { action_items: '@Alice Task 1 by Friday\n@Bob Task 2\nTask 3' },
        }),
        createTranscript({
          id: 't2',
          dateString: '2024-01-16',
          summary: { action_items: '@Alice Task 4 by EOD' },
        }),
      ];

      const result = aggregateActionItems(transcripts);

      expect(result.totalItems).toBe(4);
      expect(result.assignedItems).toBe(3);
      expect(result.datedItems).toBe(2);
      expect(result.assignees).toContain('Alice');
      expect(result.assignees).toContain('Bob');
      expect(result.transcriptsProcessed).toBe(2);
      expect(result.transcriptsWithItems).toBe(2);
    });

    it('calculates date range correctly', () => {
      const transcripts = [
        createTranscript({ id: 't1', dateString: '2024-01-20', summary: { action_items: 'Task' } }),
        createTranscript({ id: 't2', dateString: '2024-01-10', summary: { action_items: 'Task' } }),
        createTranscript({ id: 't3', dateString: '2024-01-15', summary: { action_items: 'Task' } }),
      ];

      const result = aggregateActionItems(transcripts);

      expect(result.dateRange.earliest).toBe('2024-01-10');
      expect(result.dateRange.latest).toBe('2024-01-20');
    });

    it('handles empty transcripts array', () => {
      const result = aggregateActionItems([]);

      expect(result.items).toEqual([]);
      expect(result.totalItems).toBe(0);
      expect(result.transcriptsProcessed).toBe(0);
      expect(result.transcriptsWithItems).toBe(0);
      expect(result.dateRange).toEqual({ earliest: '', latest: '' });
    });
  });

  describe('filtering integration', () => {
    it('applies filter options during aggregation', () => {
      const transcripts = [
        createTranscript({
          id: 't1',
          summary: { action_items: '@Alice Task 1\n@Bob Task 2' },
        }),
      ];

      const result = aggregateActionItems(transcripts, {}, { assignees: ['Alice'] });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.assignee).toBe('Alice');
    });
  });
});

describe('formatActionItemsMarkdown', () => {
  describe('style formatting', () => {
    it('formats as checkboxes by default', () => {
      const result = createActionItemsResult([
        createActionItem({ text: 'Task 1' }),
        createActionItem({ text: 'Task 2' }),
      ]);

      const markdown = formatActionItemsMarkdown(result);

      expect(markdown).toContain('- [ ] Task 1');
      expect(markdown).toContain('- [ ] Task 2');
    });

    it('formats as bullets with style: bullet', () => {
      const result = createActionItemsResult([
        createActionItem({ text: 'Task 1' }),
        createActionItem({ text: 'Task 2' }),
      ]);

      const markdown = formatActionItemsMarkdown(result, { style: 'bullet' });

      expect(markdown).toContain('- Task 1');
      expect(markdown).toContain('- Task 2');
      expect(markdown).not.toContain('[ ]');
    });

    it('formats as numbered list', () => {
      const result = createActionItemsResult([
        createActionItem({ text: 'Task 1' }),
        createActionItem({ text: 'Task 2' }),
      ]);

      const markdown = formatActionItemsMarkdown(result, { style: 'numbered' });

      expect(markdown).toContain('1. Task 1');
      expect(markdown).toContain('2. Task 2');
    });
  });

  describe('inline metadata', () => {
    it('includes assignee inline when enabled', () => {
      const result = createActionItemsResult([
        createActionItem({ text: 'Task 1', assignee: 'Alice' }),
        createActionItem({ text: 'Task 2' }),
      ]);

      const markdown = formatActionItemsMarkdown(result, { includeAssignee: true });

      expect(markdown).toContain('@Alice');
    });

    it('includes due date inline when enabled', () => {
      const result = createActionItemsResult([
        createActionItem({ text: 'Task 1', dueDate: 'Friday' }),
        createActionItem({ text: 'Task 2' }),
      ]);

      const markdown = formatActionItemsMarkdown(result, { includeDueDate: true });

      expect(markdown).toContain('due: Friday');
    });

    it('includes meeting title when enabled for aggregated results', () => {
      const result = createAggregatedResult([
        createAggregatedItem({ text: 'Task 1', transcriptTitle: 'Weekly Standup' }),
      ]);

      const markdown = formatActionItemsMarkdown(result, { includeMeetingTitle: true });

      expect(markdown).toContain('Weekly Standup');
    });
  });

  describe('grouping', () => {
    it('groups by assignee with headers', () => {
      const result = createAggregatedResult([
        createAggregatedItem({ text: 'Task 1', assignee: 'Alice' }),
        createAggregatedItem({ text: 'Task 2', assignee: 'Bob' }),
        createAggregatedItem({ text: 'Task 3', assignee: 'Alice' }),
        createAggregatedItem({ text: 'Task 4' }),
      ]);

      const markdown = formatActionItemsMarkdown(result, { groupBy: 'assignee' });

      expect(markdown).toContain('### Alice');
      expect(markdown).toContain('### Bob');
      expect(markdown).toContain('### Unassigned');
    });

    it('groups by transcript', () => {
      const result = createAggregatedResult([
        createAggregatedItem({ text: 'Task 1', transcriptTitle: 'Meeting A' }),
        createAggregatedItem({ text: 'Task 2', transcriptTitle: 'Meeting B' }),
        createAggregatedItem({ text: 'Task 3', transcriptTitle: 'Meeting A' }),
      ]);

      const markdown = formatActionItemsMarkdown(result, { groupBy: 'transcript' });

      expect(markdown).toContain('### Meeting A');
      expect(markdown).toContain('### Meeting B');
    });

    it('groups by date', () => {
      const result = createAggregatedResult([
        createAggregatedItem({ text: 'Task 1', transcriptDate: '2024-01-15' }),
        createAggregatedItem({ text: 'Task 2', transcriptDate: '2024-01-16' }),
        createAggregatedItem({ text: 'Task 3', transcriptDate: '2024-01-15' }),
      ]);

      const markdown = formatActionItemsMarkdown(result, { groupBy: 'date' });

      expect(markdown).toContain('### 2024-01-15');
      expect(markdown).toContain('### 2024-01-16');
    });

    it('does not group when groupBy is none', () => {
      const result = createAggregatedResult([
        createAggregatedItem({ text: 'Task 1', assignee: 'Alice' }),
        createAggregatedItem({ text: 'Task 2', assignee: 'Bob' }),
      ]);

      const markdown = formatActionItemsMarkdown(result, { groupBy: 'none' });

      expect(markdown).not.toContain('### Alice');
      expect(markdown).not.toContain('### Bob');
    });
  });

  describe('summary', () => {
    it('includes summary when enabled', () => {
      const result = createAggregatedResult([
        createAggregatedItem({ text: 'Task 1', assignee: 'Alice', dueDate: 'Friday' }),
        createAggregatedItem({ text: 'Task 2', assignee: 'Bob' }),
        createAggregatedItem({ text: 'Task 3' }),
      ]);

      const markdown = formatActionItemsMarkdown(result, { includeSummary: true });

      expect(markdown).toContain('3 items');
      expect(markdown).toContain('2 assigned');
      expect(markdown).toContain('1 with due dates');
    });

    it('excludes summary by default', () => {
      const result = createAggregatedResult([createAggregatedItem({ text: 'Task 1' })]);

      const markdown = formatActionItemsMarkdown(result);

      expect(markdown).not.toContain('Summary');
      expect(markdown).not.toContain('items from');
    });
  });

  describe('presets', () => {
    it('applies notion preset correctly', () => {
      const result = createAggregatedResult([
        createAggregatedItem({ text: 'Task 1', assignee: 'Alice', dueDate: 'Friday' }),
      ]);

      const markdown = formatActionItemsMarkdown(result, { preset: 'notion' });

      // Notion uses checkboxes and @mentions
      expect(markdown).toContain('- [ ]');
      expect(markdown).toContain('@Alice');
    });

    it('applies obsidian preset correctly', () => {
      const result = createAggregatedResult([
        createAggregatedItem({ text: 'Task 1', assignee: 'Alice' }),
      ]);

      const markdown = formatActionItemsMarkdown(result, { preset: 'obsidian' });

      // Obsidian uses checkboxes
      expect(markdown).toContain('- [ ]');
    });

    it('applies github preset correctly', () => {
      const result = createAggregatedResult([
        createAggregatedItem({ text: 'Task 1', assignee: 'Alice' }),
      ]);

      const markdown = formatActionItemsMarkdown(result, { preset: 'github' });

      // GitHub uses checkboxes and @mentions
      expect(markdown).toContain('- [ ]');
      expect(markdown).toContain('@Alice');
    });
  });

  describe('markdown escaping', () => {
    it('escapes markdown special characters in text', () => {
      const result = createActionItemsResult([
        createActionItem({ text: 'Fix bug #123 with *important* changes' }),
      ]);

      const markdown = formatActionItemsMarkdown(result);

      // Should escape # and * to prevent markdown interpretation
      expect(markdown).toContain('\\#123');
      expect(markdown).toContain('\\*important\\*');
    });

    it('preserves text meaning after escaping', () => {
      const result = createActionItemsResult([
        createActionItem({ text: 'Review [PR](link) and update _docs_' }),
      ]);

      const markdown = formatActionItemsMarkdown(result);

      // Should contain escaped versions
      expect(markdown).toContain('\\[PR\\]');
      expect(markdown).toContain('\\_docs\\_');
    });
  });

  describe('edge cases', () => {
    it('handles empty items array', () => {
      const result = createActionItemsResult([]);

      const markdown = formatActionItemsMarkdown(result);

      expect(markdown).toBe('');
    });

    it('handles single item', () => {
      const result = createActionItemsResult([createActionItem({ text: 'Single task' })]);

      const markdown = formatActionItemsMarkdown(result);

      expect(markdown).toContain('- [ ] Single task');
    });

    it('works with ActionItemsResult (non-aggregated)', () => {
      const result: ActionItemsResult = {
        items: [createActionItem({ text: 'Task 1' })],
        totalItems: 1,
        assignedItems: 0,
        datedItems: 0,
        assignees: [],
      };

      const markdown = formatActionItemsMarkdown(result);

      expect(markdown).toContain('- [ ] Task 1');
    });
  });
});
