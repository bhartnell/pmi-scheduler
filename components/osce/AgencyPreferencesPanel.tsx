'use client';

import { useEffect, useState } from 'react';

interface BlockResult {
  block_id: string;
  block_label: string;
  matching_students: { name: string; confirmed: boolean }[];
  requested_student_here: boolean;
}
interface PrefRequest {
  observer_id: string;
  observer_name: string;
  observer_agency: string;
  preferred_agency: string | null;
  preferred_student_name: string | null;
  blocks: BlockResult[];
  satisfied: boolean;
  agency_student_count: number;
  candidates: { name: string; scheduled_block: string | null }[];
}
interface Payload {
  cohort_linked: boolean;
  awaiting_scheduling: number;
  requests: PrefRequest[];
}

/** OSCE admin: evaluators who asked to see a particular agency or student, and whether their blocks have a match. */
export default function AgencyPreferencesPanel({ eventId, refreshKey }: { eventId: string; refreshKey?: number }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/osce/events/${eventId}/agency-matches`)
      .then(r => r.json())
      .then(d => { if (live) { if (d.success) setData(d); else setError(true); } })
      .catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [eventId, refreshKey]);

  if (error) {
    return <p className="mb-4 text-sm text-red-600 dark:text-red-400">Could not load evaluator preferences.</p>;
  }
  if (!data || data.requests.length === 0) return null;

  return (
    <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Evaluator preferences</h3>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${data.awaiting_scheduling > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'}`}>
          {data.awaiting_scheduling} awaiting scheduling
        </span>
      </div>
      {!data.cohort_linked && (
        <p className="mb-3 text-sm text-amber-700 dark:text-amber-300">
          This event is not linked to a cohort, so agencies cannot be matched to students. Link a cohort to see matches.
        </p>
      )}
      <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3">
        {data.requests.map(r => (
          <div key={r.observer_id} className={`rounded-lg border p-3 text-sm ${r.satisfied ? 'border-green-300 dark:border-green-800' : 'border-amber-300 dark:border-amber-800'}`}>
            <div className="font-medium text-gray-900 dark:text-white">
              {r.observer_name} <span className="font-normal text-gray-500 dark:text-gray-400">({r.observer_agency})</span>
            </div>
            <div className="text-gray-700 dark:text-gray-300 mb-2">
              Asked for {[r.preferred_agency && `${r.preferred_agency} students`, r.preferred_student_name && `student ${r.preferred_student_name}`].filter(Boolean).join(' and ')}
            </div>
            {r.blocks.map(b => (
              <div key={b.block_id} className="text-gray-600 dark:text-gray-300">
                <span className="font-medium">{b.block_label}:</span>{' '}
                {b.matching_students.length > 0
                  ? b.matching_students.map(s => `${s.name}${s.confirmed ? '' : ' (unconfirmed)'}`).join(', ')
                  : b.requested_student_here ? 'requested student is scheduled here'
                  : <span className="text-amber-700 dark:text-amber-300">no match scheduled</span>}
              </div>
            ))}
            {!r.satisfied && r.preferred_agency && data.cohort_linked && (
              r.agency_student_count === 0
                ? <p className="mt-2 text-amber-700 dark:text-amber-300">No {r.preferred_agency} students in this cohort.</p>
                : <p className="mt-2 text-gray-600 dark:text-gray-300">
                    Could move in: {r.candidates.map(c => `${c.name} (${c.scheduled_block ?? 'not scheduled'})`).join(', ')}
                  </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
