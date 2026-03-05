'use client';

import { useEffect } from 'react';
import { Eye } from 'lucide-react';
import { useRolePreview } from './RolePreviewProvider';
import { getRoleLabel } from '@/lib/permissions';

export default function RolePreviewBanner() {
  const { previewRole, isPreviewMode, exitPreview } = useRolePreview();

  useEffect(() => {
    if (!isPreviewMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitPreview();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isPreviewMode, exitPreview]);

  if (!isPreviewMode || !previewRole) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 left-0 right-0 z-[100] flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-orange-600 dark:bg-orange-700 shadow-lg print:hidden"
    >
      <Eye className="w-4 h-4 flex-shrink-0" />
      <span>
        PREVIEW MODE — Viewing as{' '}
        <span className="px-2 py-0.5 rounded bg-white/20 font-bold">
          {getRoleLabel(previewRole)}
        </span>
      </span>
      <button
        onClick={exitPreview}
        className="ml-4 px-3 py-1 bg-white text-orange-700 text-sm font-semibold rounded-full hover:bg-orange-50 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
      >
        Exit Preview
      </button>
      <span className="text-xs text-orange-200 ml-2 hidden sm:inline">(Esc to exit)</span>
    </div>
  );
}
