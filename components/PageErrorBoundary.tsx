'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home, MessageSquare } from 'lucide-react';

interface PageErrorBoundaryProps {
  children: React.ReactNode;
}

interface PageErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PageErrorBoundary extends React.Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  constructor(props: PageErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[PageErrorBoundary] Caught error:', error, errorInfo);
    }

    // Log to server-side error log (fire-and-forget, never blocks render)
    try {
      fetch('/api/errors/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error_message: error.message,
          error_stack: error.stack,
          component_name: 'PageErrorBoundary',
          url: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      }).catch(() => {});
    } catch {
      // Silently ignore logging failures
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Something went wrong
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              An unexpected error occurred. Your data has been saved and is safe.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre className="text-left text-xs bg-gray-100 dark:bg-gray-700 p-3 rounded-lg mb-4 overflow-auto max-h-32 text-red-600 dark:text-red-400">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={() => {
                  const feedbackBtn = document.querySelector<HTMLButtonElement>('[aria-label="Submit Feedback"]');
                  if (feedbackBtn) feedbackBtn.click();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/40 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                Report this error
              </button>
              <Link
                href="/"
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                <Home className="w-4 h-4" />
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
