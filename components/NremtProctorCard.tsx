'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck } from 'lucide-react';

// One card at the top of a home page for a person on today's (or tomorrow's) NREMT
// proctor list. Shows nothing for everyone else, and nothing on any error.
export default function NremtProctorCard() {
  const [dayId, setDayId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/lab-management/nremt-hub/my-day')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.success && d.day?.id) setDayId(d.day.id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!dayId) return null;
  return (
    <Link
      href={`/labs/nremt-hub/${dayId}`}
      className="flex items-center gap-3 rounded-lg border-2 border-red-500 bg-white dark:bg-gray-800 shadow p-4 mb-4 min-h-[56px] hover:bg-red-50 dark:hover:bg-gray-700"
    >
      <ClipboardCheck className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0" />
      <span className="text-lg font-bold text-gray-900 dark:text-white">NREMT Testing Day - open your stations</span>
    </Link>
  );
}
