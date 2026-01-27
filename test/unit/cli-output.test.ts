import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { output } from '../../src/cli/utils/output.js';

describe('CLI output utilities', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
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
});
