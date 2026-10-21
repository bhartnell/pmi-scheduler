'use client';

import BreadcrumbNames from '@/components/layout/BreadcrumbNames';

interface LabHeaderProps {
  breadcrumbs?: { label: string; href?: string }[];
  title: string;
  actions?: React.ReactNode;
  /** Display name for a dynamic entity (e.g., lab day title, scenario name) */
  entityTitle?: string;
}

export default function LabHeader({ breadcrumbs, title, actions, entityTitle }: LabHeaderProps) {
  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm">
      <div className="max-w-screen-2xl mx-auto px-4 py-4">
        {/* Bottom row - Breadcrumbs and Title */}
        <div>
          {/* Breadcrumbs - use universal component */}
          <BreadcrumbNames entityTitle={entityTitle} />

          {/* Title and Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
            {actions && <div className="flex gap-2">{actions}</div>}
          </div>
        </div>
      </div>
    </header>
  );
}
