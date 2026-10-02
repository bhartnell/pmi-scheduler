'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ClipboardCheck, Loader2, AlertTriangle } from 'lucide-react';

interface CohortOsceStudent {
  student_id: string;
  student_name: string;
  assessment_count: number;
  worst_readiness: string | null;
  has_unconfirmed_match: boolean;
}

const READINESS_META: Record<string, { label: string; className: string }> = {
  ready: { label: 'Ready', className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  ready_with_concerns: { label: 'Concerns', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  not_yet_ready: { label: 'Not Ready', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
};

/**
 * Cohort-level OSCE readiness rollup — companion to StudentOsceResultsCard.
 * Only lists students who have at least one matched OSCE assessment; a
 * student with none simply doesn't appear (nothing to surface yet).
 */
export default function CohortOsceResultsCard({ cohortId }: { cohortId: string }) {
  const [students, setStudents] = useState<CohortOsceStudent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch(`/api/osce/cohort-results?cohort_id=${cohortId}`);
      if (res.ok) {
        const data = await res.json();
        setStudents((data.students || []).filter((s: CohortOsceStudent) => s.assessment_count > 0));
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [cohortId]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (students.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
        <ClipboardCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        OSCE Results
        <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
          {students.length} student{students.length !== 1 ? 's' : ''} assessed
        </span>
      </h2>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {students.map(s => (
          <Link
            key={s.student_id}
            href={`/academics/students/${s.student_id}`}
            className="flex items-center justify-between gap-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/40 -mx-2 px-2 rounded"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.student_name}</span>
              {s.has_unconfirmed_match && (
                <span title="At least one assessment is an unconfirmed name match — verify on the student's page">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {s.assessment_count} assessment{s.assessment_count !== 1 ? 's' : ''}
              </span>
              {s.worst_readiness && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${READINESS_META[s.worst_readiness]?.className || ''}`}>
                  {READINESS_META[s.worst_readiness]?.label || s.worst_readiness}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
