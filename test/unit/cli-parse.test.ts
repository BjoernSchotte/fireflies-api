import { describe, expect, it } from 'vitest';
import {
  parseAttendee,
  parseTime,
  validatePrivacy,
  validateRole,
} from '../../src/cli/utils/parse.js';

describe('CLI parse utilities', () => {
  describe('parseTime', () => {
    it('parses plain seconds', () => {
      expect(parseTime('120')).toBe(120);
      expect(parseTime('0')).toBe(0);
      expect(parseTime('3600')).toBe(3600);
    });

    it('parses fractional seconds', () => {
      expect(parseTime('120.5')).toBe(120.5);
      expect(parseTime('0.25')).toBe(0.25);
    });

    it('parses MM:SS format', () => {
      expect(parseTime('2:00')).toBe(120);
      expect(parseTime('2:30')).toBe(150);
      expect(parseTime('0:45')).toBe(45);
      expect(parseTime('10:00')).toBe(600);
    });

    it('parses MM:SS with fractional seconds', () => {
      expect(parseTime('2:30.5')).toBe(150.5);
      expect(parseTime('1:00.25')).toBe(60.25);
    });

    it('parses HH:MM:SS format', () => {
      expect(parseTime('1:00:00')).toBe(3600);
      expect(parseTime('1:30:00')).toBe(5400);
      expect(parseTime('2:15:30')).toBe(8130);
      expect(parseTime('0:05:00')).toBe(300);
    });

    it('parses HH:MM:SS with fractional seconds', () => {
      expect(parseTime('1:00:00.5')).toBe(3600.5);
    });
  });

  describe('parseAttendee', () => {
    it('parses email only', () => {
      expect(parseAttendee('alice@example.com')).toEqual({
        email: 'alice@example.com',
      });
    });

    it('parses name:email format', () => {
      expect(parseAttendee('Alice:alice@example.com')).toEqual({
        displayName: 'Alice',
        email: 'alice@example.com',
      });
    });

    it('parses name with spaces:email format', () => {
      expect(parseAttendee('Alice Smith:alice@example.com')).toEqual({
        displayName: 'Alice Smith',
        email: 'alice@example.com',
      });
    });

    it('handles email with colon in local part', () => {
      // First colon is used as separator
      expect(parseAttendee('Name:user:tag@example.com')).toEqual({
        displayName: 'Name',
        email: 'user:tag@example.com',
      });
    });
  });

  describe('validatePrivacy', () => {
    it('validates correct privacy values', () => {
      expect(validatePrivacy('public')).toBe('public');
      expect(validatePrivacy('team')).toBe('team');
      expect(validatePrivacy('participants')).toBe('participants');
    });

    it('returns null for invalid privacy values', () => {
      expect(validatePrivacy('invalid')).toBeNull();
      expect(validatePrivacy('private')).toBeNull();
      expect(validatePrivacy('')).toBeNull();
      expect(validatePrivacy('PUBLIC')).toBeNull(); // case-sensitive
    });
  });

  describe('validateRole', () => {
    it('validates correct role values', () => {
      expect(validateRole('admin')).toBe('admin');
      expect(validateRole('user')).toBe('user');
    });

    it('returns null for invalid role values', () => {
      expect(validateRole('invalid')).toBeNull();
      expect(validateRole('superuser')).toBeNull();
      expect(validateRole('')).toBeNull();
      expect(validateRole('ADMIN')).toBeNull(); // case-sensitive
    });
  });
});
