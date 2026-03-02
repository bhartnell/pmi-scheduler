/**
 * Utility Functions
 *
 * Common utility functions used throughout the application.
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines class names using clsx and tailwind-merge.
 * Handles conditional classes and resolves Tailwind conflicts.
 *
 * @example
 * cn('px-4 py-2', isActive && 'bg-blue-500', className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date string to a readable format.
 *
 * @example
 * formatDate('2024-01-15') // "January 15, 2024"
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString + 'T12:00:00');
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format a date string to short format.
 *
 * @example
 * formatShortDate('2024-01-15') // "Jan 15"
 */
export function formatShortDate(dateString: string): string {
  const date = new Date(dateString + 'T12:00:00');
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Capitalize the first letter of a string.
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Truncate a string to a maximum length with ellipsis.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Delay execution for a specified number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random ID string.
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Safely parse a date string, handling date-only strings to avoid timezone issues.
 * Date-only strings (e.g., "2025-03-01") are parsed as UTC midnight, which can
 * display as the previous day in western timezones. This adds T12:00:00 to avoid that.
 */
export function parseDateSafe(dateString: string): Date {
  if (!dateString) return new Date();
  // If it already has a time component, parse as-is
  if (dateString.includes('T') || dateString.includes(' ')) {
    return new Date(dateString);
  }
  // Date-only string: add noon time to avoid timezone day-shift
  return new Date(dateString + 'T12:00:00');
}

/**
 * Convert a Date object to a YYYY-MM-DD string using local timezone.
 * Use this instead of date.toISOString().split('T')[0] which uses UTC
 * and can return the wrong date in western timezones.
 *
 * @example
 * toDateStr(new Date(2024, 0, 15)) // "2024-01-15"
 */
export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Add weeks to a date string, returning a new YYYY-MM-DD string.
 * Uses noon local time for date arithmetic to avoid DST and timezone issues.
 *
 * @example
 * addWeeksToDate('2024-01-15', 2) // "2024-01-29"
 */
export function addWeeksToDate(dateStr: string, weeks: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const base = new Date(year, month - 1, day, 12, 0, 0); // noon avoids DST issues
  base.setDate(base.getDate() + (7 * weeks));
  return toDateStr(base);
}

/**
 * Safely format a date string or ISO timestamp for display.
 * Handles both date-only strings (YYYY-MM-DD) and full ISO timestamps.
 * Uses parseDateSafe internally to avoid timezone off-by-one errors.
 *
 * @example
 * formatDateSafe('2024-01-15') // "January 15, 2024"
 * formatDateSafe('2024-01-15T08:30:00Z') // "January 15, 2024"
 * formatDateSafe('2024-01-15', { month: 'short', day: 'numeric' }) // "Jan 15"
 */
export function formatDateSafe(
  dateString: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateString) return '';
  const date = parseDateSafe(dateString);
  return date.toLocaleDateString('en-US', options || {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
