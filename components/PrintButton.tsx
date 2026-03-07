'use client';
import { Printer } from 'lucide-react';

interface PrintButtonProps {
  onClick: () => void;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function PrintButton({ onClick, label = 'Print', size = 'md', className = '' }: PrintButtonProps) {
  const sizeClasses = size === 'sm'
    ? 'px-2 py-1 text-xs gap-1'
    : 'px-3 py-1.5 text-sm gap-1.5';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center ${sizeClasses} bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors print:hidden ${className}`}
      aria-label={label}
    >
      <Printer className={iconSize} />
      {label}
    </button>
  );
}
