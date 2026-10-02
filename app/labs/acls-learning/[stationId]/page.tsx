'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Eye } from 'lucide-react';

// ACLS learning-station tracker (Task Handoff Queue [ACLS MON 5/5]).
// Two states only, Pass and Watch, one mark per student per station, optional
// note. UNOFFICIAL: not scored, not a certification record, nothing carries
// past the day. Stored in acls_learning_marks, never a certification table.

interface Student { id: string; first_name: string; last_name: string }
interface Mark { student_id: string; mark: 'pass' | 'watch'; note: string | null }

export default function AclsLearningTrackerPage() {
  const { stationId } = useParams<{ stationId: string }>();
  const [title, setTitle] = useState('Learning station');
  const [labDayId, setLabDayId] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const stRes = await fetch(`/api/lab-management/stations/${stationId}`);
      const stData = await stRes.json();
      if (!stData.success) throw new Error(stData.error || 'Station not found');
      const st = stData.station;
      setLabDayId(st.lab_day?.id ?? st.lab_day_id ?? null);
      setTitle(st.custom_title || st.scenario?.title || `Station ${st.station_number ?? ''}`);

      const cohortId = st.lab_day?.cohort?.id;
      if (cohortId) {
        const sRes = await fetch(`/api/lab-management/students?cohortId=${cohortId}`);
        const sData = await sRes.json();
        if (sData.success) {
          setStudents(
            (sData.students || []).map((s: Student) => ({ id: s.id, first_name: s.first_name, last_name: s.last_name }))
          );
        }
      }

      const mRes = await fetch(`/api/acls-learning-marks?stationId=${stationId}`);
      const mData = await mRes.json();
      if (mData.success) {
        const byStudent: Record<string, Mark> = {};
        const noteMap: Record<string, string> = {};
        for (const m of mData.marks) {
          byStudent[m.student_id] = m;
          if (m.note) noteMap[m.student_id] = m.note;
        }
        setMarks(byStudent);
        setNotes(noteMap);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [stationId]);

  useEffect(() => { load(); }, [load]);

  const save = async (studentId: string, mark: 'pass' | 'watch') => {
    setSaving(studentId);
    setError(null);
    try {
      const res = await fetch('/api/acls-learning-marks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stationId, studentId, mark, note: notes[studentId] || '' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Save failed');
      setMarks((prev) => ({ ...prev, [studentId]: data.mark }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(null);
    }
  };

  const sorted = useMemo(
    () => [...students].sort((a, b) => `${a.last_name}${a.first_name}`.localeCompare(`${b.last_name}${b.first_name}`)),
    [students]
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link
        href={labDayId ? `/labs/schedule/${labDayId}` : '/labs/acls-hub'}
        className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mb-3"
      >
        <ArrowLeft className="w-4 h-4" /> Back to lab day
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ACLS Learning Station Tracker</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{title}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Pass = followed the algorithm. Watch = keep an eye on them. Not scored, not an official record.
      </p>

      {error && <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-2 text-sm">{error}</div>}
      {loading && <p className="text-gray-500">Loading...</p>}

      <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3">
        {sorted.map((s) => {
          const m = marks[s.id];
          return (
            <div key={s.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
              <div className="font-medium text-gray-900 dark:text-white mb-2">{s.last_name}, {s.first_name}</div>
              <div className="flex gap-2 mb-2">
                <button
                  disabled={saving === s.id}
                  onClick={() => save(s.id, 'pass')}
                  className={`flex-1 min-h-[44px] inline-flex items-center justify-center gap-1 rounded-lg border text-sm font-medium ${
                    m?.mark === 'pass'
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/20'
                  }`}
                >
                  <Check className="w-4 h-4" /> Pass
                </button>
                <button
                  disabled={saving === s.id}
                  onClick={() => save(s.id, 'watch')}
                  className={`flex-1 min-h-[44px] inline-flex items-center justify-center gap-1 rounded-lg border text-sm font-medium ${
                    m?.mark === 'watch'
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                  }`}
                >
                  <Eye className="w-4 h-4" /> Watch
                </button>
              </div>
              <input
                type="text"
                value={notes[s.id] || ''}
                onChange={(e) => setNotes((prev) => ({ ...prev, [s.id]: e.target.value }))}
                onBlur={() => { if (m) save(s.id, m.mark); }}
                placeholder="Optional note"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
