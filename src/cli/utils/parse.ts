import type { UploadAudioAttendee } from '../../types/params.js';

/**
 * Format duration in seconds to human-readable string.
 * @param seconds - Duration in seconds (can be fractional)
 * @returns Human-readable string like "1h 30m", "5m 20s", "45s"
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0s';
  }

  const totalSeconds = Math.round(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${hours}h`;
  }

  if (minutes > 0) {
    if (secs > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${minutes}m`;
  }

  return `${secs}s`;
}

/**
 * Parse time string (supports seconds or MM:SS or HH:MM:SS format).
 * @returns Time in seconds
 */
export function parseTime(value: string): number {
  if (value.includes(':')) {
    const parts = value.split(':');
    if (parts.length === 2) {
      const [mins, secs] = parts;
      return Number.parseInt(mins ?? '0', 10) * 60 + Number.parseFloat(secs ?? '0');
    }
    if (parts.length === 3) {
      const [hours, mins, secs] = parts;
      return (
        Number.parseInt(hours ?? '0', 10) * 3600 +
        Number.parseInt(mins ?? '0', 10) * 60 +
        Number.parseFloat(secs ?? '0')
      );
    }
  }
  return Number.parseFloat(value);
}

/**
 * Parse attendee string in format "name:email" or just "email".
 */
export function parseAttendee(value: string): UploadAudioAttendee {
  if (value.includes(':')) {
    const colonIndex = value.indexOf(':');
    const displayName = value.slice(0, colonIndex);
    const email = value.slice(colonIndex + 1);
    return { displayName, email };
  }
  return { email: value };
}

export type BitePrivacy = 'public' | 'team' | 'participants';

const VALID_PRIVACIES: BitePrivacy[] = ['public', 'team', 'participants'];

/**
 * Validate a privacy value.
 * @returns The validated privacy or null if invalid
 */
export function validatePrivacy(value: string): BitePrivacy | null {
  if (VALID_PRIVACIES.includes(value as BitePrivacy)) {
    return value as BitePrivacy;
  }
  return null;
}

export type UserRole = 'admin' | 'user';

const VALID_ROLES: UserRole[] = ['admin', 'user'];

/**
 * Validate a user role value.
 * @returns The validated role or null if invalid
 */
export function validateRole(value: string): UserRole | null {
  if (VALID_ROLES.includes(value as UserRole)) {
    return value as UserRole;
  }
  return null;
}
