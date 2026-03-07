'use client';

import React from 'react';

interface ReportCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export default function ReportCard({ title, children, className = '' }: ReportCardProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
