'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, MessageSquare } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /**
   * Optional string label for the section being wrapped - used for context in error messages.
   * Also accepts a ReactNode for backward compatibility (rendered as custom fallback).
   */
  fallback?: string | React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Feature/section name shown in the error card */
  featureName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * ErrorBoundary
 *
 * Reusable React class component that catches component-level errors without
 * crashing the whole page. Wrap any section of a page with this component.
 *
 * Usage:
 *   <ErrorBoundary featureName="Lab Schedule">
 *     <SomeComponent />
 *   </ErrorBoundary>
 *
 * Or with a custom label (spec-compatible "fallback" string):
 *   <ErrorBoundary fallback="section">
 *     <SomeComponent />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorBoundary] Caught error:', error);
      console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    }

    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);

    // Log to server-side error log (fire-and-forget, never blocks render)
    try {
      fetch('/api/errors/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error_message: error.message,
          error_stack: error.stack,
          component_name: this.props.featureName || (typeof this.props.fallback === 'string' ? this.props.fallback : undefined),
          url: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      }).catch(() => {
        // Silently ignore logging failures - never let logging crash the error handler
      });
    } catch {
      // Silently ignore
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // If fallback is a ReactNode (not a string), render it directly
      if (this.props.fallback && typeof this.props.fallback !== 'string') {
        return this.props.fallback;
      }

      const sectionLabel = this.props.featureName || (typeof this.props.fallback === 'string' ? this.props.fallback : null);

      return (
        <div className="p-5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-3 mb-3">
            <div className="shrink-0 w-9 h-9 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-300 leading-tight">
                Something went wrong
              </h3>
              <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">
                {sectionLabel
                  ? `The "${sectionLabel}" section encountered an error.`
                  : 'This section encountered an error.'}{' '}
                Your other data is safe.
              </p>
            </div>
          </div>

          {/* Dev-only error detail */}
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mb-3 ml-12">
              <summary className="cursor-pointer text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300">
                Error details (dev only)
              </summary>
              <pre className="mt-1.5 p-2 bg-red-100 dark:bg-red-900/40 rounded text-xs text-red-700 dark:text-red-300 overflow-auto max-h-32 whitespace-pre-wrap break-words">
                {this.state.error.message}
                {this.state.error.stack && `\n\n${this.state.error.stack}`}
              </pre>
            </details>
          )}

          <div className="flex items-center gap-2 ml-12">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Again
            </button>
            <button
              onClick={() => {
                // Open feedback button by simulating a click on the floating feedback button
                const feedbackBtn = document.querySelector<HTMLButtonElement>('[aria-label="Submit Feedback"]');
                if (feedbackBtn) {
                  feedbackBtn.click();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Report this error
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
