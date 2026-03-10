'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar,
  ArrowLeft,
  CheckCircle2,
  Clock,
  BookOpen,
  Beaker,
  FileText,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Save,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Module {
  id: string;
  name: string;
  number: number;
}

interface CourseDay {
  id: string;
  day_number: number;
  date: string;
  day_of_week: string;
  week_number: number;
  module_id: string;
  module: Module | null;
  day_type: string;
  title: string | null;
  chapters_covered: string[];
  has_lab: boolean;
  lab_name: string | null;
  has_exam: boolean;
  exam_name: string | null;
  exam_module: string | null;
  has_quiz: boolean;
  quiz_chapters: string[];
  time_blocks: unknown;
  status: string;
  completion_notes: string | null;
  completed_by: string | null;
  completed_at: string | null;
}

interface SupplementaryDay {
  id: string;
  day_number: number;
  date: string;
  day_of_week: string | null;
  week_number: number | null;
  title: string | null;
  instructor: string | null;
}

interface PaceInfo {
  completedChapters: number;
  scheduledThroughToday: number;
  totalChapters: number;
  status: 'on_track' | 'slightly_behind' | 'behind';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LVFRCalendarPage() {
  const [days, setDays] = useState<CourseDay[]>([]);
  const [supplementaryDays, setSupplementaryDays] = useState<SupplementaryDay[]>([]);
  const [paceInfo, setPaceInfo] = useState<PaceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('student');
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);

  const isInstructor = ['superadmin', 'admin', 'lead_instructor', 'instructor', 'agency_liaison'].includes(userRole);

