'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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
  ChevronLeft,
  TrendingUp,
  Save,
  LayoutGrid,
  List,
  Users,
  X,
} from 'lucide-react';
import WeekStripView from '@/components/lvfr/WeekStripView';
import type { GridDay, Instructor } from '@/components/lvfr/WeekStripView';
import { getInitials, emailToHue, getAvailabilityLevel } from '@/lib/lvfr-utils';

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

interface CoverageInfo {
  date: string;
  availableCount: number;
  minRequired: number;
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
  const [viewMode, setViewMode] = useState<'calendar' | 'list' | 'coverage'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(6); // 0-indexed: 6 = July
  const [currentYear] = useState(2026);
  const [coverage, setCoverage] = useState<CoverageInfo[]>([]);
  const [selectedCalDay, setSelectedCalDay] = useState<CourseDay | null>(null);
  const [schedulingGrid, setSchedulingGrid] = useState<GridDay[]>([]);
  const [schedulingInstructors, setSchedulingInstructors] = useState<Instructor[]>([]);

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

  // Fetch scheduling data for coverage overlay + week strip view
  const fetchSchedulingData = useCallback(async () => {
    try {
      const res = await fetch('/api/lvfr-aemt/scheduling');
      if (res.ok) {
        const data = await res.json();
        // Store full grid + instructors for WeekStripView
        setSchedulingGrid(data.grid || []);
        setSchedulingInstructors(data.instructors || []);
        // Derive coverage dots for calendar view
        const coverageData: CoverageInfo[] = [];
        for (const day of data.grid || []) {
          const minBlock = Math.min(
            day.blockCounts?.am1 ?? 0,
            day.blockCounts?.mid ?? 0,
            day.blockCounts?.pm1 ?? 0,
            day.blockCounts?.pm2 ?? 0
          );
          coverageData.push({
            date: day.date?.split('T')[0] || day.date,
            availableCount: minBlock,
            minRequired: day.minInstructors || 1,
          });
        }
        setCoverage(coverageData);
      }
    } catch {
      // Coverage is optional — don't block the page
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (isInstructor) fetchSchedulingData();
  }, [isInstructor, fetchSchedulingData]);

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

  // Group by week for list view
  const weeks: Record<number, CourseDay[]> = {};
  for (const d of days) {
    if (!weeks[d.week_number]) weeks[d.week_number] = [];
    weeks[d.week_number].push(d);
  }

  // Build lookup maps for calendar view
  const daysByDate = useMemo(() => {
    const map: Record<string, CourseDay> = {};
    for (const d of days) {
      const dateStr = d.date?.split('T')[0] || d.date;
      map[dateStr] = d;
    }
    return map;
  }, [days]);

  const suppByDate = useMemo(() => {
    const map: Record<string, SupplementaryDay> = {};
    for (const s of supplementaryDays) {
      const dateStr = s.date?.split('T')[0] || s.date;
      map[dateStr] = s;
    }
    return map;
  }, [supplementaryDays]);

  const coverageByDate = useMemo(() => {
    const map: Record<string, CoverageInfo> = {};
    for (const c of coverage) {
      map[c.date] = c;
    }
    return map;
  }, [coverage]);

  // Lookup from scheduling grid by date for rich day detail panel
  const gridByDate = useMemo(() => {
    const map: Record<string, GridDay> = {};
    for (const g of schedulingGrid) {
      const d = g.date?.split('T')[0] || g.date;
      map[d] = g;
    }
    return map;
  }, [schedulingGrid]);

  // Instructor name lookup
  const instructorMap = useMemo(() => {
    const map: Record<string, Instructor> = {};
    for (const inst of schedulingInstructors) {
      map[inst.id] = inst;
    }
    return map;
  }, [schedulingInstructors]);

    // Course month range: July (6) to September (8) 2026
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const canGoBack = currentMonth > 6;
  const canGoForward = currentMonth < 8;

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
          <div className="flex items-center justify-between">
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

            {/* View toggle */}
            <div className="flex items-center rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-600 dark:bg-gray-700">
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === 'calendar'
                    ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-600 dark:text-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                Calendar
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-600 dark:text-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <List className="h-4 w-4" />
                List
              </button>
              <button
                onClick={() => setViewMode('coverage')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === 'coverage'
                    ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-600 dark:text-blue-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <Users className="h-4 w-4" />
                Coverage
              </button>
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

        {/* ============================================================= */}
        {/* CALENDAR VIEW                                                  */}
        {/* ============================================================= */}
        {viewMode === 'calendar' && (
          <>
            {/* Month navigation */}
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
              <button
                onClick={() => canGoBack && setCurrentMonth(m => m - 1)}
                disabled={!canGoBack}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed dark:text-gray-400 dark:hover:bg-gray-700"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {monthNames[currentMonth]} {currentYear}
              </h2>
              <button
                onClick={() => canGoForward && setCurrentMonth(m => m + 1)}
                disabled={!canGoForward}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed dark:text-gray-400 dark:hover:bg-gray-700"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Calendar legend */}
            <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-blue-100 border border-blue-300 dark:bg-blue-900/40 dark:border-blue-700" /> Content</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-orange-100 border border-orange-300 dark:bg-orange-900/40 dark:border-orange-700" /> Lab Day</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-300 dark:bg-red-900/40 dark:border-red-700" /> Exam Day</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-gray-100 border border-gray-300 dark:bg-gray-700 dark:border-gray-600" /> Supplementary</span>
              {isInstructor && (
                <>
                  <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" /> Covered</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-500" /> Short</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" /> Gap</span>
                </>
              )}
            </div>

            {/* Monthly Grid */}
            <MonthGrid
              month={currentMonth}
              year={currentYear}
              daysByDate={daysByDate}
              suppByDate={suppByDate}
              coverageByDate={coverageByDate}
              today={today}
              isInstructor={isInstructor}
              selectedDay={selectedCalDay}
              onSelectDay={setSelectedCalDay}
            />

            {/* Selected Day Detail Panel */}
            {selectedCalDay && (
              <div className="rounded-xl border border-blue-200 bg-white dark:border-blue-800 dark:bg-gray-800 overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Day {selectedCalDay.day_number} — {selectedCalDay.title || selectedCalDay.chapters_covered?.join(', ') || 'No title'}
                  </h3>
                  <button onClick={() => setSelectedCalDay(null)} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
                <div className="px-4 py-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <Calendar className="h-4 w-4" />
                        {new Date(selectedCalDay.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </div>
                      {selectedCalDay.module?.name && (
                        <div className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                          Module: {selectedCalDay.module.name}
                        </div>
                      )}
                      <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Chapters Covered</h4>
                      {selectedCalDay.chapters_covered?.length > 0 ? (
                        <ul className="space-y-1">
                          {selectedCalDay.chapters_covered.map((ch) => (
                            <li key={ch} className="text-sm text-gray-600 dark:text-gray-400">{ch}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-400">No chapters listed</p>
                      )}
                    </div>
                    <div className="space-y-3">
                      {selectedCalDay.has_lab && (
                        <div className="rounded-lg bg-orange-50 p-3 dark:bg-orange-900/20">
                          <div className="flex items-center gap-2 text-sm font-semibold text-orange-700 dark:text-orange-400">
                            <Beaker className="h-4 w-4" /> Lab Session
                          </div>
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{selectedCalDay.lab_name || 'Lab session scheduled'}</p>
                        </div>
                      )}
                      {selectedCalDay.has_exam && (
                        <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
                          <div className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
                            <FileText className="h-4 w-4" /> Assessment
                          </div>
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{selectedCalDay.exam_name || 'Exam scheduled'}</p>
                        </div>
                      )}
                      {selectedCalDay.has_quiz && selectedCalDay.quiz_chapters?.length > 0 && (
                        <div className="rounded-lg bg-purple-50 p-3 dark:bg-purple-900/20">
                          <div className="flex items-center gap-2 text-sm font-semibold text-purple-700 dark:text-purple-400">
                            <BookOpen className="h-4 w-4" /> Quiz
                          </div>
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Covers: {selectedCalDay.quiz_chapters.join(', ')}</p>
                        </div>
                      )}
                      {selectedCalDay.status === 'completed' && (
                        <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
                          <div className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-400">
                            <CheckCircle2 className="h-4 w-4" /> Completed
                          </div>
                          {selectedCalDay.completion_notes && (
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{selectedCalDay.completion_notes}</p>
                          )}
                        </div>
                      )}
{/* Instructor Coverage Detail */}
                      {isInstructor && (() => {
                        const dateKey = selectedCalDay.date?.split('T')[0] || selectedCalDay.date;
                        const gridDay = gridByDate[dateKey];
                        const cov = coverageByDate[dateKey];
                        if (!gridDay && !cov) return null;

                        const primaryId = gridDay?.assignment?.primary_instructor_id;
                        const secondaryId = gridDay?.assignment?.secondary_instructor_id;
                        const primary = primaryId ? instructorMap[primaryId] : null;
                        const secondary = secondaryId ? instructorMap[secondaryId] : null;
                        const minNeeded = gridDay?.minInstructors || cov?.minRequired || 1;
                        const notes = gridDay?.assignment?.notes;

                        // Build availability list sorted: full > partial > unavailable
                        const availList = schedulingInstructors
                          .map(inst => ({
                            ...inst,
                            blocks: gridDay?.perInstructor?.[inst.id],
                            level: getAvailabilityLevel(gridDay?.perInstructor?.[inst.id]),
                          }))
                          .sort((a, b) => {
                            const order: Record<string, number> = { full: 0, partial: 1, unavailable: 2 };
                            return order[a.level] - order[b.level];
                          });

                        const assignedCount = (primary ? 1 : 0) + (secondary ? 1 : 0);
                        const isCovered = assignedCount >= minNeeded;

                        return (
                          <div className="space-y-3">
                            {/* Assigned Instructors */}
                            <div className={`rounded-lg p-3 ${
                              isCovered
                                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                            }`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                  <Users className="h-4 w-4" />
                                  Assigned ({assignedCount}/{minNeeded} needed)
                                </div>
                                {isCovered ? (
                                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">Covered</span>
                                ) : (
                                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">Needs Coverage</span>
                                )}
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-gray-400 dark:text-gray-500 w-6">P</span>
                                  {primary ? (
                                    <span className="flex items-center gap-2">
                                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                                        style={{ backgroundColor: `hsl(${emailToHue(primary.email)}, 55%, 45%)` }}>
                                        {getInitials(primary.name)}
                                      </span>
                                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{primary.name}</span>
                                    </span>
                                  ) : (
                                    <span className="text-sm italic text-gray-400 dark:text-gray-500">Not assigned</span>
                                  )}
                                </div>
                                {(minNeeded > 1 || secondary) && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500 w-6">S</span>
                                    {secondary ? (
                                      <span className="flex items-center gap-2">
                                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                                          style={{ backgroundColor: `hsl(${emailToHue(secondary.email)}, 55%, 45%)` }}>
                                          {getInitials(secondary.name)}
                                        </span>
                                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{secondary.name}</span>
                                      </span>
                                    ) : (
                                      <span className="text-sm italic text-gray-400 dark:text-gray-500">Not assigned</span>
                                    )}
                                  </div>
                                )}
                              </div>
                              {notes && (
                                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-600 pt-2">{notes}</p>
                              )}
                            </div>

                            {/* Available Instructors */}
                            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                                Available This Day
                              </div>
                              <div className="space-y-1">
                                {availList.map(inst => {
                                  const dotColor = inst.level === 'full' ? 'bg-green-500' : inst.level === 'partial' ? 'bg-yellow-500' : 'bg-gray-400';
                                  const blocksAvail = inst.blocks
                                    ? [inst.blocks.am1, inst.blocks.mid, inst.blocks.pm1, inst.blocks.pm2].filter(Boolean).length
                                    : 0;
                                  const labelText = inst.level === 'full' ? 'All day' : inst.level === 'partial' ? blocksAvail + '/4 blocks' : 'Unavailable';
                                  return (
                                    <div key={inst.id} className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
                                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                                          style={{ backgroundColor: `hsl(${emailToHue(inst.email)}, 55%, 45%)` }}>
                                          {getInitials(inst.name)}
                                        </span>
                                        <span className={`text-sm ${inst.level === 'unavailable' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
                                          {inst.name}
                                        </span>
                                      </div>
                                      <span className={`text-xs ${inst.level === 'unavailable' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
                                        {labelText}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Instructor mark complete */}
                  {isInstructor && selectedCalDay.status !== 'completed' && (
                    <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-600">
                      <div className="mb-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Completion Notes (optional)
                        </label>
                        <textarea
                          value={editingNotes[selectedCalDay.day_number] || selectedCalDay.completion_notes || ''}
                          onChange={(e) => setEditingNotes(prev => ({ ...prev, [selectedCalDay.day_number]: e.target.value }))}
                          rows={2}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                          placeholder="Any modifications or notes about this day..."
                        />
                      </div>
                      <button
                        onClick={() => markDayComplete(selectedCalDay.day_number, selectedCalDay.chapters_covered || [])}
                        disabled={saving === selectedCalDay.day_number}
                        className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {saving === selectedCalDay.day_number ? 'Saving...' : <><Save className="h-4 w-4" /> Mark Day Complete</>}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ============================================================= */}
        {/* COVERAGE VIEW (Week Strip)                                     */}
        {/* ============================================================= */}
        {viewMode === 'coverage' && isInstructor && (
          <WeekStripView
            grid={schedulingGrid}
            instructors={schedulingInstructors}
            onRefresh={() => {
              fetchData();
              fetchSchedulingData();
            }}
            isInstructor={isInstructor}
          />
        )}
        {viewMode === 'coverage' && !isInstructor && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
            <Users className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
            <p className="mt-3 text-gray-500 dark:text-gray-400">Coverage view is available for instructors only.</p>
          </div>
        )}

        {/* ============================================================= */}
        {/* LIST VIEW                                                      */}
        {/* ============================================================= */}
        {viewMode === 'list' && (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Month Grid Component
// ---------------------------------------------------------------------------

function MonthGrid({
  month,
  year,
  daysByDate,
  suppByDate,
  coverageByDate,
  today,
  isInstructor,
  selectedDay,
  onSelectDay,
}: {
  month: number;
  year: number;
  daysByDate: Record<string, CourseDay>;
  suppByDate: Record<string, SupplementaryDay>;
  coverageByDate: Record<string, CoverageInfo>;
  today: string;
  isInstructor: boolean;
  selectedDay: CourseDay | null;
  onSelectDay: (d: CourseDay | null) => void;
}) {
  // Build calendar grid for the month
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay(); // 0=Sun
  const totalDays = lastDay.getDate();

  const cells: Array<{ date: string; dayNum: number } | null> = [];

  // Leading blanks
  for (let i = 0; i < startDow; i++) cells.push(null);
  // Days
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ date: dateStr, dayNum: d });
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="px-1 py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7">
        {cells.map((cell, idx) => {
          if (!cell) {
            return <div key={`blank-${idx}`} className="min-h-[80px] sm:min-h-[100px] border-b border-r border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/20" />;
          }

          const courseDay = daysByDate[cell.date];
          const suppDay = suppByDate[cell.date];
          const cov = coverageByDate[cell.date];
          const isToday = cell.date === today;
          const isSelected = selectedDay && courseDay && selectedDay.day_number === courseDay.day_number;

          // Determine cell color
          let cellBg = '';
          let borderColor = '';
          if (courseDay) {
            if (courseDay.has_exam) {
              cellBg = 'bg-red-50 dark:bg-red-900/20';
              borderColor = 'border-red-200 dark:border-red-800';
            } else if (courseDay.has_lab) {
              cellBg = 'bg-orange-50 dark:bg-orange-900/20';
              borderColor = 'border-orange-200 dark:border-orange-800';
            } else {
              cellBg = 'bg-blue-50 dark:bg-blue-900/20';
              borderColor = 'border-blue-200 dark:border-blue-800';
            }
          } else if (suppDay) {
            cellBg = 'bg-gray-100 dark:bg-gray-700/40';
            borderColor = 'border-gray-300 dark:border-gray-600';
          }

          // Coverage dot
          let covDot = '';
          if (isInstructor && cov) {
            if (cov.availableCount >= cov.minRequired) covDot = 'bg-green-500';
            else if (cov.availableCount > 0) covDot = 'bg-yellow-500';
            else covDot = 'bg-red-500';
          }

          const hasContent = courseDay || suppDay;

          return (
            <div
              key={cell.date}
              onClick={() => courseDay ? onSelectDay(isSelected ? null : courseDay) : undefined}
              className={`min-h-[80px] sm:min-h-[100px] border-b border-r border-gray-100 dark:border-gray-700/50 p-1 sm:p-1.5 transition-colors ${cellBg} ${
                hasContent && courseDay ? 'cursor-pointer hover:ring-2 hover:ring-blue-400 hover:ring-inset' : ''
              } ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''} ${
                isToday ? 'ring-2 ring-blue-400 ring-inset' : ''
              }`}
            >
              {/* Date number */}
              <div className="flex items-start justify-between">
                <span className={`text-xs font-medium ${
                  isToday
                    ? 'flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white'
                    : hasContent
                    ? 'text-gray-900 dark:text-white'
                    : 'text-gray-400 dark:text-gray-600'
                }`}>
                  {cell.dayNum}
                </span>
                {covDot && <span className={`w-2 h-2 rounded-full ${covDot}`} />}
              </div>

              {/* Course day content */}
              {courseDay && (
                <div className="mt-0.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">
                      D{courseDay.day_number}
                    </span>
                    {courseDay.status === 'completed' && (
                      <CheckCircle2 className="h-2.5 w-2.5 text-green-500" />
                    )}
                  </div>
                  <div className="text-[10px] leading-tight text-gray-600 dark:text-gray-400 line-clamp-2 mt-0.5">
                    {courseDay.title || courseDay.chapters_covered?.join(', ') || ''}
                  </div>
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {courseDay.has_lab && <Beaker className="h-2.5 w-2.5 text-orange-500" />}
                    {courseDay.has_exam && <FileText className="h-2.5 w-2.5 text-red-500" />}
                    {courseDay.has_quiz && <BookOpen className="h-2.5 w-2.5 text-purple-500" />}
                  </div>
                </div>
              )}

              {/* Supplementary day */}
              {suppDay && !courseDay && (
                <div className="mt-0.5">
                  <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 leading-tight line-clamp-2">
                    {suppDay.title}
                  </div>
                  {suppDay.instructor && (
                    <div className="text-[9px] text-gray-400 mt-0.5">{suppDay.instructor}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day Row Component (for list view)
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
