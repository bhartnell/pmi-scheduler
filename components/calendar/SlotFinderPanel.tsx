'use client';

import { useState, useEffect } from 'react';
import {
  X,
  CalendarSearch,
  Loader2,
  Star,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Clock,
  Users,
  MapPin,
  Plus,
} from 'lucide-react';
import type { SlotOption } from '@/lib/schedule-constraints';

interface SlotFinderPanelProps {
  open: boolean;
  onClose: () => void;
  dateRange: { start: string; end: string };
  instructorList: { id: string; name: string }[];
  onAddToCalendar?: (slot: SlotOption) => void;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SCORE_CONFIG = {
  BEST: { icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', label: 'BEST' },
  GOOD: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', label: 'GOOD' },
  POSSIBLE: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', label: 'POSSIBLE' },
  NOT_IDEAL: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', label: 'NOT IDEAL' },
};

export default function SlotFinderPanel({
  open,
  onClose,
  dateRange,
  instructorList,
  onAddToCalendar,
}: SlotFinderPanelProps) {
  const [duration, setDuration] = useState(60);
  const [preferredDays, setPreferredDays] = useState<Set<number>>(
    new Set([1, 2, 3, 4, 5])
  );
  const [instructorId, setInstructorId] = useState('');
  const [instructorName, setInstructorName] = useState('');
  const [room, setRoom] = useState('');
  const [startDate, setStartDate] = useState(dateRange.start);
  const [endDate, setEndDate] = useState(dateRange.end);
  const [checkInstructor, setCheckInstructor] = useState(true);
  const [checkRoom, setCheckRoom] = useState(true);
  const [checkCohort, setCheckCohort] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SlotOption[] | null>(null);
  const [resultSummary, setResultSummary] = useState<{
    total: number;
    best: number;
    good: number;
    possible: number;
  } | null>(null);
  const [rooms, setRooms] = useState<{ id: string; name: string }[]>([]);

  // Fetch rooms
  useEffect(() => {
    fetch('/api/scheduling/planner/rooms')
      .then((r) => r.json())
      .then((data) => {
        if (data.rooms) {
          setRooms(
            data.rooms.map((r: { id: string; name: string }) => ({
              id: r.id,
              name: r.name,
            }))
          );
        }
      })
      .catch(() => { /* rooms unavailable */ });
  }, []);

  // Sync instructor name when id changes
  useEffect(() => {
    if (instructorId) {
      const inst = instructorList.find((i) => i.id === instructorId);
      setInstructorName(inst?.name || '');
    } else {
      setInstructorName('');
    }
  }, [instructorId, instructorList]);

  const toggleDay = (day: number) => {
    setPreferredDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const findSlots = async () => {
    setLoading(true);
    setResults(null);
    setResultSummary(null);

    const constraints = [];
    if (checkInstructor) constraints.push({ type: 'instructor_conflict', params: {} });
    if (checkRoom) constraints.push({ type: 'room_conflict', params: {} });
    if (checkCohort) constraints.push({ type: 'cohort_conflict', params: {} });

    try {
      const res = await fetch('/api/calendar/find-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration_minutes: duration,
          preferred_days: Array.from(preferredDays),
          instructor_id: instructorId || undefined,
          instructor_name: instructorName || undefined,
          room: room || undefined,
          start_date: startDate,
          end_date: endDate,
          constraints,
        }),
      });

      const data = await res.json();
      if (data.slots) {
        setResults(data.slots);
        setResultSummary({
          total: data.total,
          best: data.best,
          good: data.good,
          possible: data.possible,
        });
      }
    } catch (err) {
      console.error('Slot finder failed:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <CalendarSearch className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Find Available Slot
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <Clock className="h-3.5 w-3.5 inline mr-1" />
            Duration
          </label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
            <option value={90}>1.5 hours</option>
            <option value={120}>2 hours</option>
            <option value={180}>3 hours</option>
            <option value={240}>4 hours</option>
            <option value={480}>8 hours (full day)</option>
          </select>
        </div>

        {/* Preferred days */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Preferred Days
          </label>
          <div className="flex gap-1">
            {DAY_LABELS.map((label, idx) => (
              <button
                key={idx}
                onClick={() => toggleDay(idx)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                  preferredDays.has(idx)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Search Range
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <span className="text-gray-500 text-sm">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Instructor */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <Users className="h-3.5 w-3.5 inline mr-1" />
            Instructor (optional)
          </label>
          <select
            value={instructorId}
            onChange={(e) => setInstructorId(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">Any instructor</option>
            {instructorList.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.name}
              </option>
            ))}
          </select>
        </div>

        {/* Room */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <MapPin className="h-3.5 w-3.5 inline mr-1" />
            Room (optional)
          </label>
          <select
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">Any room</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* Constraints to check */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Conflict Checks
          </label>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={checkInstructor}
                onChange={(e) => setCheckInstructor(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Instructor conflicts
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={checkRoom}
                onChange={(e) => setCheckRoom(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Room conflicts
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={checkCohort}
                onChange={(e) => setCheckCohort(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Cohort conflicts
            </label>
          </div>
        </div>

        {/* Find button */}
        <button
          onClick={findSlots}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CalendarSearch className="h-4 w-4" />
          )}
          {loading ? 'Searching...' : 'Find Available Slots'}
        </button>

        {/* Results summary */}
        {resultSummary && (
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm">
            <p className="font-semibold text-gray-900 dark:text-white">
              Found {resultSummary.total} slot{resultSummary.total !== 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
              {resultSummary.best > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 text-yellow-500" />
                  {resultSummary.best} best
                </span>
              )}
              {resultSummary.good > 0 && (
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  {resultSummary.good} good
                </span>
              )}
              {resultSummary.possible > 0 && (
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  {resultSummary.possible} possible
                </span>
              )}
            </div>
          </div>
        )}

        {/* Slot results */}
        {results && results.length > 0 && (
          <div className="space-y-2">
            {results.map((slot, idx) => {
              const config = SCORE_CONFIG[slot.score];
              const Icon = config.icon;
              return (
                <div
                  key={idx}
                  className={`border rounded-lg p-3 ${config.border} ${config.bg}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${config.color}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {slot.label}
                        </p>
                        <p className={`text-xs font-medium ${config.color}`}>
                          {config.label}
                        </p>
                        {slot.conflicts.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {slot.conflicts.map((c, ci) => (
                              <p
                                key={ci}
                                className="text-xs text-gray-500 dark:text-gray-400"
                              >
                                {c.severity === 'error' ? '!!' : '!'} {c.message}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {onAddToCalendar && (
                      <button
                        onClick={() => onAddToCalendar(slot)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 flex-shrink-0"
                      >
                        <Plus className="h-3 w-3" />
                        Add
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {results && results.length === 0 && (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            <CalendarSearch className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No available slots found in the selected range.</p>
            <p className="text-xs mt-1">Try expanding the date range or changing filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
