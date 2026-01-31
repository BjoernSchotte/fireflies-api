import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RenderOptions, WeeklyDigest } from '../types/digest.js';

// Re-export types
export type { RenderOptions, WeeklyDigest } from '../types/digest.js';

/**
 * Built-in template names.
 */
const BUILT_IN_TEMPLATES = ['default', 'compact', 'executive'] as const;
type BuiltInTemplate = (typeof BUILT_IN_TEMPLATES)[number];

/**
 * Get the templates directory path.
 */
function getTemplatesDir(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  // In dist: dist/helpers/ -> dist/templates/
  // In src: src/helpers/ -> src/templates/
  return join(currentDir, '..', 'templates', 'digest');
}

/**
 * Check if a template name is a built-in template.
 */
function isBuiltInTemplate(name: string): name is BuiltInTemplate {
  return BUILT_IN_TEMPLATES.includes(name as BuiltInTemplate);
}

/**
 * Load template content by name or path.
 */
function loadTemplate(templateOption: string | undefined): string {
  const templateName = templateOption ?? 'default';

  // If it's a built-in template, load from templates directory
  if (isBuiltInTemplate(templateName)) {
    const templatePath = join(getTemplatesDir(), `${templateName}.md`);
    try {
      return readFileSync(templatePath, 'utf-8');
    } catch {
      // Fall back to inline default if template file not found
      return getInlineTemplate(templateName);
    }
  }

  // If it starts with common template markers, treat as inline template
  if (templateOption && (templateOption.startsWith('#') || templateOption.includes('{{'))) {
    return templateOption;
  }

  // Otherwise try to load as file path
  try {
    return readFileSync(templateName, 'utf-8');
  } catch {
    // If file not found and looks like a path, throw
    if (templateName.includes('/') || templateName.includes('\\') || templateName.endsWith('.md')) {
      throw new Error(`Template file not found: ${templateName}`);
    }
    // Otherwise treat as inline template
    return templateName;
  }
}

/**
 * Get inline fallback template.
 */
function getInlineTemplate(name: BuiltInTemplate): string {
  switch (name) {
    case 'compact':
      return COMPACT_TEMPLATE;
    case 'executive':
      return EXECUTIVE_TEMPLATE;
    default:
      return DEFAULT_TEMPLATE;
  }
}

/**
 * Render a digest using a template. Pure function.
 *
 * @param digest - Digest to render
 * @param options - Template options (built-in name, file path, or inline template)
 * @returns Rendered string (markdown)
 *
 * @example
 * ```typescript
 * const output = renderDigest(digest);                          // Default
 * const output = renderDigest(digest, { template: 'compact' }); // Built-in
 * const output = renderDigest(digest, { template: './es.md' }); // Custom file
 * const output = renderDigest(digest, { template: '# Custom\n{{totalMeetings}} meetings' }); // Inline
 * ```
 */
export function renderDigest(digest: WeeklyDigest, options?: RenderOptions): string {
  const template = loadTemplate(options?.template);
  return renderTemplate(template, digest as unknown as Record<string, unknown>);
}

/**
 * Available filters for template rendering.
 */
const FILTERS: Record<string, (value: unknown) => string> = {
  duration: (value: unknown): string => {
    const minutes = Math.round(Number(value) || 0);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  },
  date: (value: unknown): string => {
    const str = String(value || '');
    if (!str) return '';
    const date = new Date(str);
    if (Number.isNaN(date.getTime())) return str;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  },
  join: (value: unknown): string => {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return String(value || '');
  },
  lowercase: (value: unknown): string => String(value || '').toLowerCase(),
  uppercase: (value: unknown): string => String(value || '').toUpperCase(),
};

/**
 * Render a template with mustache-like syntax. Pure function.
 *
 * Supports:
 * - Variable substitution: `{{var}}`, `{{a.b.c}}`
 * - Loops: `{{#items}}...{{/items}}`
 * - Conditionals: `{{#truthy}}...{{/truthy}}`
 * - Filters: `{{value | duration}}`
 *
 * @param template - Template string with placeholders
 * @param data - Data object for substitution
 * @returns Rendered string
 *
 * @example
 * ```typescript
 * const result = renderTemplate('Hello {{name}}!', { name: 'World' });
 * // => 'Hello World!'
 * ```
 */
export function renderTemplate(template: string, data: Record<string, unknown>): string {
  if (!template) return '';

  let result = template;

  // Process sections (loops and conditionals) first
  result = processSections(result, data);

  // Then process simple variable substitutions
  result = processVariables(result, data);

  return result;
}

/**
 * Process {{#section}}...{{/section}} blocks.
 */
