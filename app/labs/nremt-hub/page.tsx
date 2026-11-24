'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck, ChevronRight } from 'lucide-react';
import { PageLoader } from '@/components/ui';
import { ThemeToggle } from '@/components/ThemeToggle';
import { todayLocal, formatHubDate } from '@/lib/nremt-hub-format';

// NREMT hub, slice 1 of 3: list of NREMT testing days. Read-only front door.
// Nothing is tied to one day or cohort: every lab day with is_nremt_testing = true shows up.

interface HubDay {
  id: string;
  date: string;
  start_time: string | null;
  cohort_label: string | null;
  student_count: number;
  station_count: number;
}

export default function NremtHubListPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [days, setDays] = useState<HubDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    fetch('/api/lab-management/nremt-hub')
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) {
          setError(d.error || 'Could not load NREMT testing days');
          return;
        }
        const list: HubDay[] = d.days;
        const today = list.filter((x) => x.date === todayLocal());
        if (today.length === 1) {
          router.replace(`/labs/nremt-hub/${today[0].id}`);
          return;
        }
        setDays(list);
      })
      .catch(() => setError('Could not load NREMT testing days'));
  }, [session, router]);

  if (status === 'loading' || (!days && !error)) return <PageLoader />;
  if (!session) return null;

  const today = todayLocal();
  const current = (days || []).filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = (days || []).filter((d) => d.date < today);

  const Row = ({ d }: { d: HubDay }) => (
    <Link
      href={`/labs/nremt-hub/${d.id}`}
      className="flex items-center justify-between gap-4 bg-white dark:bg-gray-800 rounded-lg shadow p-5 min-h-[56px] hover:shadow-md transition-shadow"
    >
      <div>
        <div className="font-semibold text-gray-900 dark:text-white">{formatHubDate(d.date)}</div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {d.cohort_label || 'No cohort'} &middot; {d.student_count} students &middot; {d.station_count} stations
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400" />
    </Link>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <ClipboardCheck className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">NREMT Hub</h1>
              <p className="text-gray-600 dark:text-gray-400">NREMT testing days: stations by skill, one tap to grading</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>
      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {days && days.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No NREMT testing days yet. Mark a lab day as an NREMT Testing Day on its lab day page and it will appear here.
          </p>
        )}
        {current.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Today and upcoming</h2>
            {current.map((d) => <Row key={d.id} d={d} />)}
          </section>
        )}
        {past.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Past</h2>
            {past.map((d) => <Row key={d.id} d={d} />)}
          </section>
        )}
      </main>
    </div>
  );
}
