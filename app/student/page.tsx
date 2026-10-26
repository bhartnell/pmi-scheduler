'use client';

/**
 * Student view home (mock v3, Ben 2026-10-19): scenario side only.
 * To do (self-assessment while open), My progress (team-lead counts, ACLS/PALS),
 * Coming up (cohort lab days), My cases as team lead (result list only).
 * Skills and check-offs live in Platinum Planner, so nothing about them is here.
 * Own data only; watch flags and instructor notes are never fetched.
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AlertCircle } from 'lucide-react';
import SelfAssessmentTodo from '@/components/student/SelfAssessmentTodo';
import type { CourseStatus, StudentHome } from '@/lib/student-home';

interface HomeResponse {
  success: boolean;
  student: { firstName: string | null; cohortNumber: string | null } | null;
  home?: StudentHome;
  message?: string;
  error?: string;
}

const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', opts);

function statusText(s: CourseStatus, date: string | null): { v: string; sub: string; tone: string } {
  switch (s) {
    case 'passed': return { v: 'Passed', sub: date ? fmtDate(date) : '', tone: 'text-green-700 dark:text-green-400' };
    case 'needs_retest': return { v: 'Retest', sub: 'needs another try', tone: 'text-amber-700 dark:text-amber-400' };
    default: return { v: 'Not yet', sub: 'not tested', tone: 'text-gray-500 dark:text-gray-400' };
  }
}

const PILL = {
  pass: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  needs_rep: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  led: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  lab: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  cert: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
} as const;

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">{title}</h2>
      {children}
    </section>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
      <div className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`font-bold ${value.length > 8 ? 'text-base' : 'text-2xl'} ${tone ?? 'text-gray-900 dark:text-white'}`}>{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{sub}</div>
    </div>
  );
}

export default function StudentHomePage() {
  const { data: session } = useSession();
  const [data, setData] = useState<HomeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.email) return;
    fetch('/api/student/home')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ success: false, student: null, error: 'Could not load your progress.' }))
      .finally(() => setLoading(false));
  }, [session?.user?.email]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600" />
      </div>
    );
  }

  const home = data?.home;
  const first = data?.student?.firstName || session?.user?.name?.split(' ')[0] || 'there';
  const acls = home && statusText(home.acls.status, home.acls.date);
  // STUDENT VIEW 5: never a scheduled lab day on the student side, so no upcoming dates.
  const pals = home && statusText(home.pals.status, home.pals.date);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Hi, {first}</h1>
        {data?.student?.cohortNumber && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Paramedic Group {String(data.student.cohortNumber).replace(/\.0$/, '')}</p>
        )}
      </div>

      {(data?.message || (data && !data.success)) && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-200">{data?.message ?? data?.error ?? 'Your progress is not available right now.'}</p>
        </div>
      )}

      <div className="grid grid-cols-[1.2fr_1fr] max-lg:grid-cols-1 gap-3 items-start">
        <div className="space-y-3">
          <SelfAssessmentTodo />

          <Card title="My progress">
            {home && acls && pals ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Tile label="Team leads" value={String(home.leads.total)} sub={home.leads.lastDate ? `last: ${fmtDate(home.leads.lastDate)}` : 'none yet'} />
                  <Tile label="ACLS" value={acls.v} sub={acls.sub} tone={acls.tone} />
                  <Tile label="PALS" value={pals.v} sub={pals.sub} tone={pals.tone} />
                </div>
                <p className="mt-3 text-sm text-gray-800 dark:text-gray-200">
                  <b>Team leads by course</b>{' '}
                  lab and earlier {home.leads.lab} &middot; ACLS {home.leads.acls} &middot; PALS {home.leads.pals}
                </p>
                <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">
                  <b>Graded scenario results</b>{' '}
                  {home.leads.graded.pass} pass &middot; {home.leads.graded.needsRep} needs another rep
                </p>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Counts come from cases where you were team lead. Nothing here is self-reported. Skills and check-offs are tracked in Platinum Planner and the Pima portal, not here.
                </p>
              </>
            ) : <p className="text-sm text-gray-500 dark:text-gray-400">Nothing to show yet.</p>}
          </Card>
        </div>

        <div className="space-y-3">
          <Card title="My cases as team lead">
            {home && home.cases.length > 0 ? home.cases.map((c, i) => (
              <div key={`${c.date}-${i}`} className="flex items-center justify-between gap-3 min-h-[44px] border-t first:border-t-0 border-gray-100 dark:border-gray-700 text-sm">
                <div className="min-w-0">
                  <div className="text-gray-900 dark:text-white truncate">{fmtDate(c.date)}, {c.title}</div>
                  {c.room && <div className="text-xs text-gray-500 dark:text-gray-400">{c.room}</div>}
                </div>
                <span className={`text-[11px] rounded px-2 py-0.5 whitespace-nowrap ${PILL[c.result]}`}>
                  {c.result === 'pass' ? 'pass' : c.result === 'needs_rep' ? 'needs another rep' : 'led'}
                </span>
              </div>
            )) : <p className="text-sm text-gray-500 dark:text-gray-400">No team-lead cases yet.</p>}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              A list of results only. Criteria and instructor notes stay with your instructors.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
