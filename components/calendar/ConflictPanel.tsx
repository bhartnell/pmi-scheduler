'use client';

import { useState } from 'react';
import {
  X,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Loader2,
  Search,
  Clock,
  Users,
  MapPin,
  BookOpen,
  Eye,
} from 'lucide-react';
import type { ConflictResult, ConstraintType } from '@/lib/schedule-constraints';

interface ConflictPanelProps {
  open: boolean;
  onClose: () => void;
  dateRange: { start: string; end: string };
  onViewOnCalendar?: (date: string) => void;
}

const CONSTRAINT_OPTIONS: {
  type: ConstraintType;
  label: string;
  description: string;
  icon: typeof Users;
  defaultParams?: Record<string, unknown>;
}[] = [
  {
    type: 'instructor_conflict',
    label: 'Instructor Conflicts',
    description: 'Same instructor in overlapping events',
    icon: Users,
  },
  {
    type: 'room_conflict',
    label: 'Room Conflicts',
    description: 'Same room double-booked',
    icon: MapPin,
  },
  {
    type: 'cohort_conflict',
    label: 'Cohort Conflicts',
    description: 'Same cohort has overlapping events',
    icon: BookOpen,
  },
  {
    type: 'max_hours',
    label: 'Max Weekly Hours',
    description: 'Instructor exceeds hour limit',
    icon: Clock,
    defaultParams: { max_weekly_hours: 40 },
  },
  {
    type: 'required_gap',
    label: 'Required Break',
    description: 'Minimum break between events',
    icon: Clock,
    defaultParams: { min_gap_minutes: 15 },
  },
];

export default function ConflictPanel({
  open,
  onClose,
  dateRange,
  onViewOnCalendar,
}: ConflictPanelProps) {
  const [selectedConstraints, setSelectedConstraints] = useState<Set<ConstraintType>>(
    new Set(['instructor_conflict', 'room_conflict', 'cohort_conflict'])
  );
  const [maxHours, setMaxHours] = useState(40);
  const [minGap, setMinGap] = useState(15);
  const [startDate, setStartDate] = useState(dateRange.start);
  const [endDate, setEndDate] = useState(dateRange.end);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ConflictResult[] | null>(null);
  const [summary, setSummary] = useState<{
    total: number;
    errors: number;
    warnings: number;
  } | null>(null);

  const toggleConstraint = (type: ConstraintType) => {
    setSelectedConstraints((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const runCheck = async () => {
    setLoading(true);
    setResults(null);
    setSummary(null);

    const constraints = Array.from(selectedConstraints).map((type) => {
      const params: Record<string, unknown> = {};
      if (type === 'max_hours') params.max_weekly_hours = maxHours;
      if (type === 'required_gap') params.min_gap_minutes = minGap;
      return { type, params };
    });

    try {
      const res = await fetch('/api/calendar/find-conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          constraints,
        }),
      });

      const data = await res.json();
      if (data.conflicts) {
        setResults(data.conflicts);
        setSummary({
          total: data.total,
          errors: data.errors,
          warnings: data.warnings,
        });
      }
    } catch (err) {
      console.error('Conflict check failed:', err);
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
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Find Conflicts
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
        {/* Date range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Date Range
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

        {/* Constraints */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Checks to Run
          </label>
          <div className="space-y-2">
            {CONSTRAINT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <div key={opt.type}>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedConstraints.has(opt.type)}
                      onChange={() => toggleConstraint(opt.type)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-white">
                        <Icon className="h-3.5 w-3.5 text-gray-500" />
                        {opt.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {opt.description}
                      </div>
                    </div>
                  </label>

                  {/* Inline params */}
                  {opt.type === 'max_hours' && selectedConstraints.has('max_hours') && (
                    <div className="ml-6 mt-1 flex items-center gap-2">
                      <span className="text-xs text-gray-500">Max:</span>
                      <input
                        type="number"
                        value={maxHours}
                        onChange={(e) => setMaxHours(Number(e.target.value))}
                        className="w-16 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                      <span className="text-xs text-gray-500">hrs/week</span>
                    </div>
                  )}
                  {opt.type === 'required_gap' && selectedConstraints.has('required_gap') && (
                    <div className="ml-6 mt-1 flex items-center gap-2">
                      <span className="text-xs text-gray-500">Min:</span>
                      <input
                        type="number"
                        value={minGap}
                        onChange={(e) => setMinGap(Number(e.target.value))}
                        className="w-16 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                      <span className="text-xs text-gray-500">min gap</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={runCheck}
          disabled={loading || selectedConstraints.size === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          {loading ? 'Checking...' : 'Run Check'}
        </button>

        {/* Results */}
        {summary && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
            {summary.errors > 0 ? (
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            ) : summary.warnings > 0 ? (
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
            )}
            <div className="text-sm">
              <span className="font-semibold text-gray-900 dark:text-white">
                {summary.total === 0
                  ? 'No conflicts found!'
                  : `${summary.total} conflict${summary.total !== 1 ? 's' : ''} found`}
              </span>
              {summary.total > 0 && (
                <span className="text-gray-500 dark:text-gray-400 ml-1">
                  ({summary.errors} error{summary.errors !== 1 ? 's' : ''},{' '}
                  {summary.warnings} warning{summary.warnings !== 1 ? 's' : ''})
                </span>
              )}
            </div>
          </div>
        )}

        {results && results.length > 0 && (
          <div className="space-y-2">
            {results.map((conflict, idx) => (
              <ConflictCard
                key={idx}
                conflict={conflict}
                onViewOnCalendar={onViewOnCalendar}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConflictCard({
  conflict,
  onViewOnCalendar,
}: {
  conflict: ConflictResult;
  onViewOnCalendar?: (date: string) => void;
}) {
  const isError = conflict.severity === 'error';

  return (
    <div
      className={`border rounded-lg p-3 ${
        isError
          ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
          : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
      }`}
    >
      <div className="flex items-start gap-2">
        {isError ? (
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {conflict.message}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            <span>
              {new Date(conflict.date + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </span>
            <span>{conflict.time_range}</span>
          </div>
          {conflict.suggestion && (
            <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400 italic">
              Suggestion: {conflict.suggestion}
            </p>
          )}
          {conflict.events.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {conflict.events.map((e) => (
                <span
                  key={e.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: e.color }}
                  />
                  {e.title}
                </span>
              ))}
            </div>
          )}
          {onViewOnCalendar && (
            <button
              onClick={() => onViewOnCalendar(conflict.date)}
              className="mt-2 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Eye className="h-3 w-3" />
              View on Calendar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
