/**
 * Loading Spinner Component
 *
 * Standardized loading indicator for the PMI EMS Scheduler.
 * Use throughout the app for consistent loading states.
 */

import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  /** Size of the spinner: 'sm' (16px), 'md' (24px), 'lg' (48px) */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Screen reader text (default: "Loading") */
  label?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-12 w-12 border-b-2',
};

export function LoadingSpinner({
  size = 'md',
  className,
  label = 'Loading',
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-blue-600',
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}
