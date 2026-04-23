'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChartPie, Briefcase } from 'lucide-react';
import WidgetCard from '../WidgetCard';

/**
 * Program Snapshot — active student counts grouped by program + semester,
 * plus (when applicable) a PM Sem 4 internship phase breakdown. The full
 * operational "who do we have in the building right now" view in one card.
 *
 * Rows with count = 0 are omitted by the server. Clicking a row navigates
 * to /academics/cohorts filtered to that program/semester.
 */

interface SnapshotRow {
  program: string;
  program_name: string | null;
  semester: number | null;
  count: number;
  href: string;
}

interface Payload {
  success: true;
  rows: SnapshotRow[];
  internship_phases: Record<string, number> | null;
}

const PHASE_LABEL: Record<string, string> = {
  pre_internship: 'Pre-Internship',
  phase_1_mentorship: 'Phase 1',
  phase_2_evaluation: 'Phase 2',
  extended: 'Extended',
  completed: 'Completed',
};

const PHASE_ORDER = [
  'pre_internship',
  'phase_1_mentorship',
  'phase_2_evaluation',
  'extended',
];

function rowLabel(row: SnapshotRow): string {
  if (row.semester == null) return row.program;
  return `${row.program} Sem ${row.semester}`;
}

export default function ProgramSnapshotWidget() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/dashboard/program-snapshot');
        const j = await r.json();
        if (j?.success) setData(j as Payload);
      } catch (e) {
        console.error('[ProgramSnapshotWidget] fetch', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rows = data?.rows ?? [];
  const total = rows.reduce((acc, r) => acc + r.count, 0);
  const phases = data?.internship_phases ?? null;
  const hasInternship =
    phases != null && Object.values(phases).some((n) => n > 0);

  return (
    <WidgetCard
      title="Program Snapshot"
      icon={<ChartPie className="w-5 h-5 text-violet-600 dark:text-violet-400" />}
      loading={loading}
    >
      {rows.length === 0 && !loading ? (
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
          No active students in any program.
        </div>
      ) : (
        <div className="space-y-3">
          {/* Two-column grid of program rows. Each row is a Link that
              deep-navigates to the filtered cohort list. */}
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {rows.map((r) => (
              <li key={`${r.program}-${r.semester ?? 'all'}`}>
                <Link
                  href={r.href}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-200 truncate">
                    {rowLabel(r)}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                    {r.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 px-2.5 pt-2 border-t border-gray-100 dark:border-gray-700">
            <span>Total active</span>
            <span className="font-semibold text-gray-700 dark:text-gray-300 tabular-nums">
              {total}
            </span>
          </div>

          {hasInternship && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 px-2.5 mb-1.5 uppercase tracking-wide">
                <Briefcase className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                PM Sem 4 · Internship Phase
              </div>
              <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5 px-2.5">
                {PHASE_ORDER.map((p) => {
                  const n = phases?.[p] ?? 0;
                  if (n === 0) return null;
                  return (
                    <li
                      key={p}
                      className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300"
                    >
                      <span>{PHASE_LABEL[p]}</span>
                      <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                        {n}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
