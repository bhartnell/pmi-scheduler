/**
 * Content Loader Component
 *
 * Loading state for content sections within a page.
 * Use when loading data for a card, table, or other content area.
 */

import { LoadingSpinner } from './LoadingSpinner';
import { cn } from '@/lib/utils';

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
            style={{ width: `${Math.random() * 40 + 60}%` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center justify-center py-8', className)}>
      <LoadingSpinner size="md" />
      <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
        {message}
      </span>
    </div>
  );
}

/**
 * Skeleton Card Component
 *
 * Placeholder for card content while loading.
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-800 rounded-lg shadow p-4 animate-pulse',
        className
      )}
    >
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3" />
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
      </div>
    </div>
  );
}

/**
 * Skeleton Table Row Component
 *
 * Placeholder for table row while loading.
 */
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
