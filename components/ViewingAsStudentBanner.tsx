'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye } from 'lucide-react';

/**
 * Sticky "Viewing as [student] — Exit" banner (card STUDENT VIEW 3/4).
 * Exit clears the view-as cookie only — it never touches the NextAuth
 * session, so there is no re-login (the bug the old role-preview system had).
 */
export default function ViewingAsStudentBanner({ studentName }: { studentName: string }) {
  const router = useRouter();
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !exiting) exit();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exiting]);

  const exit = async () => {
    setExiting(true);
    try {
      await fetch('/api/admin/view-as/exit', { method: 'POST' });
    } finally {
      router.push('/');
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 left-0 right-0 z-[100] flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-bold text-white bg-orange-600 dark:bg-orange-700 shadow-lg print:hidden"
    >
      <Eye className="w-4 h-4 flex-shrink-0" />
      <span>
        VIEWING AS{' '}
        <span className="px-2 py-0.5 rounded bg-white/20 font-bold">{studentName}</span>
        {' '}— read-only
      </span>
      <button
        onClick={exit}
        disabled={exiting}
        className="ml-4 px-3 py-1 bg-white text-orange-700 text-sm font-semibold rounded-full hover:bg-orange-50 transition-colors focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-60"
      >
        {exiting ? 'Exiting…' : 'Exit'}
      </button>
      <span className="text-xs text-orange-200 ml-2 hidden sm:inline">(Esc to exit)</span>
    </div>
  );
}
