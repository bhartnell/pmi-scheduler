'use client';

import { useState, useMemo } from 'react';
import { X, Beaker, FileText, Save } from 'lucide-react';
import { getInitials, emailToHue, getAvailabilityLevel } from '@/lib/lvfr-utils';
import type { AvailabilityLevel } from '@/lib/lvfr-utils';

// Re-export types for consumers
export interface GridDay {
  day_number: number;
  date: string;
  day_of_week: string;
  week_number: number;
  title: string | null;
  has_lab: boolean;
  lab_name: string | null;
  has_exam: boolean;
  exam_name: string | null;
  day_type: string;
  assignment: {
    primary_instructor_id: string | null;
    secondary_instructor_id: string | null;
    additional_instructors: string[];
    min_instructors: number;
    notes: string | null;
  } | null;
  minInstructors: number;
  blockCounts: { am1: number; mid: number; pm1: number; pm2: number };
  perInstructor: Record<string, { am1: boolean; mid: boolean; pm1: boolean; pm2: boolean }>;
  rowStatus: 'ok' | 'short' | 'gap';
}

export interface Instructor {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AssignmentModalProps {
  day: GridDay;
  instructors: Instructor[];
  onClose: () => void;
  onSave: () => void;
}

const AVAIL_DOT: Record<AvailabilityLevel, string> = {
  full: 'bg-green-500',
  partial: 'bg-yellow-500',
  unavailable: 'bg-gray-400',
};

const AVAIL_LABEL: Record<AvailabilityLevel, string> = {
  full: 'All day',
  partial: 'Partial',
  unavailable: 'Unavailable',
};

export default function AssignmentModal({ day, instructors, onClose, onSave }: AssignmentModalProps) {
  const [primaryId, setPrimaryId] = useState<string>(day.assignment?.primary_instructor_id || '');
  const [secondaryId, setSecondaryId] = useState<string>(day.assignment?.secondary_instructor_id || '');
  const [minInstructors, setMinInstructors] = useState<number>(day.assignment?.min_instructors || day.minInstructors);
  const [notes, setNotes] = useState<string>(day.assignment?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sort instructors by availability for this day
  const sortedInstructors = useMemo(() => {
    return [...instructors].sort((a, b) => {
      const aLevel = getAvailabilityLevel(day.perInstructor[a.id]);
      const bLevel = getAvailabilityLevel(day.perInstructor[b.id]);
      const order: Record<AvailabilityLevel, number> = { full: 0, partial: 1, unavailable: 2 };
      return order[aLevel] - order[bLevel] || a.name.localeCompare(b.name);
    });
  }, [instructors, day.perInstructor]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/lvfr-aemt/scheduling', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_number: day.day_number,
          primary_instructor_id: primaryId || null,
          secondary_instructor_id: secondaryId || null,
          min_instructors: minInstructors,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const renderSelect = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    excludeId?: string
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      >
        <option value="">— None —</option>
        {sortedInstructors
          .filter((inst) => inst.id !== excludeId)
          .map((inst) => {
            const level = getAvailabilityLevel(day.perInstructor[inst.id]);
            const blocks = day.perInstructor[inst.id];
            const blockText = blocks
              ? `AM1:${blocks.am1 ? '✓' : '✗'} MID:${blocks.mid ? '✓' : '✗'} PM1:${blocks.pm1 ? '✓' : '✗'} PM2:${blocks.pm2 ? '✓' : '✗'}`
              : 'No availability data';
            return (
              <option key={inst.id} value={inst.id}>
                {level === 'full' ? '🟢' : level === 'partial' ? '🟡' : '⚪'}{' '}
                {inst.name} — {AVAIL_LABEL[level]} ({blockText})
              </option>
            );
          })}
      </select>
    </div>
  );

  const dateDisplay = new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Day {day.day_number} — {dateDisplay}
            </h3>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {day.title || 'No title'}
            </p>
            <div className="mt-1 flex items-center gap-2">
              {day.has_lab && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                  <Beaker className="h-3 w-3" /> Lab
                </span>
              )}
              {day.has_exam && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  <FileText className="h-3 w-3" /> Exam
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-4">
          {renderSelect('Primary Instructor', primaryId, setPrimaryId, secondaryId)}
          {renderSelect('Secondary Instructor', secondaryId, setSecondaryId, primaryId)}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Min Instructors Needed
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={minInstructors}
              onChange={(e) => setMinInstructors(parseInt(e.target.value) || 1)}
              className="w-20 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              placeholder="Assignment notes..."
            />
          </div>

          {/* Instructor availability summary */}
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
            <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
              Availability for this day
            </h4>
            <div className="space-y-1">
              {sortedInstructors.slice(0, 6).map((inst) => {
                const level = getAvailabilityLevel(day.perInstructor[inst.id]);
                const hue = emailToHue(inst.email);
                return (
                  <div key={inst.id} className="flex items-center gap-2 text-sm">
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{
                        backgroundColor: `hsl(${hue}, 70%, 90%)`,
                        color: `hsl(${hue}, 50%, 30%)`,
                      }}
                    >
                      {getInitials(inst.name)}
                    </div>
                    <span className={`w-2 h-2 rounded-full ${AVAIL_DOT[level]}`} />
                    <span className="text-gray-700 dark:text-gray-300">{inst.name}</span>
                    <span className="ml-auto text-xs text-gray-400">{AVAIL_LABEL[level]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Assignment'}
          </button>
        </div>
      </div>
    </div>
  );
}
