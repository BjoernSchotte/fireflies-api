import { describe, expect, it } from 'vitest';
import { renderDigest, renderTemplate } from '../../src/helpers/digest-templates.js';
import type { WeeklyDigest } from '../../src/types/digest.js';

/**
 * Factory function to create test digests.
 */
function createDigest(overrides: Partial<WeeklyDigest> = {}): WeeklyDigest {
  return {
    period: { from: '2024-01-08', to: '2024-01-14' },
    totalMeetings: 5,
    totalDuration: 300,
    stats: {
      totalMeetings: 5,
      totalMinutes: 300,
      averageDuration: 60,
      busiestDay: 'monday',
      meetingsByDay: { monday: 2, tuesday: 1, wednesday: 2 },
    },
    actionItems: {
      total: 10,
      byAssignee: {
        Alice: [
          {
            text: 'Review proposal',
            assignee: 'Alice',
            lineNumber: 1,
            transcriptId: 't1',
            transcriptTitle: 'Meeting 1',
            transcriptDate: '2024-01-08T10:00:00Z',
          },
        ],
        Bob: [
          {
            text: 'Update docs',
            assignee: 'Bob',
            lineNumber: 2,
            transcriptId: 't2',
            transcriptTitle: 'Meeting 2',
            transcriptDate: '2024-01-09T10:00:00Z',
          },
        ],
      },
      byMeeting: [
        {
          id: 't1',
          title: 'Meeting 1',
          date: '2024-01-08T10:00:00Z',
          duration: 30,
          participants: [
            { email: 'alice@company.com', name: 'Alice Smith' },
            { email: 'bob@company.com', name: 'Bob Jones' },
          ],
          items: [
            {
              text: 'Review proposal',
              assignee: 'Alice',
              lineNumber: 1,
              transcriptId: 't1',
              transcriptTitle: 'Meeting 1',
              transcriptDate: '2024-01-08T10:00:00Z',
            },
            {
              text: 'Follow up on budget',
              lineNumber: 3,
              transcriptId: 't1',
              transcriptTitle: 'Meeting 1',
              transcriptDate: '2024-01-08T10:00:00Z',
            },
          ],
        },
        {
          id: 't2',
          title: 'Meeting 2',
          date: '2024-01-09T10:00:00Z',
          duration: 60,
          participants: [{ email: 'bob@company.com', name: 'Bob Jones' }],
          items: [
            {
              text: 'Update docs',
              assignee: 'Bob',
              lineNumber: 2,
              transcriptId: 't2',
              transcriptTitle: 'Meeting 2',
              transcriptDate: '2024-01-09T10:00:00Z',
            },
          ],
        },
      ],
      unassigned: [
        {
          text: 'Follow up on budget',
          lineNumber: 3,
          transcriptId: 't1',
          transcriptTitle: 'Meeting 1',
          transcriptDate: '2024-01-08T10:00:00Z',
        },
      ],
      withDueDates: [],
    },
    highlights: [
      {
        meetingId: 't1',
        meetingTitle: 'Team Standup',
        meetingDate: '2024-01-08T10:00:00Z',
        keyPoints: ['Discussed project progress', 'Set timeline for Q1'],
        decisions: ['Approved budget increase'],
      },
    ],
    participants: [
      { email: 'alice@company.com', name: 'Alice', meetingCount: 5, totalMinutes: 300 },
      { email: 'bob@company.com', name: 'Bob', meetingCount: 3, totalMinutes: 180 },
    ],
    meetings: [
      {
        id: 't1',
        title: 'Team Standup',
        date: '2024-01-08T10:00:00Z',
        duration: 30,
        participants: 3,
      },
      {
        id: 't2',
        title: 'Client Call',
        date: '2024-01-09T14:00:00Z',
        duration: 60,
        participants: 5,
      },
    ],
    ...overrides,
  };
}

