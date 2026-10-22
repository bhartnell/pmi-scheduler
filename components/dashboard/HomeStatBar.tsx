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
  | 'active_students'
  | 'labs_this_week'
  | 'students_by_program'
  | 'needs_attention'
  | 'next_priority_lab';

interface StatDef {
  key: StatKey;
  label: string;
  adminOnly?: boolean;
}

// Order here is the order on the bar: the total comes first.
const STAT_DEFS: StatDef[] = [
  { key: 'active_students', label: 'Active students (total)' },
  { key: 'labs_this_week', label: 'Labs this week' },
  { key: 'students_by_program', label: 'Students by program' },
  { key: 'needs_attention', label: 'Needs attention' },
  { key: 'next_priority_lab', label: 'Next high-priority lab' },
];

// Needs attention is available under Pick stats but off by default.
const DEFAULT_STATS: StatKey[] = ['active_students', 'labs_this_week', 'students_by_program', 'next_priority_lab'];

// The bar shows two groups with a divider: lab numbers, then student numbers.
const STUDENT_KEYS: StatKey[] = ['active_students', 'students_by_program'];

const NEEDS_ATTENTION_TITLE =
  'Counts two things: (1) 1 if any upcoming lab station still needs an instructor, and (2) 1 if there are new feedback reports (admins only). Each number links to its list.';

// Saved picks from before the rename.
const LEGACY_KEYS: Record<string, StatKey> = { days_to_cert: 'next_priority_lab' };

interface ProgramCount {
  name: string;
  total: number;
  semesters: { semester: number | null; count: number }[];
}

interface NextLab {
  id: string;
  date: string;
  title: string | null;
  cert_course: string | null;
  is_nremt_testing: boolean | null;
}

interface Values {
  labs_this_week: number | null;
  active_students: number | null;
  open_spots: number | null;
  needs_attention: number | null;
  open_feedback: number | null;
  programs: ProgramCount[] | null;
  next_lab: { label: string; days: number; href: string } | null | undefined;
}

function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nextLabHref(lab: NextLab): string {
  const date = encodeURIComponent(lab.date);
  if (lab.cert_course === 'acls') return `/labs/acls-hub/board?date=${date}`;
  if (lab.cert_course === 'pals') return `/labs/pals-hub?date=${date}`;
  return `/labs/schedule/${lab.id}`;
}

