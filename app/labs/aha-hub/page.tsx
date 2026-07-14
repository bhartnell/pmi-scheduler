'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { HeartPulse, Stethoscope, GraduationCap, ExternalLink, ShieldAlert } from 'lucide-react';
import { PageLoader } from '@/components/ui';
import { canAccessAdmin, hasMinRole } from '@/lib/permissions';
import { useEffectiveRole } from '@/hooks/useEffectiveRole';
import type { CurrentUser } from '@/types';
import Breadcrumbs from '@/components/Breadcrumbs';
import { ThemeToggle } from '@/components/ThemeToggle';

interface CourseCohort {
  cohort: { id: string; cohort_number: string | number; program: { abbreviation: string; name: string } | null } | null;
  dayCount: number;
  testingDayCount: number;
  dates: string[];
}

interface AhaHubData {
  success: boolean;
  templatesAvailable: { acls: number; pals: number };
  courses: { acls: CourseCohort[]; pals: CourseCohort[] };
}

function formatDates(dates: string[]) {
  if (dates.length === 0) return '—';
  if (dates.length === 1) return dates[0];
  return `${dates[0]} – ${dates[dates.length - 1]}`;
}

function CourseSection({
  title,
  icon: Icon,
  cohorts,
  templateCount,
  viewHref,
  color,
}: {
  title: string;
  icon: typeof HeartPulse;
  cohorts: CourseCohort[];
  templateCount: number;
  viewHref: string | null;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
        </div>
        {viewHref && cohorts.length > 0 && (
          <Link
            href={viewHref}
            className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Open hub <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {templateCount === 0 && (
        <div className="mb-4 flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            No {title} certification templates are configured yet — the AHA Course Generator
            won&apos;t find a template to assign until one is set up.
          </span>
        </div>
      )}

      {cohorts.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No cohorts have {title} days yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="py-1.5 pr-4">Cohort</th>
                <th className="py-1.5 pr-4">Dates</th>
                <th className="py-1.5 pr-4">Days</th>
                <th className="py-1.5 pr-4">Testing days</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.cohort?.id} className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className="py-1.5 pr-4 font-medium text-gray-900 dark:text-white">
                    {c.cohort?.program?.abbreviation || c.cohort?.program?.name || ''} {c.cohort?.cohort_number}
                  </td>
                  <td className="py-1.5 pr-4 text-gray-600 dark:text-gray-400">{formatDates(c.dates)}</td>
                  <td className="py-1.5 pr-4 text-gray-600 dark:text-gray-400">{c.dayCount}</td>
                  <td className="py-1.5 pr-4 text-gray-600 dark:text-gray-400">{c.testingDayCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AHA HUB + ACLS REPEATABLE — Phase 1 (Task Handoff Queue).
//
// Top-level, read-only landing page for AHA courses (ACLS + PALS): lists
// every cohort running each course and links out to the existing per-course
// views (ACLS Hub, PALS grading) plus the AHA Course Generator to assign a
// course to a new cohort. Additive only — does not remove or replace the
// existing /labs/acls-hub or /labs/pals/grade pages.
// ---------------------------------------------------------------------------
export default function AhaHubPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AhaHubData | null>(null);
  const effectiveRole = useEffectiveRole(currentUser?.role ?? null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetch('/api/instructor/me')
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.user) setCurrentUser(d.user);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [session]);

  useEffect(() => {
    fetch('/api/adv-cert/aha-hub')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData(d);
      })
      .catch(() => {});
  }, []);

  if (status === 'loading' || loading) return <PageLoader />;
  if (!session) return null;

  const isAdmin = effectiveRole ? canAccessAdmin(effectiveRole) : false;
  const isInstructor = effectiveRole ? hasMinRole(effectiveRole, 'instructor') : false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Breadcrumbs className="mb-2" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <HeartPulse className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AHA Hub</h1>
                <p className="text-gray-600 dark:text-gray-400">
                  ACLS and PALS courses across every cohort
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {isAdmin && (
          <Link
            href="/admin/aha-courses"
            className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-lg shadow p-5 hover:shadow-md transition-shadow group"
          >
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg group-hover:bg-red-200 dark:group-hover:bg-red-900/50 transition-colors">
              <GraduationCap className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900 dark:text-white">Assign AHA Course to a Cohort</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Launch the AHA Course Generator to create or configure ACLS/PALS days for a cohort
              </p>
            </div>
            <ExternalLink className="w-5 h-5 text-gray-400" />
          </Link>
        )}

        {!isInstructor ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">You don&apos;t have access to view AHA course details.</p>
        ) : !data ? (
          <PageLoader />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2 max-lg:grid-cols-1">
            <CourseSection
              title="ACLS"
              icon={HeartPulse}
              cohorts={data.courses.acls}
              templateCount={data.templatesAvailable.acls}
              viewHref="/labs/acls-hub"
              color="bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400"
            />
            <CourseSection
              title="PALS"
              icon={Stethoscope}
              cohorts={data.courses.pals}
              templateCount={data.templatesAvailable.pals}
              viewHref="/labs/pals-hub"
              color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
            />
          </div>
        )}
      </main>
    </div>
  );
}