describe('renderTemplate', () => {
  describe('variable substitution', () => {
    it('replaces simple {{variable}} placeholders', () => {
      const template = 'Hello {{name}}!';
      const data = { name: 'World' };

      const result = renderTemplate(template, data);

      expect(result).toBe('Hello World!');
    });

    it('replaces multiple variables', () => {
      const template = '{{greeting}} {{name}}, you have {{count}} messages.';
      const data = { greeting: 'Hello', name: 'Alice', count: 5 };

      const result = renderTemplate(template, data);

      expect(result).toBe('Hello Alice, you have 5 messages.');
    });

    it('handles nested property access with dot notation', () => {
      const template = 'Period: {{period.from}} to {{period.to}}';
      const data = { period: { from: '2024-01-01', to: '2024-01-07' } };

      const result = renderTemplate(template, data);

      expect(result).toBe('Period: 2024-01-01 to 2024-01-07');
    });

    it('handles deeply nested properties', () => {
      const template = 'Value: {{a.b.c.d}}';
      const data = { a: { b: { c: { d: 'deep' } } } };

      const result = renderTemplate(template, data);

      expect(result).toBe('Value: deep');
    });

    it('renders empty string for missing variables', () => {
      const template = 'Hello {{name}}!';
      const data = {};

      const result = renderTemplate(template, data);

      expect(result).toBe('Hello !');
    });

    it('renders empty string for undefined nested properties', () => {
      const template = 'Value: {{a.b.c}}';
      const data = { a: {} };

      const result = renderTemplate(template, data);

      expect(result).toBe('Value: ');
    });

    it('handles zero values correctly', () => {
      const template = 'Count: {{count}}';
      const data = { count: 0 };

      const result = renderTemplate(template, data);

      expect(result).toBe('Count: 0');
    });
  });

  describe('loops', () => {
    it('renders array items with {{#items}}...{{/items}}', () => {
      const template = '{{#items}}* {{name}}\n{{/items}}';
      const data = { items: [{ name: 'Alice' }, { name: 'Bob' }] };

      const result = renderTemplate(template, data);

      expect(result).toBe('* Alice\n* Bob\n');
    });

    it('handles empty arrays', () => {
      const template = '{{#items}}* {{name}}\n{{/items}}';
      const data = { items: [] };

      const result = renderTemplate(template, data);

      expect(result).toBe('');
    });

    it('handles nested loops', () => {
      const template = '{{#groups}}## {{title}}\n{{#items}}- {{text}}\n{{/items}}{{/groups}}';
      const data = {
        groups: [
          { title: 'Group 1', items: [{ text: 'A' }, { text: 'B' }] },
          { title: 'Group 2', items: [{ text: 'C' }] },
        ],
      };

      const result = renderTemplate(template, data);

      expect(result).toBe('## Group 1\n- A\n- B\n## Group 2\n- C\n');
    });

    it('accesses parent context with {{.}} for simple arrays', () => {
      const template = '{{#items}}{{.}}, {{/items}}';
      const data = { items: ['a', 'b', 'c'] };

      const result = renderTemplate(template, data);

      expect(result).toBe('a, b, c, ');
    });

    it('renders missing arrays as empty', () => {
      const template = 'Before{{#items}}{{name}}{{/items}}After';
      const data = {};

      const result = renderTemplate(template, data);

      expect(result).toBe('BeforeAfter');
    });
  });

  describe('conditionals', () => {
    it('renders content when truthy with {{#condition}}...{{/condition}}', () => {
      const template = '{{#showGreeting}}Hello!{{/showGreeting}}';
      const data = { showGreeting: true };

      const result = renderTemplate(template, data);

      expect(result).toBe('Hello!');
    });

    it('hides content when falsy', () => {
      const template = '{{#showGreeting}}Hello!{{/showGreeting}}';
      const data = { showGreeting: false };

      const result = renderTemplate(template, data);

      expect(result).toBe('');
    });

    it('treats non-empty strings as truthy', () => {
      const template = '{{#name}}Hello {{name}}!{{/name}}';
      const data = { name: 'World' };

      const result = renderTemplate(template, data);

      expect(result).toBe('Hello World!');
    });

    it('treats empty strings as falsy', () => {
      const template = '{{#name}}Hello {{name}}!{{/name}}';
      const data = { name: '' };

      const result = renderTemplate(template, data);

      expect(result).toBe('');
    });

    it('treats zero as truthy (numbers)', () => {
      const template = '{{#count}}Count: {{count}}{{/count}}';
      const data = { count: 0 };

      const result = renderTemplate(template, data);

      // Zero is considered truthy for display purposes
      expect(result).toBe('Count: 0');
    });
  });

  describe('filters', () => {
    it('applies duration filter for minutes', () => {
      const template = 'Duration: {{minutes | duration}}';
      const data = { minutes: 90 };

      const result = renderTemplate(template, data);

      expect(result).toBe('Duration: 1h 30m');
    });

    it('handles hours-only duration', () => {
      const template = '{{minutes | duration}}';
      const data = { minutes: 120 };

      const result = renderTemplate(template, data);

      expect(result).toBe('2h 0m');
    });

    it('handles minutes-only duration', () => {
      const template = '{{minutes | duration}}';
      const data = { minutes: 45 };

      const result = renderTemplate(template, data);

      expect(result).toBe('0h 45m');
    });

    it('handles zero duration', () => {
      const template = '{{minutes | duration}}';
      const data = { minutes: 0 };

      const result = renderTemplate(template, data);

      expect(result).toBe('0h 0m');
    });

    it('applies date filter for ISO dates', () => {
      const template = '{{date | date}}';
      const data = { date: '2024-01-15T10:00:00Z' };

      const result = renderTemplate(template, data);

      // Should format to readable date
      expect(result).toMatch(/Jan(uary)?\s+15,?\s+2024/i);
    });

    it('applies lowercase filter', () => {
      const template = '{{text | lowercase}}';
      const data = { text: 'HELLO WORLD' };

      const result = renderTemplate(template, data);

      expect(result).toBe('hello world');
    });

    it('applies uppercase filter', () => {
      const template = '{{text | uppercase}}';
      const data = { text: 'hello world' };

      const result = renderTemplate(template, data);

      expect(result).toBe('HELLO WORLD');
    });

    it('handles unknown filters gracefully', () => {
      const template = '{{text | unknownfilter}}';
      const data = { text: 'hello' };

      const result = renderTemplate(template, data);

      // Unknown filter should pass through unchanged
      expect(result).toBe('hello');
    });
  });

  describe('edge cases', () => {
    it('handles template with no placeholders', () => {
      const template = 'Just plain text.';
      const data = {};

      const result = renderTemplate(template, data);

      expect(result).toBe('Just plain text.');
    });

    it('handles empty template', () => {
      const result = renderTemplate('', {});

      expect(result).toBe('');
    });

    it('preserves whitespace and newlines', () => {
      const template = 'Line 1\n\nLine 2\n  Indented';
      const data = {};

      const result = renderTemplate(template, data);

      expect(result).toBe('Line 1\n\nLine 2\n  Indented');
    });

    it('handles special characters in values', () => {
      const template = '{{text}}';
      const data = { text: 'Hello <World> & "Friends"' };

      const result = renderTemplate(template, data);

      expect(result).toBe('Hello <World> & "Friends"');
    });
  });
});

