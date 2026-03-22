'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  ChevronLeft,
  Calendar as CalendarIcon,
  List,
  Grid3X3,
  LayoutGrid,
  Filter,
  Printer,
  Clock,
  Users,
  MapPin,
  Eye,
  ArrowRight,
} from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';

// ── Types ──────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string;
  source: 'planner' | 'lab_day' | 'lvfr' | 'clinical' | 'shift' | 'meeting';
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  program?: 'paramedic' | 'emt' | 'aemt' | 'lvfr' | 'other';
  color: string;
  cohort_number?: number;
  instructor_names?: string[];
  room?: string;
  linked_id?: string;
  linked_url?: string;
  event_type: 'class' | 'lab' | 'exam' | 'clinical' | 'shift' | 'meeting' | 'other';
  metadata?: Record<string, unknown>;
}

type ViewMode = 'week' | 'month' | 'list';
type PresetView = 'all' | 'instructor' | 'labs';

const PROGRAMS = ['paramedic', 'emt', 'aemt', 'lvfr'] as const;
const EVENT_TYPES = ['class', 'lab', 'clinical', 'exam', 'shift'] as const;

const PROGRAM_LABELS: Record<string, string> = {
  paramedic: 'Paramedic',
  emt: 'EMT',
  aemt: 'AEMT',
  lvfr: 'LVFR',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  class: 'Classes',
  lab: 'Labs',
  clinical: 'Clinical',
  exam: 'Exams',
  shift: 'Shifts',
};

const PROGRAM_COLORS: Record<string, string> = {
  paramedic: '#3B82F6',
  emt: '#22C55E',
  aemt: '#F59E0B',
  lvfr: '#F97316',
  other: '#6B7280',
};

// ── Utility functions ──────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getMonthDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const start = addDays(first, -startDay);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(addDays(start, i));
  }
  return days;
}

function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

// ── Main component (wrapped in Suspense for useSearchParams) ───────────

function CalendarContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [presetView, setPresetView] = useState<PresetView>('all');
  const [selectedInstructor, setSelectedInstructor] = useState<string>('');
  const [instructorList, setInstructorList] = useState<{ id: string; name: string }[]>([]);

  // Filters from URL params or defaults
  const [activePrograms, setActivePrograms] = useState<Set<string>>(
    new Set(PROGRAMS)
  );
  const [activeEventTypes, setActiveEventTypes] = useState<Set<string>>(
    new Set(EVENT_TYPES)
  );

  // Initialize from URL params
  useEffect(() => {
    const view = searchParams.get('view') as ViewMode | null;
    if (view && ['week', 'month', 'list'].includes(view)) {
      setViewMode(view);
    }
    const programs = searchParams.get('programs');
    if (programs) {
      setActivePrograms(new Set(programs.split(',')));
    }
    const types = searchParams.get('types');
    if (types) {
      setActiveEventTypes(new Set(types.split(',')));
    }
    const preset = searchParams.get('preset') as PresetView | null;
    if (preset) setPresetView(preset);
    const dateParam = searchParams.get('date');
    if (dateParam) {
      setCurrentDate(new Date(dateParam + 'T12:00:00'));
    }
  }, []);

  // Detect mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Default to list on mobile
  useEffect(() => {
    if (isMobile && viewMode === 'week') {
      setViewMode('list');
    }
  }, [isMobile]);

  // Auth redirect
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Computed date ranges
  const dateRange = useMemo(() => {
    if (viewMode === 'week') {
      const monday = getMonday(currentDate);
      return {
        start: toDateStr(monday),
        end: toDateStr(addDays(monday, 6)),
      };
    } else if (viewMode === 'month') {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      // Extend to cover full weeks
      const startDay = firstDay.getDay();
      const start = addDays(firstDay, -startDay);
      const endDay = lastDay.getDay();
      const end = addDays(lastDay, 6 - endDay);
      return { start: toDateStr(start), end: toDateStr(end) };
    } else {
      // List: show 2 weeks
      const monday = getMonday(currentDate);
      return {
        start: toDateStr(monday),
        end: toDateStr(addDays(monday, 13)),
      };
    }
  }, [currentDate, viewMode]);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const includeTypes: string[] = [];
      if (activeEventTypes.has('class') || activeEventTypes.has('exam')) includeTypes.push('classes');
      if (activeEventTypes.has('lab')) includeTypes.push('labs');
      if (activeEventTypes.has('clinical')) includeTypes.push('clinical');
      if (activeEventTypes.has('shift')) includeTypes.push('shifts');
      if (activePrograms.has('lvfr')) includeTypes.push('lvfr');

      const params = new URLSearchParams({
        start_date: dateRange.start,
        end_date: dateRange.end,
        include: includeTypes.join(','),
        programs: Array.from(activePrograms).join(','),
      });

      if (presetView === 'instructor' && selectedInstructor) {
        params.set('instructor_id', selectedInstructor);
      }

      const res = await fetch(`/api/calendar/unified?${params}`);
      const data = await res.json();
      if (data.events) {
        setEvents(data.events);
      }
    } catch (err) {
      console.error('Failed to fetch calendar events:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, activePrograms, activeEventTypes, presetView, selectedInstructor]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchEvents();
    }
  }, [fetchEvents, status]);

  // Fetch instructor list
  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/instructor/me')
        .then(r => r.json())
        .catch(() => null);

      fetch('/api/admin/users?role=instructor&limit=200')
        .then(r => r.json())
        .then(data => {
          if (data.users) {
            setInstructorList(data.users.map((u: { id: string; name: string }) => ({
              id: u.id,
              name: u.name,
            })));
          }
        })
        .catch(() => {
          // Fallback - try different endpoint
          fetch('/api/lab-management/instructors')
            .then(r => r.json())
            .then(data => {
              if (data.instructors) {
                setInstructorList(data.instructors.map((u: { id: string; name: string }) => ({
                  id: u.id,
                  name: u.name,
                })));
              }
            })
            .catch(() => { /* instructor list unavailable */ });
        });
    }
  }, [status]);

  // Update URL params
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('view', viewMode);
    params.set('date', toDateStr(currentDate));
    if (presetView !== 'all') params.set('preset', presetView);
    if (activePrograms.size < PROGRAMS.length) {
      params.set('programs', Array.from(activePrograms).join(','));
    }
    if (activeEventTypes.size < EVENT_TYPES.length) {
      params.set('types', Array.from(activeEventTypes).join(','));
    }
    const newUrl = `/calendar?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [viewMode, currentDate, presetView, activePrograms, activeEventTypes]);

  // Filter events client-side for event type filtering
  const filteredEvents = useMemo(() => {
    return events.filter(e => activeEventTypes.has(e.event_type));
  }, [events, activeEventTypes]);

  // Group events by date for list view
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of filteredEvents) {
      const existing = map.get(e.date) || [];
      existing.push(e);
      map.set(e.date, existing);
    }
    return map;
  }, [filteredEvents]);

  // Navigation
  const goToday = () => setCurrentDate(new Date());
  const goPrev = () => {
    if (viewMode === 'week' || viewMode === 'list') {
      setCurrentDate(prev => addDays(prev, -7));
    } else {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }
  };
  const goNext = () => {
    if (viewMode === 'week' || viewMode === 'list') {
      setCurrentDate(prev => addDays(prev, 7));
    } else {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }
  };

  // Toggle helpers
  const toggleProgram = (prog: string) => {
    setActivePrograms(prev => {
      const next = new Set(prev);
      if (next.has(prog)) next.delete(prog);
      else next.add(prog);
      return next;
    });
  };

  const toggleAllPrograms = () => {
    if (activePrograms.size === PROGRAMS.length) {
      setActivePrograms(new Set());
    } else {
      setActivePrograms(new Set(PROGRAMS));
    }
  };

  const toggleEventType = (type: string) => {
    setActiveEventTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  // Print
  const handlePrint = () => window.print();

  // Click event handler
  const handleEventClick = (event: CalendarEvent) => {
    if (event.linked_url) {
      router.push(event.linked_url);
    }
  };

  // ── Week view days ─────────────────────────────────────────────────

  const weekDays = useMemo(() => {
    const monday = getMonday(currentDate);
    return Array.from({ length: 5 }, (_, i) => addDays(monday, i));
  }, [currentDate]);

  // Header title
  const headerTitle = useMemo(() => {
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    const monday = getMonday(currentDate);
    const friday = addDays(monday, 4);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(monday)} - ${fmt(friday)}, ${friday.getFullYear()}`;
  }, [currentDate, viewMode]);

  // Instructor hour total for week
  const weeklyHours = useMemo(() => {
    if (presetView !== 'instructor') return null;
    let total = 0;
    for (const e of filteredEvents) {
      const start = timeToMinutes(e.start_time);
      const end = timeToMinutes(e.end_time);
      if (end > start) total += end - start;
    }
    return (total / 60).toFixed(1);
  }, [filteredEvents, presetView]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6 print:px-0 print:py-0">
      <Breadcrumbs className="mb-2" />

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Master Calendar</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/scheduling/planner"
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
          >
            Edit in Planner <ArrowRight className="h-3 w-3" />
          </Link>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>
      </div>

      {/* ── View toggle & navigation ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
        {/* View mode buttons */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('week')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
              viewMode === 'week'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <Grid3X3 className="h-4 w-4" /> Week
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
              viewMode === 'month'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <LayoutGrid className="h-4 w-4" /> Month
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <List className="h-4 w-4" /> List
          </button>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-sm font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50"
          >
            Today
          </button>
          <button
            onClick={goNext}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <span className="text-lg font-semibold text-gray-900 dark:text-white ml-2">{headerTitle}</span>
        </div>
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4 print:hidden">
        <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />

        {/* All programs toggle */}
        <button
          onClick={toggleAllPrograms}
          className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
            activePrograms.size === PROGRAMS.length
              ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 border-gray-800 dark:border-gray-200'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-gray-400'
          }`}
        >
          All PMI
        </button>

        {/* Program chips */}
        {PROGRAMS.map(prog => (
          <button
            key={prog}
            onClick={() => toggleProgram(prog)}
            className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
              activePrograms.has(prog)
                ? 'text-white border-transparent'
                : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-gray-400'
            }`}
            style={activePrograms.has(prog) ? { backgroundColor: PROGRAM_COLORS[prog] } : undefined}
          >
            {PROGRAM_LABELS[prog]}
          </button>
        ))}

        <span className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />

        {/* Event type chips */}
        {EVENT_TYPES.map(type => (
          <button
            key={type}
            onClick={() => toggleEventType(type)}
            className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
              activeEventTypes.has(type)
                ? 'bg-gray-700 dark:bg-gray-300 text-white dark:text-gray-900 border-gray-700 dark:border-gray-300'
                : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-gray-400'
            }`}
          >
            {EVENT_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {/* ── Preset views ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4 print:hidden">
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">View:</span>
        <button
          onClick={() => { setPresetView('all'); setSelectedInstructor(''); }}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            presetView === 'all'
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          All Programs
        </button>
        <button
          onClick={() => setPresetView('instructor')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            presetView === 'instructor'
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          By Instructor
        </button>
        <button
          onClick={() => {
            setPresetView('labs');
            setActiveEventTypes(new Set(['lab']));
          }}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            presetView === 'labs'
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          Labs Only
        </button>

        {/* Instructor selector */}
        {presetView === 'instructor' && (
          <select
            value={selectedInstructor}
            onChange={e => setSelectedInstructor(e.target.value)}
            className="ml-2 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">Select instructor...</option>
            {instructorList.map(inst => (
              <option key={inst.id} value={inst.id}>{inst.name}</option>
            ))}
          </select>
        )}

        {presetView === 'instructor' && weeklyHours !== null && (
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
            <Clock className="h-3.5 w-3.5 inline mr-1" />
            {weeklyHours} hrs this week
          </span>
        )}
      </div>

      {/* ── Calendar content ──────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : viewMode === 'week' ? (
        <WeekView
          days={weekDays}
          events={filteredEvents}
          onEventClick={handleEventClick}
          onDayClick={(date) => {
            setCurrentDate(date);
            setViewMode('week');
          }}
        />
      ) : viewMode === 'month' ? (
        <MonthView
          currentDate={currentDate}
          events={filteredEvents}
          onDayClick={(date) => {
            setCurrentDate(date);
            setViewMode('week');
          }}
          onEventClick={handleEventClick}
        />
      ) : (
        <ListView
          eventsByDate={eventsByDate}
          onEventClick={handleEventClick}
          presetView={presetView}
        />
      )}

      {filteredEvents.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No events found</p>
          <p className="text-sm mt-1">Try adjusting your filters or date range</p>
        </div>
      )}
    </div>
  );
}

// ── Week View ────────────────────────────────────────────────────────

function WeekView({
  days,
  events,
  onEventClick,
}: {
  days: Date[];
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
  onDayClick: (date: Date) => void;
}) {
  const HOUR_START = 6;
  const HOUR_END = 21;
  const HOUR_HEIGHT = 60; // px per hour
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

  // Group events by day
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const d of days) {
      map.set(toDateStr(d), []);
    }
    for (const e of events) {
      const dayEvents = map.get(e.date);
      if (dayEvents) dayEvents.push(e);
    }
    return map;
  }, [days, events]);

  const today = toDateStr(new Date());

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900 print:border-gray-400">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(5,1fr)] border-b border-gray-200 dark:border-gray-700">
        <div className="p-2 text-xs text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700" />
        {days.map(d => {
          const dateStr = toDateStr(d);
          const isToday = dateStr === today;
          return (
            <div
              key={dateStr}
              className={`p-2 text-center border-r last:border-r-0 border-gray-200 dark:border-gray-700 ${
                isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
            >
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {d.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className={`text-lg font-semibold ${
                isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
              }`}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="relative grid grid-cols-[60px_repeat(5,1fr)]" style={{ height: `${(HOUR_END - HOUR_START) * HOUR_HEIGHT}px` }}>
        {/* Hour labels */}
        <div className="border-r border-gray-200 dark:border-gray-700">
          {hours.map(h => (
            <div
              key={h}
              className="absolute left-0 w-[60px] text-right pr-2 text-xs text-gray-400 dark:text-gray-500 -translate-y-1/2"
              style={{ top: `${(h - HOUR_START) * HOUR_HEIGHT}px` }}
            >
              {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((d, dayIdx) => {
          const dateStr = toDateStr(d);
          const dayEvents = eventsByDay.get(dateStr) || [];
          const isToday = dateStr === today;

          return (
            <div
              key={dateStr}
              className={`relative border-r last:border-r-0 border-gray-200 dark:border-gray-700 ${
                isToday ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
              }`}
            >
              {/* Hour lines */}
              {hours.map(h => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-t border-gray-100 dark:border-gray-800"
                  style={{ top: `${(h - HOUR_START) * HOUR_HEIGHT}px` }}
                />
              ))}

              {/* Events */}
              {dayEvents.map(event => {
                const startMin = timeToMinutes(event.start_time);
                const endMin = timeToMinutes(event.end_time);
                const top = ((startMin / 60) - HOUR_START) * HOUR_HEIGHT;
                const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 20);

                return (
                  <button
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className="absolute left-0.5 right-0.5 rounded-md px-1.5 py-0.5 text-left overflow-hidden cursor-pointer hover:opacity-90 transition-opacity shadow-sm z-10"
                    style={{
                      top: `${top}px`,
                      height: `${height}px`,
                      backgroundColor: event.color + '20',
                      borderLeft: `3px solid ${event.color}`,
                    }}
                    title={`${event.title}\n${formatTime(event.start_time)} - ${formatTime(event.end_time)}${event.room ? `\n${event.room}` : ''}${event.instructor_names?.length ? `\n${event.instructor_names.join(', ')}` : ''}`}
                  >
                    <div className="text-[10px] font-semibold truncate" style={{ color: event.color }}>
                      {event.title}
                    </div>
                    {height > 30 && (
                      <div className="text-[9px] text-gray-600 dark:text-gray-400 truncate">
                        {formatTime(event.start_time)} - {formatTime(event.end_time)}
                      </div>
                    )}
                    {height > 45 && event.room && (
                      <div className="text-[9px] text-gray-500 dark:text-gray-500 truncate">
                        {event.room}
                      </div>
                    )}
                    {height > 55 && event.cohort_number && (
                      <div className="text-[9px] text-gray-500 dark:text-gray-500 truncate">
                        C{event.cohort_number}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Month View ───────────────────────────────────────────────────────

function MonthView({
  currentDate,
  events,
  onDayClick,
  onEventClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onDayClick: (date: Date) => void;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const days = getMonthDays(year, month);
  const today = toDateStr(new Date());

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const existing = map.get(e.date) || [];
      existing.push(e);
      map.set(e.date, existing);
    }
    return map;
  }, [events]);

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
        {weekdays.map(wd => (
          <div key={wd} className="p-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 border-r last:border-r-0 border-gray-200 dark:border-gray-700">
            {wd}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const dateStr = toDateStr(d);
          const isCurrentMonth = d.getMonth() === month;
          const isToday = dateStr === today;
          const dayEvents = eventsByDate.get(dateStr) || [];

          return (
            <button
              key={i}
              onClick={() => onDayClick(d)}
              className={`min-h-[80px] md:min-h-[100px] p-1 border-b border-r border-gray-200 dark:border-gray-700 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                !isCurrentMonth ? 'bg-gray-50 dark:bg-gray-900/50' : ''
              } ${isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
            >
              <div className={`text-xs font-medium mb-0.5 ${
                isToday ? 'text-blue-600 dark:text-blue-400 font-bold' :
                isCurrentMonth ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600'
              }`}>
                {d.getDate()}
              </div>
              {/* Event dots / chips */}
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map(e => (
                  <div
                    key={e.id}
                    className="text-[9px] md:text-[10px] truncate rounded px-1 py-px leading-tight"
                    style={{ backgroundColor: e.color + '25', color: e.color }}
                    onClick={(ev) => { ev.stopPropagation(); onEventClick(e); }}
                  >
                    {e.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[9px] text-gray-500 dark:text-gray-400 px-1">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── List View ────────────────────────────────────────────────────────

function ListView({
  eventsByDate,
  onEventClick,
  presetView,
}: {
  eventsByDate: Map<string, CalendarEvent[]>;
  onEventClick: (e: CalendarEvent) => void;
  presetView: PresetView;
}) {
  const sortedDates = Array.from(eventsByDate.keys()).sort();
  const today = toDateStr(new Date());

  return (
    <div className="space-y-4">
      {sortedDates.map(dateStr => {
        const dayEvents = eventsByDate.get(dateStr) || [];
        if (dayEvents.length === 0) return null;
        const isToday = dateStr === today;

        return (
          <div key={dateStr}>
            <div className={`sticky top-0 z-10 px-3 py-1.5 text-sm font-semibold rounded-md mb-2 ${
              isToday
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}>
              {formatDate(dateStr)}
              {isToday && <span className="ml-2 text-xs font-normal">(Today)</span>}
            </div>

            <div className="space-y-1.5">
              {dayEvents.map(event => (
                <button
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                >
                  {/* Color indicator */}
                  <div
                    className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: event.color }}
                  />

                  {/* Time */}
                  <div className="w-[100px] flex-shrink-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatTime(event.start_time)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTime(event.end_time)}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {event.title}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {event.program && event.program !== 'other' && (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: PROGRAM_COLORS[event.program] + '20', color: PROGRAM_COLORS[event.program] }}
                        >
                          {PROGRAM_LABELS[event.program] || event.program}
                        </span>
                      )}
                      {event.cohort_number && (
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                          C{event.cohort_number}
                        </span>
                      )}
                      {event.room && (
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" /> {event.room}
                        </span>
                      )}
                      {event.instructor_names && event.instructor_names.length > 0 && (
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-0.5">
                          <Users className="h-2.5 w-2.5" /> {event.instructor_names.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Labs Only: extra info */}
                  {presetView === 'labs' && event.source === 'lab_day' && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {event.metadata?.station_count !== undefined && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {String(event.metadata.station_count)} stations
                        </span>
                      )}
                      <Link
                        href={event.linked_url || '#'}
                        onClick={e => e.stopPropagation()}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                      >
                        <Eye className="h-3 w-3" /> View
                      </Link>
                    </div>
                  )}

                  {/* Link arrow */}
                  {event.linked_url && presetView !== 'labs' && (
                    <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-1" />
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Page export with Suspense ────────────────────────────────────────

export default function CalendarPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    }>
      <CalendarContent />
    </Suspense>
  );
}
