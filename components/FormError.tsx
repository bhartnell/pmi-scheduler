'use client';

import { AlertCircle } from 'lucide-react';

interface FormErrorProps {
  /** Error message to display. Renders nothing when null or empty string. */
  message: string | null;
}

/**
 * Inline field-level error message.
 * Renders a small red line with an AlertCircle icon and animated fade-in.
 */
export default function FormError({ message }: FormErrorProps) {
  if (!message) return null;

  return (
    <p
      role="alert"
      className="mt-1 flex items-center gap-1 text-sm text-red-600 dark:text-red-400 animate-in fade-in duration-150"
    >
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}
