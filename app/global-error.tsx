'use client';

/**
 * Global Error Handler (Root Layout)
 *
 * Catches errors in the root layout. This file requires its own
 * html and body tags since it replaces the entire page.
 */

import { AlertTriangle, RefreshCw } from 'lucide-react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Critical Error
            </h1>

            <p className="text-gray-600 dark:text-gray-400 mb-6">
              The application encountered a critical error. Please refresh the page to try again.
            </p>

            {process.env.NODE_ENV === 'development' && error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400">
                  Error details
                </summary>
                <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs text-red-600 dark:text-red-400 overflow-auto max-h-40">
                  {error.message}
                </pre>
              </details>
            )}

            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              Refresh Page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
