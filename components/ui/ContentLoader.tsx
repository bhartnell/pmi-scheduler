/**
 * Content Loader Components
 *
 * Loading skeleton states for content sections within a page.
 * All variants use animate-pulse and respect dark mode.
 */

import { LoadingSpinner } from './LoadingSpinner';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// ContentLoader - spinner-based inline loader
// ---------------------------------------------------------------------------

interface ContentLoaderProps {
  /** Number of skeleton rows to show (0 = spinner only) */
  rows?: number;
  /** Message to display */
  message?: string;
  /** Additional CSS classes */
  className?: string;
}

export function ContentLoader({
  rows = 0,
  message = 'Loading...',
  className,
}: ContentLoaderProps) {
  if (rows > 0) {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
            style={{ width: `${60 + (i % 3) * 13}%` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center justify-center py-8', className)}>
      <LoadingSpinner size="md" label={message} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkeletonCard - card-shaped placeholder
// ---------------------------------------------------------------------------

interface SkeletonCardProps {
  /** Number of cards to render */
  rows?: number;
  /** Additional CSS classes applied to the wrapper */
  className?: string;
}

export function SkeletonCard({ rows = 1, className }: SkeletonCardProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 animate-pulse shadow-sm',
            className
          )}
        >
          {/* Icon + title row */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg flex-shrink-0" />
            <div className="h-5 w-36 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          {/* Body lines */}
          <div className="space-y-2">
            <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-4/5 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// SkeletonTableRow - a single animated table row
// ---------------------------------------------------------------------------

export function SkeletonTableRow({
  columns = 4,
  className,
}: {
  columns?: number;
  className?: string;
}) {
  return (
    <tr className={cn('animate-pulse', className)}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// SkeletonTable - full table skeleton with header + rows
// ---------------------------------------------------------------------------

interface SkeletonTableProps {
  /** Number of body rows */
  rows?: number;
  /** Number of columns */
  columns?: number;
  /** Additional CSS classes for the wrapper */
  className?: string;
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: SkeletonTableProps) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden',
        className
      )}
    >
      <table className="w-full">
        {/* Header */}
        <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-20 animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkeletonForm - label + input placeholder rows
// ---------------------------------------------------------------------------

interface SkeletonFormProps {
  /** Number of form field rows */
  rows?: number;
  /** Additional CSS classes */
  className?: string;
}

export function SkeletonForm({ rows = 4, className }: SkeletonFormProps) {
  return (
    <div className={cn('space-y-5 animate-pulse', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          {/* Label */}
          <div className="h-3.5 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
          {/* Input */}
          <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
      ))}
      {/* Submit button placeholder */}
      <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg mt-2" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkeletonText - lines of varying width for prose / descriptions
// ---------------------------------------------------------------------------

interface SkeletonTextProps {
  /** Number of text lines */
  rows?: number;
  /** Additional CSS classes */
  className?: string;
}

const TEXT_WIDTHS = ['w-full', 'w-5/6', 'w-4/5', 'w-3/4', 'w-2/3'] as const;

export function SkeletonText({ rows = 3, className }: SkeletonTextProps) {
  return (
    <div className={cn('space-y-2 animate-pulse', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-4 bg-gray-200 dark:bg-gray-700 rounded',
            TEXT_WIDTHS[i % TEXT_WIDTHS.length]
          )}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkeletonStats - stat card placeholders (number + label)
// ---------------------------------------------------------------------------

interface SkeletonStatsProps {
  /** Number of stat cards */
  rows?: number;
  /** Additional CSS classes for the grid wrapper */
  className?: string;
}

export function SkeletonStats({ rows = 4, className }: SkeletonStatsProps) {
  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-4 gap-4', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse shadow-sm"
        >
          {/* Big number */}
          <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
          {/* Label */}
          <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      ))}
    </div>
  );
}
