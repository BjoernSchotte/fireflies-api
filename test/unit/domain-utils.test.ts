import { describe, expect, it } from 'vitest';
import { extractDomain, hasExternalParticipants } from '../../src/helpers/domain-utils.js';

describe('extractDomain', () => {
  it('extracts domain from email address', () => {
    expect(extractDomain('user@company.com')).toBe('company.com');
  });

  it('handles subdomains', () => {
    expect(extractDomain('user@mail.company.com')).toBe('mail.company.com');
  });

  it('lowercases the domain', () => {
    expect(extractDomain('User@COMPANY.COM')).toBe('company.com');
  });

  it('returns empty string for email without @', () => {
    expect(extractDomain('invalid-email')).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(extractDomain('')).toBe('');
  });

  it('handles @ at the end', () => {
    expect(extractDomain('user@')).toBe('');
  });
});

describe('hasExternalParticipants', () => {
  it('returns true when external participant exists', () => {
    const participants = ['alice@company.com', 'bob@external.com'];
    expect(hasExternalParticipants(participants, 'company.com')).toBe(true);
  });

  it('returns false when all participants are internal', () => {
    const participants = ['alice@company.com', 'bob@company.com'];
    expect(hasExternalParticipants(participants, 'company.com')).toBe(false);
  });

  it('returns false for empty participants list', () => {
    expect(hasExternalParticipants([], 'company.com')).toBe(false);
  });

  it('is case-insensitive for domain comparison', () => {
    const participants = ['alice@COMPANY.COM', 'bob@Company.Com'];
    expect(hasExternalParticipants(participants, 'company.com')).toBe(false);
  });

  it('ignores participants with invalid emails', () => {
    const participants = ['invalid-email', 'alice@company.com'];
    expect(hasExternalParticipants(participants, 'company.com')).toBe(false);
  });

  it('detects external with mixed internal and external', () => {
    const participants = ['alice@company.com', 'bob@company.com', 'charlie@external.org'];
    expect(hasExternalParticipants(participants, 'company.com')).toBe(true);
  });

  it('handles multiple external domains', () => {
    const participants = ['alice@external1.com', 'bob@external2.org'];
    expect(hasExternalParticipants(participants, 'company.com')).toBe(true);
  });
});
