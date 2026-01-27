/**
 * Extract domain from email address.
 *
 * @param email - Email address
 * @returns Lowercase domain, or empty string if invalid
 *
 * @example
 * ```typescript
 * extractDomain('user@company.com'); // 'company.com'
 * extractDomain('User@EXAMPLE.ORG'); // 'example.org'
 * extractDomain('invalid'); // ''
 * ```
 */
export function extractDomain(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex < 0) return '';
  const domain = email.slice(atIndex + 1).toLowerCase();
  return domain || '';
}

/**
 * Check if any participant has an email outside the given domain.
 *
 * @param participants - List of participant email addresses
 * @param internalDomain - The internal/company domain to check against
 * @returns True if at least one participant has a different domain
 *
 * @example
 * ```typescript
 * hasExternalParticipants(['a@company.com', 'b@external.com'], 'company.com'); // true
 * hasExternalParticipants(['a@company.com', 'b@company.com'], 'company.com'); // false
 * ```
 */
export function hasExternalParticipants(participants: string[], internalDomain: string): boolean {
  const normalizedInternal = internalDomain.toLowerCase();
  return participants.some((email) => {
    const domain = extractDomain(email);
    return domain !== '' && domain !== normalizedInternal;
  });
}
