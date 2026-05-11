'use client';

/**
 * LogMyShiftModal — part-timer self-service shift logging.
 *
 * Different from LogHoursModal (the admin tool):
 *   - LogHoursModal bulk-creates recurring rows on behalf of
 *     someone else (admin → part-timer).
 *   - LogMyShiftModal creates ONE row on behalf of the calling
 *     user (any instructor). Used when picking up a class,
 *     covering a session, etc.
 *
 * Form fields per spec:
 *   - Date
 *   - Start / end time
 *   - Shift type (Class Coverage / Lab / Prep / Admin / Other)
 *   - Course/Class label (optional free text)
 *   - Covering-for instructor (optional dropdown)
 *   - Notes
 *
 * Auto-computes duration_minutes from start/end. Sends a
 * notification to admin/superadmin users on submit.
 */

import { useEffect, useState } from 'react';
import {
  Loader2,
  X,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface InstructorOption {
  id: string;
  name: string;
  email: string;
}

const SHIFT_TYPES: Array<{ value: string; label: string }> = [
  { value: 'class_coverage', label: 'Class Coverage' },
  { value: 'lab', label: 'Lab' },
  { value: 'prep', label: 'Prep' },
  { value: 'admin', label: 'Admin' },
  { value: 'other', label: 'Other' },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function diffMinutes(start: string, end: string): number | null {
  const m = (t: string) => {
    const [h, mm] = t.split(':').map(n => parseInt(n, 10));
    if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
    return h * 60 + mm;
  };
  const a = m(start);
  const b = m(end);
  if (a === null || b === null) return null;
  return b - a;
}

export interface LogMyShiftModalProps {
  onClose: () => void;
  onSaved: (durationMinutes: number) => void;
}

export default function LogMyShiftModal({ onClose, onSaved }: LogMyShiftModalProps) {
  const [date, setDate] = useState(today());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [shiftType, setShiftType] = useState('class_coverage');
  const [courseLabel, setCourseLabel] = useState('');
  const [coveringForUserId, setCoveringForUserId] = useState('');
  const [notes, setNotes] = useState('');
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load full-time instructors for the "covering for" dropdown.
  // Filter to active full-time staff — part-timers covering for
  // each other is rare and adds noise to the dropdown.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/lab-management/instructors?activeOnly=true')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const list: InstructorOption[] = Array.isArray(data.instructors)
          ? data.instructors
              .filter((i: { is_part_time?: boolean | null }) => !i.is_part_time)
              .map((i: InstructorOption) => ({
                id: i.id,
                name: i.name,
                email: i.email,
              }))
          : [];
        list.sort((a, b) => a.name.localeCompare(b.name));
        setInstructors(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const duration = diffMinutes(startTime, endTime);
  const durationValid = duration !== null && duration > 0;
  const durationLabel = durationValid
    ? `${(duration / 60).toFixed(duration % 60 === 0 ? 0 : 1)} hr${duration === 60 ? '' : 's'}`
    : 'invalid';

  const handleSubmit = async () => {
    setError(null);
    if (!date || !startTime || !endTime || !durationValid) {
      setError('Date, start time, and end time are required (end must be after start).');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/scheduling/log-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          start_time: startTime,
          end_time: endTime,
          shift_type: shiftType,
          course_label: courseLabel.trim() || undefined,
          covering_for_user_id: coveringForUserId || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSuccess(true);
      onSaved(data.duration_minutes ?? duration ?? 0);
      // Auto-close after a brief confirmation flash.
      setTimeout(() => onClose(), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log shift');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-600" />
            Log a shift
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Logs the hours against your account and notifies the coordinator. No approval needed.
          </p>

          {/* Date + times */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                End <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          <p className={`text-xs ${durationValid ? 'text-gray-500 dark:text-gray-400' : 'text-red-600 dark:text-red-400'}`}>
            Duration: <strong>{durationLabel}</strong>
          </p>

          {/* Shift type */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type
            </label>
            <select
              value={shiftType}
              onChange={e => setShiftType(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
            >
              {SHIFT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Course label */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Course / Class <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={courseLabel}
              onChange={e => setCourseLabel(e.target.value)}
              placeholder="e.g. EMT Lecture — Module 4"
              disabled={submitting}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Covering for */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Covering for <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              value={coveringForUserId}
              onChange={e => setCoveringForUserId(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
            >
              <option value="">— Not covering for anyone —</option>
              {instructors.map(i => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any context the coordinator should know"
              rows={2}
              disabled={submitting}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-3 flex items-start gap-2 text-sm text-red-800 dark:text-red-200">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 p-3 flex items-start gap-2 text-sm text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Logged — coordinator notified.</span>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !durationValid || success}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
            {submitting ? 'Logging…' : 'Log shift'}
          </button>
        </div>
      </div>
    </div>
  );
}
