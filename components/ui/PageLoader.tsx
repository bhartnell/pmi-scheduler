/**
 * Page Loader Component
 *
 * Full-page loading state for initial page loads.
 * Shows a centered spinner with optional message.
 */

import { LoadingSpinner } from './LoadingSpinner';
import { cn } from '@/lib/utils';

interface PageLoaderProps {
  /** Message to display below spinner */
  message?: string;
  /** Whether to use full viewport height (default: true) */
  fullScreen?: boolean;
  /** Additional CSS classes for the container */
  className?: string;
}

export function PageLoader({
  message,
  fullScreen = true,
  className,
}: PageLoaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center',
        fullScreen
          ? 'min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800'
          : 'py-12',
        className
      )}
    >
      <LoadingSpinner size="lg" label={message} />
    </div>
  );
}
