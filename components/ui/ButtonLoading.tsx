/**
 * ButtonLoading Component
 *
 * A button that shows a spinner and updated label when in a loading/saving state.
 * Automatically disabled while loading to prevent double-submission.
 */

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonLoadingProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Whether the button is in a loading state */
  isLoading?: boolean;
  /** Label shown while loading (default: "Loading...") */
  loadingLabel?: string;
  /** Icon or content shown before the label when not loading */
  icon?: ReactNode;
  /** Additional CSS classes */
  className?: string;
  children: ReactNode;
}

export function ButtonLoading({
  isLoading = false,
  loadingLabel = 'Loading...',
  icon,
  className,
  children,
  disabled,
  ...props
}: ButtonLoadingProps) {
  return (
    <button
      {...props}
      disabled={isLoading || disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        className
      )}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>{loadingLabel}</span>
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}
