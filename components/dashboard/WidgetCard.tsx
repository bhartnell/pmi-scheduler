'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface WidgetCardProps {
  title: string;
  icon?: ReactNode;
  viewAllLink?: string;
  viewAllText?: string;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
  loading?: boolean;
}

export default function WidgetCard({
  title,
  icon,
  viewAllLink,
  viewAllText = 'View All',
  headerAction,
  children,
  className = '',
  loading = false,
}: WidgetCardProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          {icon}
          {title}
        </h3>
        {headerAction ? (
          headerAction
        ) : viewAllLink ? (
          <Link
            href={viewAllLink}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            {viewAllText}
            <ChevronRight className="w-4 h-4" />
          </Link>
        ) : null}
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

// Empty state component
export function WidgetEmpty({
  icon,
  message,
  action,
}: {
  icon?: ReactNode;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-6">
      {icon && <div className="mb-2 text-gray-300 dark:text-gray-600">{icon}</div>}
      <p className="text-gray-500 dark:text-gray-400 text-sm">{message}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