function nextLabCourse(lab: NextLab): string {
  if (lab.cert_course) return lab.cert_course.toUpperCase();
  if (lab.is_nremt_testing) return 'NREMT';
  return lab.title || 'Lab';
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

      const [layout, labs, stations, feedback, cert, counts] = await Promise.all([
        getJson('/api/dashboard/layout'),
        getJson(`/api/lab-management/lab-days?startDate=${localDateString(weekStart)}&endDate=${localDateString(weekEnd)}`),
        getJson('/api/lab-management/stations?open=true&upcoming=true'),
        isAdmin ? getJson('/api/feedback?status=new&limit=1') : Promise.resolve(null),
        getJson(`/api/dashboard/next-cert-day?today=${today}`),
        getJson('/api/dashboard/student-counts'),
      ]);
      if (cancelled) return;

      const saved = layout?.layout?.stat_bar_stats;
      if (Array.isArray(saved)) {
        const migrated = saved.map((k: unknown) => (typeof k === 'string' ? LEGACY_KEYS[k] ?? k : k));
        setPicked(
          migrated.filter(
            (k: unknown, i: number): k is StatKey =>
              STAT_DEFS.some(d => d.key === k) && migrated.indexOf(k) === i,
          ),
        );
      }

      const openSpots: number | null = stations ? (stations.stations?.length ?? 0) : null;
      const openFeedback: number | null = isAdmin && feedback ? (feedback.total ?? feedback.totalCount ?? 0) : null;
      // Same two items the Needs Attention widget lists: stations needing an
      // instructor, and new feedback reports.
      const needsAttention =
        openSpots === null ? null : (openSpots > 0 ? 1 : 0) + ((openFeedback ?? 0) > 0 ? 1 : 0);

      // undefined = still loading / failed; null = loaded, nothing upcoming.
      let nextLab: Values['next_lab'] = cert ? null : undefined;
      if (cert?.next?.date) {
        const lab = cert.next as NextLab;
        const target = new Date(`${lab.date}T00:00:00`);
        const start = new Date(`${today}T00:00:00`);
        const days = Math.round((target.getTime() - start.getTime()) / 86400000);
        const dateLabel = target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        nextLab = { label: `${nextLabCourse(lab)}, ${dateLabel}`, days, href: nextLabHref(lab) };
      }

      const programs: ProgramCount[] | null = counts?.success
        ? (counts.programs as ProgramCount[]).map(p => ({ name: p.name, total: p.total, semesters: p.semesters }))
        : null;

      setValues({
        labs_this_week: labs ? (labs.pagination?.total ?? labs.labDays?.length ?? 0) : null,
        // Same source as the by-program tiles so the two always agree and
        // graduated / inactive cohorts are left out.
        active_students: counts?.success ? (counts.total as number) : null,
        open_spots: openSpots,
        needs_attention: needsAttention,
        open_feedback: openFeedback,
        programs,
        next_lab: nextLab,
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
      case 'students_by_program':
      case 'active_students':
        return '/academics/cohorts';
      case 'needs_attention':
        return (values?.open_spots ?? 0) > 0 ? '/labs/schedule' : '/admin/feedback';
      case 'next_priority_lab':
        return values?.next_lab?.href ?? '/labs/schedule';
    }
  };

  const display = (key: StatKey): string => {
    if (key === 'next_priority_lab') {
      const lab = values?.next_lab;
      if (lab === undefined) return values ? '-' : '';
      return lab === null ? 'None' : `${lab.days} ${lab.days === 1 ? 'day' : 'days'}`;
    }
    if (key === 'students_by_program') return '';
    const v = values?.[key as 'active_students' | 'labs_this_week' | 'needs_attention'];
    if (v === null || v === undefined) return values ? '-' : '';
    return String(v);
  };

  const labelFor = (def: StatDef): string => {
    if (def.key === 'next_priority_lab' && values?.next_lab) return `Next high-priority lab: ${values.next_lab.label}`;
    return def.label;
  };

  // One tile per program, semester breakdown as the label; other stats are one tile each.
  interface Tile {
    id: string;
    href: string;
    value: string;
    label: string;
    title?: string;
    /** Semester mini columns: label above number, aligned. */
    cols?: { label: string; value: number }[];
  }
  const tiles: Tile[] = shown.flatMap((def): Tile[] => {
    if (def.key !== 'students_by_program') {
      return [
        {
          id: def.key,
          href: hrefFor(def.key),
          value: display(def.key),
          label: labelFor(def),
          title: def.key === 'needs_attention' ? NEEDS_ATTENTION_TITLE : undefined,
        },
      ];
    }
    if (!values?.programs) return [{ id: def.key, href: hrefFor(def.key), value: values ? '-' : '', label: def.label }];
    return values.programs.map(p => {
      const sems = p.semesters.filter(s => s.semester !== null);
      const cols = sems.length > 1 ? sems.map(s => ({ label: `S${s.semester}`, value: s.count })) : undefined;
      return { id: `${def.key}:${p.name}`, href: hrefFor(def.key), value: String(p.total), label: p.name, cols };
    });
  });

  const labTiles = tiles.filter(t => !STUDENT_KEYS.includes(t.id.split(':')[0] as StatKey));
  const studentTiles = tiles.filter(t => STUDENT_KEYS.includes(t.id.split(':')[0] as StatKey));

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
        <div className="flex-1 flex items-center flex-wrap gap-x-6 gap-y-2 py-1">
          {shown.length === 0 && (
            <span className="px-3 text-sm text-gray-500 dark:text-gray-400">No stats picked.</span>
          )}
          {[labTiles, studentTiles].map((group, gi) =>
            group.length === 0 ? null : (
              <div
                key={gi}
                className={`flex items-center flex-wrap gap-x-4 gap-y-2 ${gi === 1 && labTiles.length > 0 ? 'pl-6 border-l border-gray-200 dark:border-gray-700 max-md:pl-0 max-md:border-l-0' : ''}`}
              >
                {group.map(tile => (
                <Link
                  key={tile.id}
                  href={tile.href}
                  title={tile.title}
                  className={`flex flex-col items-start px-3 py-2 min-h-[44px] rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 group ${tile.cols ? 'min-w-[230px]' : 'min-w-[150px]'}`}
                >
                  <span className="text-[22px] font-bold leading-tight text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {tile.value || <span className="inline-block w-6 h-5 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />}
                  </span>
                  <span className="text-xs whitespace-nowrap text-gray-500 dark:text-gray-400 group-hover:underline">{tile.label}</span>
                  {tile.cols && (
                    <span className="mt-0.5 flex items-start gap-2.5 tabular-nums">
                      {tile.cols.map(c => (
                        <span key={c.label} className="flex min-w-[1.5rem] flex-col items-center leading-tight">
                          <span className="text-[11px] text-gray-500 dark:text-gray-400">{c.label}</span>
                          <span className="text-[15px] font-semibold text-gray-800 dark:text-gray-200">{c.value}</span>
                        </span>
                      ))}
                    </span>
                  )}
                </Link>
              ))}
              </div>
            ),
          )}
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
