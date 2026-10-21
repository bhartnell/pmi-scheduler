'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Building2, Check, SlidersHorizontal } from 'lucide-react';

/**
 * Home stat bar (TRIM 6/7a-2): Quick Stats + Overview merged into one row.
 * Every number links. "Pick stats" chooses which show; the choice is saved as
 * the additive `stat_bar_stats` key in the user's dashboard layout (existing
 * /api/dashboard/layout). Read-only against existing routes otherwise.
 */

type StatKey =
  | 'labs_this_week'
  | 'active_students'
  | 'open_spots'
  | 'needs_attention'
  | 'open_feedback'
  | 'days_to_cert';

interface StatDef {
  key: StatKey;
  label: string;
  adminOnly?: boolean;
}

const STAT_DEFS: StatDef[] = [
  { key: 'labs_this_week', label: 'Labs this week' },
  { key: 'active_students', label: 'Active students' },
  { key: 'open_spots', label: 'Open instructor spots' },
  { key: 'needs_attention', label: 'Needs attention' },
  { key: 'open_feedback', label: 'Open feedback', adminOnly: true },
  { key: 'days_to_cert', label: 'Days to next cert day' },
];

const DEFAULT_STATS: StatKey[] = STAT_DEFS.map(d => d.key);

interface Values {
  labs_this_week: number | null;
  active_students: number | null;
  open_spots: number | null;
  needs_attention: number | null;
  open_feedback: number | null;
  days_to_cert: number | null;
}

function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function getJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

interface Props {
  isAdmin: boolean;
  canLogSiteVisit: boolean;
}

export default function HomeStatBar({ isAdmin, canLogSiteVisit }: Props) {
  const [values, setValues] = useState<Values | null>(null);
  const [picked, setPicked] = useState<StatKey[]>(DEFAULT_STATS);
  const [picking, setPicking] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const available = useMemo(() => STAT_DEFS.filter(d => !d.adminOnly || isAdmin), [isAdmin]);
  const shown = available.filter(d => picked.includes(d.key));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const today = localDateString(now);

      const [layout, students, labs, stations, feedback, cert] = await Promise.all([
        getJson('/api/dashboard/layout'),
        getJson('/api/lab-management/students?status=active'),
        getJson(`/api/lab-management/lab-days?startDate=${localDateString(weekStart)}&endDate=${localDateString(weekEnd)}`),
        getJson('/api/lab-management/stations?open=true&upcoming=true'),
        isAdmin ? getJson('/api/feedback?status=new&limit=1') : Promise.resolve(null),
        getJson(`/api/dashboard/next-cert-day?today=${today}`),
      ]);
      if (cancelled) return;

      const saved = layout?.layout?.stat_bar_stats;
      if (Array.isArray(saved)) {
        setPicked(saved.filter((k: unknown): k is StatKey => STAT_DEFS.some(d => d.key === k)));
      }

      const openSpots: number | null = stations ? (stations.stations?.length ?? 0) : null;
      const openFeedback: number | null = isAdmin && feedback ? (feedback.total ?? feedback.totalCount ?? 0) : null;
      // Same two items the Needs Attention widget lists: stations needing an
      // instructor, and new feedback reports.
      const needsAttention =
        openSpots === null ? null : (openSpots > 0 ? 1 : 0) + ((openFeedback ?? 0) > 0 ? 1 : 0);

      let daysToCert: number | null = null;
      if (cert?.next?.date) {
        const target = new Date(`${cert.next.date}T00:00:00`);
        const start = new Date(`${today}T00:00:00`);
        daysToCert = Math.round((target.getTime() - start.getTime()) / 86400000);
      }

      setValues({
        labs_this_week: labs ? (labs.pagination?.total ?? labs.labDays?.length ?? 0) : null,
        active_students: students ? (students.pagination?.total ?? students.students?.length ?? 0) : null,
        open_spots: openSpots,
        needs_attention: needsAttention,
        open_feedback: openFeedback,
        days_to_cert: daysToCert,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!picking) return;
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPicking(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [picking]);

  const togglePick = useCallback(
    (key: StatKey) => {
      const next = picked.includes(key) ? picked.filter(k => k !== key) : [...picked, key];
      setPicked(next);
      // Best-effort save; the layout route merges, so other keys are kept.
      fetch('/api/dashboard/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: { stat_bar_stats: next } }),
      }).catch(() => {});
    },
    [picked],
  );

  const hrefFor = (key: StatKey): string => {
    switch (key) {
      case 'labs_this_week':
        return '/labs/schedule';
      case 'active_students':
        return '/academics/students';
      case 'open_spots':
        return '/labs/schedule';
      case 'needs_attention':
        return (values?.open_spots ?? 0) > 0 ? '/labs/schedule' : '/admin/feedback';
      case 'open_feedback':
        return '/admin/feedback';
      case 'days_to_cert':
        return '/calendar';
    }
  };

  const display = (key: StatKey): string => {
    const v = values?.[key];
    if (v === null || v === undefined) return values ? '-' : '';
    return String(v);
  };

  return (
    <div className="mb-6 flex items-stretch gap-3 max-md:flex-col">
      {canLogSiteVisit && (
        <Link
          href="/clinical/site-visits"
          className="order-last max-md:order-first flex items-center justify-center gap-2 min-h-[60px] px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-semibold text-lg shadow hover:shadow-lg transition-shadow"
        >
          <Building2 className="w-6 h-6" />
          Log Site Visit
        </Link>
      )}
      <div className="flex-1 flex items-center bg-white dark:bg-gray-800 rounded-xl shadow px-2 min-h-[60px] max-md:flex-wrap">
        <div className="flex-1 flex items-center flex-wrap">
          {shown.length === 0 && (
            <span className="px-3 text-sm text-gray-500 dark:text-gray-400">No stats picked.</span>
          )}
          {shown.map(def => (
            <Link
              key={def.key}
              href={hrefFor(def.key)}
              className="flex flex-col items-start px-4 py-2 min-h-[44px] rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 group"
            >
              <span className="text-xl font-bold leading-tight text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {display(def.key) || <span className="inline-block w-6 h-5 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 group-hover:underline">{def.label}</span>
            </Link>
          ))}
        </div>
        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            onClick={() => setPicking(p => !p)}
            className="flex items-center gap-2 px-3 min-h-[44px] text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
            aria-expanded={picking}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Pick stats
          </button>
          {picking && (
            <div className="absolute right-0 top-full mt-1 z-20 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2">
              {available.map(def => {
                const on = picked.includes(def.key);
                return (
                  <button
                    key={def.key}
                    type="button"
                    onClick={() => togglePick(def.key)}
                    className="w-full flex items-center gap-2 px-2 min-h-[44px] text-sm text-left text-gray-800 dark:text-gray-200 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <span
                      className={`w-5 h-5 flex items-center justify-center rounded border ${
                        on ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {on && <Check className="w-3.5 h-3.5" />}
                    </span>
                    {def.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
