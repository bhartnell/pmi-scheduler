/**
 * Loading Spinner Component
 *
 * Standardized loading indicator for the PMI EMS Scheduler.
 * Use throughout the app for consistent loading states.
 */

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  /** Size of the spinner: 'sm' (16px), 'md' (24px), 'lg' (32px) */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Optional label displayed below the spinner */
  label?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export function LoadingSpinner({
  size = 'md',
  className,
  label,
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-2', className)}
      role="status"
      aria-label={label ?? 'Loading'}
    >
      <Loader2
        className={cn('animate-spin text-blue-600 dark:text-blue-400', sizeClasses[size])}
        aria-hidden="true"
      />
      {label && (
        <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      )}
      {!label && <span className="sr-only">Loading</span>}
    </div>
  );
}
