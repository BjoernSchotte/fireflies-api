/**
 * Calculate a date relative to today.
 */
export function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

/**
 * Get start of today.
 */
export function startOfToday(): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

export interface DateRange {
  fromDate?: string;
  toDate?: string;
}

export interface DateRangeOptions {
  from?: string;
  to?: string;
  today?: boolean;
  yesterday?: boolean;
  lastWeek?: boolean;
  lastMonth?: boolean;
  days?: string;
}

/**
 * Resolve date range from options, preferring relative dates over explicit ones.
 */
export function resolveDateRange(opts: DateRangeOptions): DateRange {
  // Relative date shortcuts take precedence
  if (opts.today) {
    return { fromDate: startOfToday() };
  }
  if (opts.yesterday) {
    return { fromDate: daysAgo(1), toDate: startOfToday() };
  }
  if (opts.lastWeek) {
    return { fromDate: daysAgo(7) };
  }
  if (opts.lastMonth) {
    return { fromDate: daysAgo(30) };
  }
  if (opts.days) {
    const numDays = Number.parseInt(opts.days, 10);
    if (!Number.isNaN(numDays) && numDays > 0) {
      return { fromDate: daysAgo(numDays) };
    }
  }

  // Fall back to explicit dates
  return { fromDate: opts.from, toDate: opts.to };
}
