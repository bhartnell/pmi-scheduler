'use client';

import { LucideIcon, FileX } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  message?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon: Icon = FileX,
  title,
  message,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <Icon className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">{title}</h3>
      {message && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md mb-4">{message}</p>
      )}
      {actionLabel && (actionHref || onAction) && (
        actionHref ? (
          <a href={actionHref} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm">
            {actionLabel}
          </a>
        ) : (
          <button onClick={onAction} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm">
            {actionLabel}
          </button>
        )
      )}
    </div>
  );
}
