import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  output,
  outputActionItems,
  outputLine,
  outputSpeakerAnalytics,
  writeLine,
} from '../../src/cli/utils/output.js';
import type { ActionItemsResult } from '../../src/helpers/action-items.js';
import type { SpeakerAnalytics } from '../../src/helpers/speaker-analytics.js';

describe('CLI output utilities', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    stdoutWriteSpy.mockRestore();
  });

  describe('output with json format', () => {
    it('outputs JSON with pretty printing', () => {
      output({ foo: 'bar' }, 'json');
      expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify({ foo: 'bar' }, null, 2));
    });

    it('outputs arrays as JSON', () => {
      output([1, 2, 3], 'json');
      expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify([1, 2, 3], null, 2));
    });

    it('outputs primitives as JSON', () => {
      output('hello', 'json');
      expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify('hello', null, 2));
    });
  });

  describe('output with table format', () => {
    it('outputs array of objects as table', () => {
      output(
        [
          { id: '1', name: 'Alice' },
          { id: '2', name: 'Bob' },
        ],
        'table'
      );

      // Should output header, separator, and rows
      expect(consoleLogSpy).toHaveBeenCalledTimes(4);
      const calls = consoleLogSpy.mock.calls.map((c) => c[0]);
      expect(calls[0]).toContain('id');
      expect(calls[0]).toContain('name');
      expect(calls[1]).toMatch(/^-+/); // separator
      expect(calls[2]).toContain('1');
      expect(calls[2]).toContain('Alice');
    });

    it('outputs object as key-value pairs', () => {
      output({ id: '123', status: 'active' }, 'table');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      const calls = consoleLogSpy.mock.calls.map((c) => c[0]);
      expect(calls[0]).toContain('id');
      expect(calls[0]).toContain('123');
      expect(calls[1]).toContain('status');
      expect(calls[1]).toContain('active');
    });

    it('outputs empty array message', () => {
      output([], 'table');
      expect(consoleLogSpy).toHaveBeenCalledWith('(no data)');
    });

    it('handles nested objects in table', () => {
      output([{ id: '1', meta: { nested: true } }], 'table');
      const calls = consoleLogSpy.mock.calls.map((c) => c[0]);
      // Nested objects should be shown as [object]
      expect(calls[2]).toContain('[object]');
    });

    it('handles arrays in table', () => {
      output([{ id: '1', tags: ['a', 'b', 'c'] }], 'table');
      const calls = consoleLogSpy.mock.calls.map((c) => c[0]);
      // Arrays should show count
      expect(calls[2]).toContain('[3 items]');
    });

    it('handles null and undefined values', () => {
      output([{ id: '1', value: null, other: undefined }], 'table');
      // Should not throw, values should be empty strings
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('output with plain format', () => {
    it('outputs strings directly', () => {
      output('hello world', 'plain');
      expect(consoleLogSpy).toHaveBeenCalledWith('hello world');
    });

    it('outputs objects as JSON string', () => {
      output({ foo: 'bar' }, 'plain');
      expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify({ foo: 'bar' }));
    });
  });

  describe('writeLine', () => {
    it('writes to stdout with newline', () => {
      writeLine('test');
      expect(stdoutWriteSpy).toHaveBeenCalledWith('test\n');
    });

    it('writes empty string with newline', () => {
      writeLine('');
      expect(stdoutWriteSpy).toHaveBeenCalledWith('\n');
    });
  });

  describe('outputLine', () => {
    it('outputs object as JSON line', () => {
      outputLine({ id: '1' });
      expect(stdoutWriteSpy).toHaveBeenCalledWith('{"id":"1"}\n');
    });

    it('outputs array as JSON line', () => {
      outputLine([1, 2, 3]);
      expect(stdoutWriteSpy).toHaveBeenCalledWith('[1,2,3]\n');
    });

    it('outputs primitive as JSON line', () => {
      outputLine('hello');
      expect(stdoutWriteSpy).toHaveBeenCalledWith('"hello"\n');
    });
  });

  describe('output with jsonl format', () => {
    it('outputs array items as separate lines', () => {
      output([{ id: '1' }, { id: '2' }], 'jsonl');
      expect(stdoutWriteSpy).toHaveBeenCalledTimes(2);
      expect(stdoutWriteSpy).toHaveBeenNthCalledWith(1, '{"id":"1"}\n');
      expect(stdoutWriteSpy).toHaveBeenNthCalledWith(2, '{"id":"2"}\n');
    });

    it('outputs single object as one line', () => {
      output({ id: '1' }, 'jsonl');
      expect(stdoutWriteSpy).toHaveBeenCalledTimes(1);
      expect(stdoutWriteSpy).toHaveBeenCalledWith('{"id":"1"}\n');
    });

    it('outputs empty array as nothing', () => {
      output([], 'jsonl');
      expect(stdoutWriteSpy).not.toHaveBeenCalled();
    });

    it('outputs primitives as JSON lines', () => {
      output('hello', 'jsonl');
      expect(stdoutWriteSpy).toHaveBeenCalledWith('"hello"\n');
    });
  });

  describe('output with tsv format', () => {
    it('outputs header and rows tab-separated', () => {
      output([{ id: '1', name: 'Alice' }], 'tsv');
      const calls = stdoutWriteSpy.mock.calls.map((c) => c[0]);
      expect(calls[0]).toBe('id\tname\n');
      expect(calls[1]).toBe('1\tAlice\n');
    });

    it('handles multiple rows', () => {
      output(
        [
          { id: '1', name: 'Alice' },
          { id: '2', name: 'Bob' },
        ],
        'tsv'
      );
      expect(stdoutWriteSpy).toHaveBeenCalledTimes(3); // header + 2 rows
      const calls = stdoutWriteSpy.mock.calls.map((c) => c[0]);
      expect(calls[0]).toBe('id\tname\n');
      expect(calls[1]).toBe('1\tAlice\n');
      expect(calls[2]).toBe('2\tBob\n');
    });

    it('escapes tabs in values', () => {
      output([{ text: 'has\ttab' }], 'tsv');
      const calls = stdoutWriteSpy.mock.calls.map((c) => c[0]);
      expect(calls[1]).toBe('has tab\n'); // tab replaced with space
    });

    it('escapes newlines in values', () => {
      output([{ text: 'line1\nline2' }], 'tsv');
      const calls = stdoutWriteSpy.mock.calls.map((c) => c[0]);
      expect(calls[1]).toBe('line1 line2\n'); // newline replaced with space
    });

    it('handles null and undefined values', () => {
      output([{ a: null, b: undefined, c: 'value' }], 'tsv');
      const calls = stdoutWriteSpy.mock.calls.map((c) => c[0]);
      expect(calls[0]).toBe('a\tb\tc\n');
      expect(calls[1]).toBe('\t\tvalue\n'); // null/undefined become empty
    });

    it('serializes nested objects as JSON', () => {
      output([{ id: '1', meta: { nested: true } }], 'tsv');
      const calls = stdoutWriteSpy.mock.calls.map((c) => c[0]);
      expect(calls[1]).toBe('1\t{"nested":true}\n');
    });

    it('outputs nothing for empty array', () => {
      output([], 'tsv');
      expect(stdoutWriteSpy).not.toHaveBeenCalled();
    });

    it('outputs nothing for non-array data', () => {
      output({ id: '1' }, 'tsv');
      expect(stdoutWriteSpy).not.toHaveBeenCalled();
    });
  });

  describe('outputSpeakerAnalytics', () => {
    const sampleAnalytics: SpeakerAnalytics = {
      speakers: [
        {
          name: 'Alice',
          id: 'speaker-1',
          talkTime: 240,
          talkTimePercentage: 57,
          sentenceCount: 20,
          wordCount: 715,
          wordsPerMinute: 179,
          averageSentenceLength: 35.75,
          turnCount: 5,
        },
        {
          name: 'Bob',
          id: 'speaker-2',
          talkTime: 181,
          talkTimePercentage: 43,
          sentenceCount: 15,
          wordCount: 462,
          wordsPerMinute: 154,
          averageSentenceLength: 30.8,
          turnCount: 3,
        },
      ],
      totalDuration: 780,
      totalTalkTime: 421,
      totalSentences: 35,
      totalWords: 1177,
      dominantSpeaker: 'Alice',
      dominantSpeakerPercentage: 57,
      balance: 'unbalanced',
    };

    it('outputs plain format as human-readable summary', () => {
      outputSpeakerAnalytics(sampleAnalytics, 'plain');

      const calls = stdoutWriteSpy.mock.calls.map((c) => c[0]);
      // Should have meeting overview, dominant speaker line, empty line, and speaker lines
      expect(calls.length).toBeGreaterThanOrEqual(4);
      expect(calls[0]).toContain('13 min'); // 780 / 60 rounded
      expect(calls[0]).toContain('2 speakers');
      expect(calls[0]).toContain('unbalanced');
      expect(calls[1]).toContain('Alice');
      expect(calls[1]).toContain('57%');
      // Speaker details
      const aliceLine = calls.find((c) => c.includes('Alice:'));
      expect(aliceLine).toContain('240s');
      expect(aliceLine).toContain('715 words');
      expect(aliceLine).toContain('179 wpm');
      expect(aliceLine).toContain('5 turns');
    });

    it('outputs table format as flat speaker rows', () => {
      outputSpeakerAnalytics(sampleAnalytics, 'table');

      const calls = consoleLogSpy.mock.calls.map((c) => c[0]);
      // Header, separator, then rows
      expect(calls.length).toBeGreaterThanOrEqual(4);
      expect(calls[0]).toContain('name');
      expect(calls[0]).toContain('talkTime');
      expect(calls[0]).toContain('words');
      expect(calls[0]).toContain('wpm');
      expect(calls[0]).toContain('turns');
      // Alice row
      expect(calls[2]).toContain('Alice');
      expect(calls[2]).toContain('240');
      expect(calls[2]).toContain('57');
      // Bob row
      expect(calls[3]).toContain('Bob');
      expect(calls[3]).toContain('181');
    });

    it('outputs tsv format as flat speaker rows', () => {
      outputSpeakerAnalytics(sampleAnalytics, 'tsv');

      const calls = stdoutWriteSpy.mock.calls.map((c) => c[0]);
      expect(calls.length).toBe(3); // header + 2 rows
      expect(calls[0]).toBe('name\ttalkTime\ttalkTime%\twords\twpm\tsentences\tturns\n');
      expect(calls[1]).toContain('Alice\t240\t57');
      expect(calls[2]).toContain('Bob\t181\t43');
    });

    it('outputs json format as full analytics object', () => {
      outputSpeakerAnalytics(sampleAnalytics, 'json');

      expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(sampleAnalytics, null, 2));
    });

    it('outputs jsonl format as full analytics object', () => {
      outputSpeakerAnalytics(sampleAnalytics, 'jsonl');

      expect(stdoutWriteSpy).toHaveBeenCalledTimes(1);
      expect(stdoutWriteSpy).toHaveBeenCalledWith(`${JSON.stringify(sampleAnalytics)}\n`);
    });
  });

  describe('outputActionItems', () => {
    const sampleActionItems: ActionItemsResult = {
      items: [
        {
          text: 'Complete API documentation',
          assignee: 'Alice',
          dueDate: 'Friday',
          lineNumber: 1,
        },
        {
          text: 'Review pull request',
          assignee: 'Bob',
          lineNumber: 2,
        },
        {
          text: 'Schedule follow-up call',
          dueDate: 'tomorrow',
          lineNumber: 3,
        },
      ],
      totalItems: 3,
      assignedItems: 2,
      datedItems: 2,
      assignees: ['Alice', 'Bob'],
    };

    it('outputs plain format as human-readable list', () => {
      outputActionItems(sampleActionItems, 'plain');

      const calls = stdoutWriteSpy.mock.calls.map((c) => c[0]);
      // Should have header, empty line, and entries for each item
      expect(calls.length).toBeGreaterThanOrEqual(4);
      expect(calls[0]).toContain('3 total');
      expect(calls[0]).toContain('2 assigned');
      // First item
      const aliceLine = calls.find((c) => c.includes('Complete API documentation'));
      expect(aliceLine).toBeDefined();
      const aliceDetails = calls.find((c) => c.includes('Alice') && c.includes('Friday'));
      expect(aliceDetails).toBeDefined();
    });

    it('outputs table format as flat rows', () => {
      outputActionItems(sampleActionItems, 'table');

      const calls = consoleLogSpy.mock.calls.map((c) => c[0]);
      // Header, separator, then rows
      expect(calls.length).toBeGreaterThanOrEqual(5);
      expect(calls[0]).toContain('#');
      expect(calls[0]).toContain('text');
      expect(calls[0]).toContain('assignee');
      expect(calls[0]).toContain('dueDate');
      // Alice row
      expect(calls[2]).toContain('Alice');
      expect(calls[2]).toContain('Friday');
      // Bob row
      expect(calls[3]).toContain('Bob');
    });

    it('outputs tsv format as flat rows', () => {
      outputActionItems(sampleActionItems, 'tsv');

      const calls = stdoutWriteSpy.mock.calls.map((c) => c[0]);
      expect(calls.length).toBe(4); // header + 3 rows
      expect(calls[0]).toBe('#\ttext\tassignee\tdueDate\n');
      expect(calls[1]).toContain('Alice');
      expect(calls[1]).toContain('Friday');
    });

    it('outputs json format as full result object', () => {
      outputActionItems(sampleActionItems, 'json');

      expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(sampleActionItems, null, 2));
    });

    it('outputs jsonl format as full result object', () => {
      outputActionItems(sampleActionItems, 'jsonl');

      expect(stdoutWriteSpy).toHaveBeenCalledTimes(1);
      expect(stdoutWriteSpy).toHaveBeenCalledWith(`${JSON.stringify(sampleActionItems)}\n`);
    });

    it('shows dash for missing assignee and dueDate in table', () => {
      const result: ActionItemsResult = {
        items: [{ text: 'Simple task', lineNumber: 1 }],
        totalItems: 1,
        assignedItems: 0,
        datedItems: 0,
        assignees: [],
      };

      outputActionItems(result, 'table');

      const calls = consoleLogSpy.mock.calls.map((c) => c[0]);
      // Row should have dashes for missing values
      expect(calls[2]).toContain('-');
    });
  });
});
