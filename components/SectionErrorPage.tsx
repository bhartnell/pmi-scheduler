'use client';

/**
 * SectionErrorPage
 *
 * Shared UI for Next.js App Router error.tsx files in each section.
 * Each section's error.tsx imports and renders this component, passing
 * the section name for context.
 */

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home, MessageSquare } from 'lucide-react';
import Link from 'next/link';

interface SectionErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Human-readable section name, e.g. "Lab Management" */
  sectionName: string;
  /** Dashboard path to link back to, defaults to "/" */
  dashboardHref?: string;
}

export default function SectionErrorPage({
  error,
  reset,
  sectionName,
  dashboardHref = '/',
}: SectionErrorPageProps) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${sectionName}] Error boundary caught:`, error);
    }

    // Log to server-side error log (fire-and-forget)
    fetch('/api/errors/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error_message: error.message,
        error_stack: error.stack,
        component_name: `${sectionName}ErrorBoundary`,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      }),
    }).catch(() => {});
  }, [error, sectionName]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-16 h-16 mx-auto mb-5 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" aria-hidden="true" />
        </div>

        {/* Heading */}
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Something went wrong
        </h1>

        {/* Message */}
        <p className="text-gray-600 dark:text-gray-400 mb-2">
          The <span className="font-medium text-gray-700 dark:text-gray-300">{sectionName}</span> section
          encountered an unexpected error.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Your data is safe. Try again or go back to the dashboard.
        </p>

        {/* Dev error detail */}
        {process.env.NODE_ENV === 'development' && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
              Error details (development only)
            </summary>
            <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs text-red-600 dark:text-red-400 overflow-auto max-h-40 whitespace-pre-wrap break-words">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
            {error.digest && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Error ID: {error.digest}
              </p>
            )}
          </details>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <button
            onClick={() => {
              const feedbackBtn = document.querySelector<HTMLButtonElement>('[aria-label="Submit Feedback"]');
              if (feedbackBtn) feedbackBtn.click();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/40 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Report this error
          </button>
          <Link
            href={dashboardHref}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Home className="w-4 h-4" />
            Go back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
