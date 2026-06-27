'use client';

/**
 * LVFR AEMT — Tier-1 Coverage Roll-up (H2 3-tier model)
 *
 * Course-wide glance at TRACKED (Tier-1) runsheet items: what's covered,
 * what's outstanding, and where the gaps are. Reads the read-only aggregation
 * at /api/lvfr-aemt/runsheet/progress. Desktop-first / wide.
 *
 * v1 — design open to Ben's review (layout, grouping, and whether Tier-2
 * activities should also surface here).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import {
  TrendingUp, CheckCircle2, Circle, AlertTriangle, Loader2, CalendarDays, ListChecks,
} from 'lucide-react';

interface DayRow {
  date: string;
  total: number;
  completed: number;
  pct: number;
  outstanding: Array<{ title: string; item_type: string | null }>;
}
interface ProgressData {
  summary: {
    tier1Total: number;
    tier1Done: number;
    tier1Outstanding: number;
    pct: number;
    daysWithTracked: number;
    tier2Count: number;
  };
  byType: Record<string, { total: number; completed: number; pct: number }>;
  days: DayRow[];
}

function fmtDate(yyyyMmDd: string): string {
  try {
    return new Date(yyyyMmDd + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  } catch { return yyyyMmDd; }
}

export default function LVFRProgressPage() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/lvfr-aemt/runsheet/progress')
      .then(r => r.json())
      .then(d => {
        if (d.success) setData(d);
        else setError(d.error || 'Failed to load');
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const s = data?.summary;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-gradient-to-r from-red-700 to-red-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Breadcrumbs className="mb-3 [&_*]:!text-red-200 [&_a:hover]:!text-white" />
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg"><TrendingUp className="w-6 h-6" /></div>
            <div>
              <h1 className="text-2xl font-bold">Coverage Roll-up</h1>
              <p className="text-red-200 text-sm mt-0.5">Tier-1 tracked items across the course &mdash; what&apos;s done, what&apos;s outstanding</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* v1 design-review flag */}
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-2.5 flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span><strong>v1 for review.</strong> Rolls up Tier-1 tracked items (chapters / quizzes / labs / exams / skills). Tell me if you want Tier-2 activities surfaced here, different grouping, or a per-chapter view.</span>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-red-600" /></div>
        )}
        {error && !loading && (
          <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4 flex items-start gap-2 text-sm text-red-800 dark:text-red-300">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}

        {!loading && s && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard label="Overall coverage" value={`${s.pct}%`} sub={`${s.tier1Done}/${s.tier1Total} tracked items`} color="text-green-600" />
              <SummaryCard label="Outstanding" value={String(s.tier1Outstanding)} sub="tracked items not yet done" color={s.tier1Outstanding > 0 ? 'text-amber-600' : 'text-green-600'} />
              <SummaryCard label="Days with tracked items" value={String(s.daysWithTracked)} sub="runsheet days" color="text-blue-600" />
              <SummaryCard label="Tier-2 activities" value={String(s.tier2Count)} sub="optional / class activities" color="text-purple-600" />
            </div>

            {/* Overall bar */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div className="h-3 rounded-full bg-green-500 transition-all" style={{ width: `${s.pct}%` }} />
              </div>
            </div>

            {/* By type */}
            {data && Object.keys(data.byType).length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">By type</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {Object.entries(data.byType).sort((a, b) => b[1].total - a[1].total).map(([type, t]) => (
                    <div key={type} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{type}</div>
                      <div className="text-lg font-bold text-gray-900 dark:text-white">{t.completed}/{t.total}</div>
                      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1"><div className="h-1.5 rounded-full bg-green-500" style={{ width: `${t.pct}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Per-day */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-gray-500" />
                <h2 className="font-semibold text-gray-900 dark:text-white">By day</h2>
              </div>
              {data && data.days.length === 0 ? (
                <p className="px-4 py-8 text-sm text-gray-500 dark:text-gray-400 text-center">No tracked items seeded yet. Open a day&apos;s runsheet and re-seed from the calendar.</p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {data?.days.map(d => (
                    <div key={d.date} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <Link href={`/lvfr-aemt/day/${d.date}`} className="flex items-center gap-2 font-medium text-gray-900 dark:text-white hover:text-red-600 dark:hover:text-red-400">
                          <ListChecks className="w-4 h-4 text-gray-400" />
                          {fmtDate(d.date)}
                        </Link>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600 dark:text-gray-300">{d.completed}/{d.total}</span>
                          <div className="w-28 h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                            <div className={`h-2 rounded-full ${d.pct === 100 ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${d.pct}%` }} />
                          </div>
                          <span className={`text-sm font-semibold w-10 text-right ${d.pct === 100 ? 'text-green-600' : 'text-amber-600'}`}>{d.pct}%</span>
                        </div>
                      </div>
                      {d.outstanding.length > 0 && (
                        <ul className="mt-2 pl-6 space-y-0.5">
                          {d.outstanding.map((o, i) => (
                            <li key={i} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                              <Circle className="w-3 h-3 flex-shrink-0" />
                              <span>{o.title}</span>
                              {o.item_type && o.item_type !== 'other' && (
                                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700">{o.item_type}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      {d.outstanding.length === 0 && d.total > 0 && (
                        <p className="mt-1 pl-6 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> All tracked items complete
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</div>
    </div>
  );
}