function processSections(template: string, data: Record<string, unknown>): string {
  const sectionPattern = /\{\{#(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/\1\}\}/g;

  let result = template;
  let iterations = 0;
  const maxIterations = 100;

  // Keep processing until no more sections (handles nested sections)
  for (;;) {
    const match = sectionPattern.exec(result);
    if (!match || iterations >= maxIterations) break;
    iterations++;

    const [fullMatch, path, content] = match;
    if (!path || content === undefined) continue;

    const value = getNestedValue(data, path);
    const replacement = renderSectionValue(value, content, data);

    result =
      result.slice(0, match.index) + replacement + result.slice(match.index + fullMatch.length);
    sectionPattern.lastIndex = 0; // Reset for re-scan
  }

  return result;
}

/**
 * Render the replacement content for a section based on the value type.
 */
function renderSectionValue(
  value: unknown,
  content: string,
  data: Record<string, unknown>
): string {
  if (Array.isArray(value)) {
    return renderArraySection(value, content, data);
  }
  if (isIterableObject(value)) {
    return renderObjectSection(value as Record<string, unknown>, content, data);
  }
  if (isTruthy(value)) {
    const processed = processSections(content, data);
    return processVariables(processed, data);
  }
  return '';
}

/**
 * Render array items in a section loop.
 */
function renderArraySection(
  items: unknown[],
  content: string,
  data: Record<string, unknown>
): string {
  let result = '';
  for (const item of items) {
    if (typeof item === 'object' && item !== null) {
      const itemData = { ...data, ...(item as Record<string, unknown>) };
      const processed = processSections(content, itemData);
      result += processVariables(processed, itemData);
    } else {
      const itemContent = content.replace(/\{\{\.\}\}/g, String(item));
      result += processVariables(itemContent, data);
    }
  }
  return result;
}

/**
 * Render object entries in a section loop.
 */
function renderObjectSection(
  obj: Record<string, unknown>,
  content: string,
  data: Record<string, unknown>
): string {
  let result = '';
  for (const [key, itemValue] of Object.entries(obj)) {
    const itemData = buildObjectItemData(data, key, itemValue);
    const itemContent = content.replace(/\{\{\.\}\}/g, key);
    const processed = processSections(itemContent, itemData);
    result += processVariables(processed, itemData);
  }
  return result;
}

/**
 * Build data context for an object entry iteration.
 */
function buildObjectItemData(
  data: Record<string, unknown>,
  key: string,
  itemValue: unknown
): Record<string, unknown> {
  const baseData = { ...data, _key: key, _value: itemValue };
  if (typeof itemValue === 'object' && itemValue !== null && !Array.isArray(itemValue)) {
    return { ...baseData, ...(itemValue as Record<string, unknown>) };
  }
  return baseData;
}

/**
 * Check if a value is an iterable object (not array, not null).
 */
function isIterableObject(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}

/**
 * Check if a value is truthy for template purposes.
 * Numbers (including 0) are considered truthy for display.
 */
function isTruthy(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.length > 0;
  if (typeof value === 'number') return true; // 0 is truthy for display
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Process {{variable}} and {{variable | filter}} placeholders.
 */
function processVariables(template: string, data: Record<string, unknown>): string {
  // Match {{path}} or {{path | filter}}
  return template.replace(
    /\{\{([\w.]+)(?:\s*\|\s*(\w+))?\}\}/g,
    (_match, path: string, filterName?: string) => {
      const value = getNestedValue(data, path);

      if (value === undefined || value === null) {
        return '';
      }

      // Apply filter if specified
      if (filterName && FILTERS[filterName]) {
        return FILTERS[filterName](value);
      }

      return String(value);
    }
  );
}

/**
 * Get a nested value from an object using dot notation.
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Default template (inline fallback).
 */
const DEFAULT_TEMPLATE = `# Weekly Meeting Digest
**{{period.from}} to {{period.to}}**

## Overview
- **{{totalMeetings}}** meetings
- **{{totalDuration | duration}}** total time
- **{{actionItems.total}}** action items

## Meeting Stats
{{#stats.meetingsByDay}}
- {{.}}
{{/stats.meetingsByDay}}

Busiest day: {{stats.busiestDay}}
Average duration: {{stats.averageDuration}} minutes

## Action Items
{{#actionItems.byAssignee}}
### {{.}}
{{/actionItems.byAssignee}}

{{#actionItems.unassigned}}
### Unassigned
- [ ] {{text}}
{{/actionItems.unassigned}}

## Highlights
{{#highlights}}
### {{meetingTitle}} ({{meetingDate | date}})
{{#keyPoints}}
- {{.}}
{{/keyPoints}}
{{/highlights}}

## Participants
{{#participants}}
- {{email}} ({{meetingCount}} meetings, {{totalMinutes | duration}})
{{/participants}}

---
*Generated with fireflies-api*
`;

/**
 * Compact template (inline fallback).
 */
const COMPACT_TEMPLATE = `# Weekly Digest: {{period.from}} - {{period.to}}

**{{totalMeetings}}** meetings | **{{totalDuration | duration}}** | **{{actionItems.total}}** action items

{{#actionItems.unassigned}}
## Action Items
- [ ] {{text}}
{{/actionItems.unassigned}}
`;

/**
 * Executive template (inline fallback).
 */
const EXECUTIVE_TEMPLATE = `# Executive Summary
**Weekly Meeting Report: {{period.from}} to {{period.to}}**

## Key Metrics
| Metric | Value |
|--------|-------|
| Total Meetings | {{totalMeetings}} |
| Total Time | {{totalDuration | duration}} |
| Action Items | {{actionItems.total}} |
| Participants | {{participants.length}} |

## Top Highlights
{{#highlights}}
- **{{meetingTitle}}**: {{#keyPoints}}{{.}} {{/keyPoints}}
{{/highlights}}

## Outstanding Action Items
{{#actionItems.unassigned}}
- {{text}}
{{/actionItems.unassigned}}

---
*Executive Summary generated with fireflies-api*
`;
