'use client';

import React from 'react';
import FormError from './FormError';

interface FormFieldProps {
  /** The label text shown above the input */
  label: string;
  /** The id of the associated input (used for htmlFor) */
  htmlFor?: string;
  /** If true, shows a red asterisk and sr-only required text */
  required?: boolean;
  /** Validation error message; shown below the input when set */
  error?: string;
  /** Optional helper text shown below the input (only when no error) */
  helpText?: string;
  /** The form control (input, select, textarea, etc.) */
  children: React.ReactNode;
  /** Optional extra class on the wrapper div */
  className?: string;
}

/**
 * Reusable wrapper that provides consistent label, required indicator,
 * inline error display, and optional help text for any form control.
 *
 * When an error is present the wrapper passes `data-invalid="true"` so
 * child inputs can target it with `[data-invalid="true"] input { ... }`
 * or the parent can inspect it. The red-border is applied via the
 * `aria-invalid` attribute that consumers should set on the control itself.
 */
export default function FormField({
  label,
  htmlFor,
  required,
  error,
  helpText,
  children,
  className = '',
}: FormFieldProps) {
  return (
    <div className={className} data-invalid={error ? 'true' : undefined}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
      >
        {label}
        {required && (
          <>
            <span className="text-red-500 ml-0.5" aria-hidden="true">
              *
            </span>
            <span className="sr-only">(required)</span>
          </>
        )}
      </label>

      {/* Wrap children so we can inject border styling via CSS data attribute */}
      <div className={error ? 'ring-red-300 dark:ring-red-700 rounded-lg' : ''}>
        {children}
      </div>

      {error ? (
        <FormError message={error} />
      ) : helpText ? (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helpText}</p>
      ) : null}
    </div>
  );
}
