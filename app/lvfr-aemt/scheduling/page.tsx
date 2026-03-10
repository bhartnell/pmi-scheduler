'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Beaker,
  RefreshCw,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Instructor {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface GridDay {
  day_number: number;
  date: string;
  day_of_week: string;
  week_number: number;
  day_type: string;
  title: string | null;
  chapters_covered: string[];
  has_lab: boolean;
  lab_name: string | null;
  has_exam: boolean;
  assignment: {
    primary_instructor_id: string | null;
    secondary_instructor_id: string | null;
    min_instructors: number;
    notes: string | null;
  } | null;
  minInstructors: number;
  blockCounts: { am1: number; mid: number; pm1: number; pm2: number };
  perInstructor: Record<string, { am1: boolean; mid: boolean; pm1: boolean; pm2: boolean }>;
  rowStatus: 'ok' | 'short' | 'gap';
}

interface GapInfo {
  total: number;
  labDayGaps: number;
  days: { day_number: number; date: string; status: string; has_lab: boolean }[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LVFRSchedulingPage() {
  const [grid, setGrid] = useState<GridDay[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [gaps, setGaps] = useState<GapInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGapsOnly, setShowGapsOnly] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/lvfr-aemt/scheduling');
      if (res.ok) {
        const data = await res.json();
        setGrid(data.grid || []);
        setInstructors(data.instructors || []);
        setGaps(data.gaps || null);
      }
    } catch (err) {
      console.error('Error fetching scheduling:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const instructorInitials = (id: string) => {
    const inst = instructors.find(i => i.id === id);
    if (!inst) return '?';
    return inst.name.split(' ').map(n => n[0]).join('').slice(0, 2);
  };

  const displayDays = showGapsOnly ? grid.filter(d => d.rowStatus !== 'ok') : grid;

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto max-w-full px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/lvfr-aemt"
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-900/30">
                <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Instructor Coverage Grid
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  LVFR AEMT — {instructors.length} instructors, {grid.length} days
                </p>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <button
                onClick={() => setShowGapsOnly(!showGapsOnly)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  showGapsOnly
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {showGapsOnly ? 'Showing Gaps Only' : 'Show Gaps Only'}
              </button>
              <button
                onClick={fetchData}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-full px-4 py-6 space-y-6">
        {/* Gap Summary Cards */}
        {gaps && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{grid.length}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Days</div>
            </div>
            <div className={`rounded-xl border p-4 ${
              gaps.total > 0
                ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                : 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
            }`}>
              <div className="text-2xl font-bold">{gaps.total}</div>
              <div className="text-sm opacity-70">Days with Gaps</div>
            </div>
            <div className={`rounded-xl border p-4 ${
              gaps.labDayGaps > 0
                ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20'
                : 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
            }`}>
              <div className="text-2xl font-bold">{gaps.labDayGaps}</div>
              <div className="text-sm opacity-70">Lab Day Gaps (Priority)</div>
            </div>
          </div>
        )}

        {/* Coverage Grid Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  Day
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Date</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Content</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 dark:text-gray-400">Need</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 dark:text-gray-400">
                  AM1<br/><span className="text-xs opacity-60">07:30</span>
                </th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 dark:text-gray-400">
                  MID<br/><span className="text-xs opacity-60">10:00</span>
                </th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 dark:text-gray-400">
                  PM1<br/><span className="text-xs opacity-60">13:00</span>
                </th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 dark:text-gray-400">
                  PM2<br/><span className="text-xs opacity-60">14:30</span>
                </th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 dark:text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {displayDays.map((day) => (
                <tr
                  key={day.day_number}
                  className={`${
                    day.has_lab ? 'bg-orange-50/30 dark:bg-orange-900/5' : ''
                  } hover:bg-gray-50 dark:hover:bg-gray-700/30`}
                >
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 font-bold text-gray-900 dark:bg-gray-900 dark:text-white">
                    {day.day_number}
                  </td>
                  <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    <span className="ml-1 text-xs opacity-60">{day.day_of_week?.slice(0, 3)}</span>
                  </td>
                  <td className="px-3 py-2 max-w-xs truncate">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700 dark:text-gray-300">
                        {day.title || day.chapters_covered?.join(', ') || '-'}
                      </span>
                      {day.has_lab && (
                        <Beaker className="h-4 w-4 flex-shrink-0 text-orange-500" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300">
                    {day.minInstructors}
                  </td>
                  {(['am1', 'mid', 'pm1', 'pm2'] as const).map((block) => (
                    <td key={block} className="px-3 py-2 text-center">
                      <CoverageCell
                        count={day.blockCounts[block]}
                        needed={day.minInstructors}
                        instructors={instructors}
                        perInstructor={day.perInstructor}
                        block={block}
                        instructorInitials={instructorInitials}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center">
                    {day.rowStatus === 'ok' ? (
                      <span className="text-green-600" title="All blocks covered">
                        <CheckCircle2 className="inline h-5 w-5" />
                      </span>
                    ) : day.rowStatus === 'gap' ? (
                      <span className="text-red-600" title="Blocks with zero coverage">
                        <XCircle className="inline h-5 w-5" />
                      </span>
                    ) : (
                      <span className="text-yellow-600" title="Some blocks under-covered">
                        <AlertTriangle className="inline h-5 w-5" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Instructor Legend */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Instructors</h3>
          <div className="flex flex-wrap gap-3">
            {instructors.map((inst) => (
              <div key={inst.id} className="flex items-center gap-2 text-sm">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  {instructorInitials(inst.id)}
                </div>
                <span className="text-gray-600 dark:text-gray-400">{inst.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coverage Cell Component
// ---------------------------------------------------------------------------

function CoverageCell({
  count,
  needed,
  instructors,
  perInstructor,
  block,
  instructorInitials,
}: {
  count: number;
  needed: number;
  instructors: Instructor[];
  perInstructor: Record<string, { am1: boolean; mid: boolean; pm1: boolean; pm2: boolean }>;
  block: 'am1' | 'mid' | 'pm1' | 'pm2';
  instructorInitials: (id: string) => string;
}) {
  const available = instructors.filter(i => perInstructor[i.id]?.[block]);
  const isMet = count >= needed;
  const isEmpty = count === 0;

  return (
    <div
      className={`mx-auto min-w-[40px] rounded px-1.5 py-1 ${
        isEmpty ? 'bg-red-100 dark:bg-red-900/30' :
        !isMet ? 'bg-yellow-100 dark:bg-yellow-900/30' :
        'bg-green-100 dark:bg-green-900/30'
      }`}
      title={available.map(i => i.name).join(', ') || 'No coverage'}
    >
      <div className="flex justify-center gap-0.5">
        {available.length > 0 ? (
          available.slice(0, 3).map((inst) => (
            <span
              key={inst.id}
              className="text-xs font-bold text-gray-700 dark:text-gray-300"
            >
              {instructorInitials(inst.id)}
            </span>
          ))
        ) : (
          <span className="text-xs text-red-500">—</span>
        )}
      </div>
    </div>
  );
}
