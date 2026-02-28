'use client';

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors in child components and displays a fallback UI.
 * Use to wrap sections of the app to prevent entire page crashes.
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, MessageSquare } from 'lucide-react';
import Link from 'next/link';

interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Custom fallback component (optional) */
  fallback?: ReactNode;
  /** Error handler callback (optional) */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Feature name for error message context */
  featureName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by ErrorBoundary:', error, errorInfo);
    }
    this.props.onError?.(error, errorInfo);

    // Log to server-side error log (fire-and-forget)
    try {
      fetch('/api/errors/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error_message: error.message,
          error_stack: error.stack,
          component_name: this.props.featureName,
          url: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      }).catch(() => {});
    } catch {
      // Silently ignore logging failures
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          featureName={this.props.featureName}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Default Error Fallback UI
 */
interface ErrorFallbackProps {
  error: Error | null;
  featureName?: string;
  onRetry?: () => void;
}

export function ErrorFallback({ error, featureName, onRetry }: ErrorFallbackProps) {
  const title = featureName
    ? `Error loading ${featureName}`
    : 'Something went wrong';

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h2>

        <p className="text-gray-600 dark:text-gray-400 mb-6">
          We encountered an unexpected error. Please try again or return to the home page.
        </p>

        {error && process.env.NODE_ENV === 'development' && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
              Error details
            </summary>
            <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs text-red-600 dark:text-red-400 overflow-auto max-h-40">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}

        <div className="flex flex-wrap gap-3 justify-center">
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          )}
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
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Home className="w-4 h-4" />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Page-level Error Fallback
 *
 * Full-page error display for critical errors.
 */
export function PageErrorFallback({ error, featureName, onRetry }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <ErrorFallback error={error} featureName={featureName} onRetry={onRetry} />
    </div>
  );
}
