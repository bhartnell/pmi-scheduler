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
