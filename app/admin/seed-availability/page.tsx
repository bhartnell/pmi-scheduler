'use client';

/**
 * /admin/seed-availability — One-shot bulk action that seeds
 * default Mon-Fri 8:30 AM – 5:00 PM availability for every full-
 * time instructor across a configurable date window. Idempotent —
 * re-running won't create duplicates.
 *
 * Sits next to /admin/calendar-sync as a peer admin utility. The
 * seeded rows feed the green-dot "Available" group on the
 * lab-station instructor dropdown (see
 * /api/lab-management/instructor-availability).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Home,
  ChevronRight,
  Users,
  CalendarCheck,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageLoader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import type { CurrentUser } from '@/types';

interface SeedResult {
  success: boolean;
  full_time_instructors?: number;
  instructors_touched?: number;
  template_inserted?: number;
  template_skipped?: number;
  availability_inserted?: number;
  availability_skipped?: number;
  errors?: string[];
  error?: string;
  window?: {
    start_date: string;
    end_date: string;
    start_time: string;
    end_time: string;
    weekdays: number[];
  };
}

export default function SeedAvailabilityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [form, setForm] = useState({
    start_date: '2026-05-11',
    end_date: '2026-08-21',
    start_time: '08:30',
    end_time: '17:00',
  });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  useEffect(() => {
    if (!session?.user?.email) return;
    fetch('/api/instructor/me')
      .then(r => r.json())
      .then(data => {
        const u = (data.user || data) as CurrentUser;
        setCurrentUser(u);
        if (!canAccessAdmin(u.role)) router.push('/');
      })
      .catch(() => {});
  }, [session, router]);

  const handleSeed = async (dryRun: boolean) => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/seed-instructor-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: form.start_date,
          end_date: form.end_date,
          start_time: form.start_time + ':00',
          end_time: form.end_time + ':00',
          dry_run: dryRun,
        }),
      });
      const data = (await res.json()) as SeedResult;
      setResult(data);
      if (data.success) {
        toast.success(
          dryRun
            ? `Dry run complete — ${data.availability_inserted ?? 0} rows would be inserted`
            : `Seeded ${data.availability_inserted ?? 0} availability rows across ${data.instructors_touched ?? 0} instructors`
        );
      } else {
        toast.error(data.error || 'Seed failed');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Seed request failed');
    } finally {
      setRunning(false);
    }
  };

  if (status === 'loading' || (currentUser && !canAccessAdmin(currentUser.role))) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">
              <Home className="w-4 h-4" />
            </Link>
            <ChevronRight className="w-3 h-3" />
            <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">
              Admin
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-900 dark:text-gray-100 font-medium">
              Seed full-time availability
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-center gap-3">
          <CalendarCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Seed full-time availability
          </h1>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          One-shot bulk action that seeds default Mon-Fri{' '}
          <strong>{form.start_time}–{form.end_time}</strong> availability for every
          full-time instructor (<code>role IN (&apos;lead_instructor&apos;,&apos;instructor&apos;) AND is_part_time = false</code>) across the chosen window.
          Idempotent — re-running won&apos;t create duplicates. Part-time instructors continue to submit their own availability.
        </p>

        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Window
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Start date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">End date</label>
              <input
                type="date"
                value={form.end_date}
                onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Start time</label>
              <input
                type="time"
                value={form.start_time}
                onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">End time</label>
              <input
                type="time"
                value={form.end_time}
                onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            Weekdays are fixed at Mon-Fri (1–5). To customise, call the API directly with a <code>weekdays[]</code> body field.
          </p>
        </section>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => handleSeed(true)}
            disabled={running}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium disabled:opacity-60"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Dry run (preview counts)
          </button>
          <button
            onClick={() => handleSeed(false)}
            disabled={running}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-60"
          >
            {running ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CalendarCheck className="w-4 h-4" />
            )}
            Run seed
          </button>
        </div>

        {result && (
          <section className={`rounded-xl ring-1 p-5 ${
            result.success
              ? 'bg-emerald-50 dark:bg-emerald-900/20 ring-emerald-200 dark:ring-emerald-800'
              : 'bg-red-50 dark:bg-red-900/20 ring-red-200 dark:ring-red-800'
          }`}>
            <div className="flex items-start gap-2 mb-3">
              {result.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {result.success ? 'Seed complete' : 'Seed failed'}
              </h3>
            </div>
            {result.success ? (
              <ul className="text-sm text-gray-800 dark:text-gray-200 space-y-1">
                <li>Full-time instructors: <strong>{result.full_time_instructors ?? 0}</strong></li>
                <li>Instructors touched: <strong>{result.instructors_touched ?? 0}</strong></li>
                <li>Templates inserted: <strong>{result.template_inserted ?? 0}</strong> (skipped {result.template_skipped ?? 0} already present)</li>
                <li>Availability rows inserted: <strong>{result.availability_inserted ?? 0}</strong> (skipped {result.availability_skipped ?? 0} already covered)</li>
              </ul>
            ) : (
              <p className="text-sm text-red-800 dark:text-red-300">{result.error}</p>
            )}
            {result.errors && result.errors.length > 0 && (
              <details className="mt-3">
                <summary className="text-xs font-medium text-amber-700 dark:text-amber-300 cursor-pointer">
                  {result.errors.length} per-instructor error(s) — click to expand
                </summary>
                <ul className="mt-2 text-xs text-amber-800 dark:text-amber-200 list-disc pl-5 space-y-0.5">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </details>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
