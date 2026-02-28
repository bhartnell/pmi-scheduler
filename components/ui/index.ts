/**
 * UI Components Index
 *
 * Re-exports all UI components for easy importing.
 *
 * @example
 * import { PageLoader, LoadingSpinner, SkeletonTable } from '@/components/ui';
 */

export { LoadingSpinner } from './LoadingSpinner';
export { PageLoader } from './PageLoader';
export {
  ContentLoader,
  SkeletonCard,
  SkeletonTable,
  SkeletonTableRow,
  SkeletonForm,
  SkeletonText,
  SkeletonStats,
} from './ContentLoader';
export { ButtonSpinner } from './ButtonSpinner';
export { ButtonLoading } from './ButtonLoading';
export { ErrorBoundary, ErrorFallback, PageErrorFallback } from './ErrorBoundary';