describe('renderDigest', () => {
  describe('default template', () => {
    it('renders with default template when no option specified', () => {
      const digest = createDigest();

      const result = renderDigest(digest);

      expect(result).toContain('Weekly Meeting Digest');
      expect(result).toContain('2024-01-08');
      expect(result).toContain('2024-01-14');
    });

    it('includes meeting stats', () => {
      const digest = createDigest({ totalMeetings: 5, totalDuration: 300 });

      const result = renderDigest(digest);

      expect(result).toContain('5');
      expect(result).toMatch(/300|5h|5 hours/i); // Duration in some format
    });

    it('includes action items section', () => {
      const digest = createDigest();

      const result = renderDigest(digest);

      expect(result).toContain('Action Items');
      expect(result).toContain('Review proposal');
    });

    it('includes highlights section', () => {
      const digest = createDigest();

      const result = renderDigest(digest);

      expect(result).toContain('Highlights');
      expect(result).toContain('Team Standup');
    });

    it('includes participants section', () => {
      const digest = createDigest();

      const result = renderDigest(digest);

      expect(result).toContain('alice@company.com');
    });
  });

  describe('compact template', () => {
    it('renders minimal output with compact template', () => {
      const digest = createDigest();

      const result = renderDigest(digest, { template: 'compact' });

      // Compact should be shorter
      expect(result.length).toBeLessThan(renderDigest(digest).length);
      // But should still have essentials
      expect(result).toContain('5'); // total meetings
    });
  });

  describe('executive template', () => {
    it('renders executive summary style', () => {
      const digest = createDigest();

      const result = renderDigest(digest, { template: 'executive' });

      expect(result).toContain('Executive Summary');
    });
  });

  describe('custom template', () => {
    it('accepts custom template string', () => {
      const digest = createDigest();
      const customTemplate = '# Custom\nMeetings: {{totalMeetings}}';

      const result = renderDigest(digest, { template: customTemplate });

      expect(result).toBe('# Custom\nMeetings: 5');
    });
  });

  describe('empty digest', () => {
    it('renders empty digest gracefully', () => {
      const emptyDigest = createDigest({
        totalMeetings: 0,
        totalDuration: 0,
        period: { from: '', to: '' },
        stats: {
          totalMeetings: 0,
          totalMinutes: 0,
          averageDuration: 0,
          busiestDay: '',
          meetingsByDay: {},
        },
        actionItems: { total: 0, byAssignee: {}, unassigned: [], withDueDates: [] },
        highlights: [],
        participants: [],
        meetings: [],
      });

      const result = renderDigest(emptyDigest);

      expect(result).toContain('0');
      expect(result).not.toContain('undefined');
    });
  });
});