  const fetchData = useCallback(async () => {
    try {
      const [calRes, meRes] = await Promise.all([
        fetch('/api/lvfr-aemt/calendar'),
        fetch('/api/instructor/me'),
      ]);

      if (calRes.ok) {
        const calData = await calRes.json();
        setDays(calData.days || []);
        setSupplementaryDays(calData.supplementaryDays || []);
        setPaceInfo(calData.paceInfo || null);
      }

      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.success && meData.user) {
          setUserRole(meData.user.role);
        }
      }
    } catch (err) {
      console.error('Error fetching calendar:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const markDayComplete = async (dayNumber: number, chaptersCompleted: string[]) => {
    setSaving(dayNumber);
    try {
      const res = await fetch('/api/lvfr-aemt/calendar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_number: dayNumber,
          status: 'completed',
          completion_notes: editingNotes[dayNumber] || null,
          chapters_completed: chaptersCompleted,
        }),
      });
      if (res.ok) await fetchData();
    } catch (err) {
      console.error('Error marking day complete:', err);
    } finally {
      setSaving(null);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const nextDay = days.find(d => d.date >= today && d.status !== 'completed');

  // Group by week
  const weeks: Record<number, CourseDay[]> = {};
  for (const d of days) {
    if (!weeks[d.week_number]) weeks[d.week_number] = [];
    weeks[d.week_number].push(d);
  }

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
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/lvfr-aemt"
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Course Calendar
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  LVFR AEMT — 30 instruction days
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Next Class Card */}
        {nextDay && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <Clock className="h-5 w-5" />
              <span className="font-semibold">
                Next Class: Day {nextDay.day_number}, {nextDay.day_of_week}{' '}
                {new Date(nextDay.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <p className="mt-1 text-sm text-blue-600 dark:text-blue-400">
              {nextDay.title || nextDay.chapters_covered?.join(', ') || 'No details'}
              {nextDay.has_lab && ` — LAB: ${nextDay.lab_name || 'Lab Session'}`}
              {nextDay.has_exam && ` — EXAM: ${nextDay.exam_name || 'Exam'}`}
            </p>
          </div>
        )}

        {/* Pace Indicator (instructor only) */}
        {paceInfo && isInstructor && (
          <div className={`rounded-xl border p-4 ${
            paceInfo.status === 'on_track'
              ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
              : paceInfo.status === 'slightly_behind'
              ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20'
              : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
          }`}>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              <span className="font-semibold">
                Course Pace: {paceInfo.completedChapters} / {paceInfo.totalChapters} chapters
              </span>
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                paceInfo.status === 'on_track' ? 'bg-green-200 text-green-800' :
                paceInfo.status === 'slightly_behind' ? 'bg-yellow-200 text-yellow-800' :
                'bg-red-200 text-red-800'
              }`}>
                {paceInfo.status === 'on_track' ? 'On Track' :
                 paceInfo.status === 'slightly_behind' ? 'Slightly Behind' : 'Behind Schedule'}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className={`h-full rounded-full ${
                  paceInfo.status === 'on_track' ? 'bg-green-500' :
                  paceInfo.status === 'slightly_behind' ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.round((paceInfo.completedChapters / paceInfo.totalChapters) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Calendar Grid by Week */}
        {Object.entries(weeks)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([weekNum, weekDays]) => (
            <div key={weekNum} className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Week {weekNum}
                </h2>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {weekDays.map((day) => (
                  <DayRow
                    key={day.day_number}
                    day={day}
                    isInstructor={isInstructor}
                    isExpanded={expandedDay === day.day_number}
                    onToggle={() => setExpandedDay(expandedDay === day.day_number ? null : day.day_number)}
                    notes={editingNotes[day.day_number] || day.completion_notes || ''}
                    onNotesChange={(v) => setEditingNotes(prev => ({ ...prev, [day.day_number]: v }))}
                    onMarkComplete={() => markDayComplete(day.day_number, day.chapters_covered || [])}
                    saving={saving === day.day_number}
                    today={today}
                  />
                ))}
              </div>
            </div>
          ))}

        {/* Supplementary Days */}
        {supplementaryDays.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Supplementary Sessions (Mondays)
              </h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {supplementaryDays.map((s) => (
                <div key={s.id} className="flex items-center gap-4 px-4 py-3 opacity-70">
                  <div className="w-20 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(s.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                    {s.title}
                  </div>
                  {s.instructor && (
                    <span className="text-xs text-gray-400">{s.instructor}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day Row Component
// ---------------------------------------------------------------------------

function DayRow({
  day,
  isInstructor,
  isExpanded,
  onToggle,
  notes,
  onNotesChange,
  onMarkComplete,
  saving,
  today,
}: {
  day: CourseDay;
  isInstructor: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  notes: string;
  onNotesChange: (v: string) => void;
  onMarkComplete: () => void;
  saving: boolean;
  today: string;
}) {
  const isPast = day.date < today;
  const isToday = day.date === today;
  const isCompleted = day.status === 'completed';

  return (
    <div className={`${isToday ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
      {/* Main row */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30"
      >
        {/* Status icon */}
        <div className="flex-shrink-0">
          {isCompleted ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : isPast ? (
            <AlertCircle className="h-5 w-5 text-yellow-500" />
          ) : isToday ? (
            <Clock className="h-5 w-5 text-blue-500" />
          ) : (
            <div className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
          )}
        </div>

        {/* Day info */}
        <div className="w-12 flex-shrink-0 text-center">
          <div className="text-sm font-bold text-gray-900 dark:text-white">
            D{day.day_number}
          </div>
        </div>

        <div className="w-20 flex-shrink-0 text-sm text-gray-500 dark:text-gray-400">
          {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>

        <div className="w-10 flex-shrink-0 text-xs text-gray-400">
          {day.day_of_week?.slice(0, 3)}
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {day.title || day.chapters_covered?.join(', ') || `Day ${day.day_number}`}
          </div>
          {day.module?.name && (
            <div className="text-xs text-gray-400">{day.module.name}</div>
          )}
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-shrink-0">
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
          {day.has_quiz && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              <BookOpen className="h-3 w-3" /> Quiz
            </span>
          )}
        </div>

        {/* Expand arrow */}
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-4 dark:border-gray-700 dark:bg-gray-800/50">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Chapters */}
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Chapters Covered
              </h4>
              {day.chapters_covered?.length > 0 ? (
                <ul className="space-y-1">
                  {day.chapters_covered.map((ch) => (
                    <li key={ch} className="text-sm text-gray-600 dark:text-gray-400">
                      {ch}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">No chapters listed</p>
              )}
            </div>

            {/* Details */}
            <div className="space-y-3">
              {day.has_lab && (
                <div>
                  <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-400">Lab Session</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{day.lab_name || 'Lab session scheduled'}</p>
                </div>
              )}
              {day.has_exam && (
                <div>
                  <h4 className="text-sm font-semibold text-red-700 dark:text-red-400">Assessment</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{day.exam_name || 'Exam scheduled'}</p>
                </div>
              )}
              {day.has_quiz && day.quiz_chapters?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-400">Quiz</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Covers: {day.quiz_chapters.join(', ')}</p>
                </div>
              )}
              {day.completion_notes && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Notes</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{day.completion_notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Instructor actions */}
          {isInstructor && !isCompleted && (
            <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-600">
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Completion Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => onNotesChange(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  placeholder="Any modifications or notes about this day..."
                />
              </div>
              <button
                onClick={onMarkComplete}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Mark Day Complete
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
