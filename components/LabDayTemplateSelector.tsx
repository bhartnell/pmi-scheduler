'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  History,
  ChevronDown,
  ChevronUp,
  Copy,
  Star,
  Calendar,
  Layers,
  Filter,
  AlertCircle,
  Stethoscope,
  ClipboardCheck,
  RefreshCw,
  FileText,
  ChevronRight,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TemplateStation {
  station_number: number;
  station_type: 'scenario' | 'skills' | 'skill_drill' | 'documentation' | string;
  scenario_id: string | null;
  scenario_title: string | null;
  scenario_category: string | null;
  skill_name: string | null;
  custom_title: string | null;
  display_name: string;
  drill_ids: string[] | null;
  room: string | null;
  rotation_minutes: number;
  num_rotations: number;
}

export interface TemplateData {
  lab_day_id: string;
  title: string | null;
  date: string;
  week_number: number | null;
  day_number: number | null;
  num_rotations: number;
  rotation_duration: number;
  cohort_id: string;
  cohort_label: string;
  cohort_number: number | null;
  program_abbreviation: string | null;
  program_name: string | null;
  station_count: number;
  stations: TemplateStation[];
  average_rating: number | null;
}

interface LabDayTemplateSelectorProps {
  weekNumber?: number;
  dayNumber?: number;
  excludeCohortId?: string;
  onSelectTemplate: (template: TemplateData) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  // Parse as local date to avoid timezone shifts
  const [year, month, day] = iso.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getStationTypeConfig(type: string): {
  label: string;
  Icon: React.ElementType;
  colorClass: string;
} {
  switch (type) {
    case 'scenario':
      return { label: 'Scenario', Icon: Stethoscope, colorClass: 'text-purple-600 dark:text-purple-400' };
    case 'skills':
      return { label: 'Skills', Icon: ClipboardCheck, colorClass: 'text-green-600 dark:text-green-400' };
    case 'skill_drill':
      return { label: 'Drill', Icon: RefreshCw, colorClass: 'text-orange-600 dark:text-orange-400' };
    case 'documentation':
      return { label: 'Docs', Icon: FileText, colorClass: 'text-blue-600 dark:text-blue-400' };
    default:
      return { label: type, Icon: Layers, colorClass: 'text-gray-600 dark:text-gray-400' };
  }
}

// ─── Star Rating Display ──────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.25 && rating - fullStars < 0.75;
  const nearFull = rating - fullStars >= 0.75;

  return (
    <div className="flex items-center gap-0.5" aria-label={`Rating: ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= fullStars || (n === fullStars + 1 && nearFull);
        const half = n === fullStars + 1 && hasHalf;
        return (
          <Star
            key={n}
            className={`w-3.5 h-3.5 ${
              filled
                ? 'text-yellow-400 fill-yellow-400'
                : half
                ? 'text-yellow-400 fill-yellow-200'
                : 'text-gray-300 dark:text-gray-600'
            }`}
          />
        );
      })}
      <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">{rating.toFixed(1)}</span>
    </div>
  );
}

// ─── Station Preview ──────────────────────────────────────────────────────────

function StationPreviewList({ stations }: { stations: TemplateStation[] }) {
  return (
    <ul className="mt-2 space-y-1">
      {stations.map((station) => {
        const { label, Icon, colorClass } = getStationTypeConfig(station.station_type);
        return (
          <li
            key={station.station_number}
            className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300"
          >
            <span className="flex-shrink-0 w-5 h-5 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-mono text-[10px] font-semibold text-gray-500 dark:text-gray-400">
              {station.station_number}
            </span>
            <Icon className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${colorClass}`} />
            <span className="flex-1 min-w-0 leading-snug">
              <span className="text-gray-400 dark:text-gray-500 mr-1">[{label}]</span>
              <span className="truncate">{station.display_name}</span>
              {station.room && (
                <span className="ml-1 text-gray-400 dark:text-gray-500">· {station.room}</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onSelect,
}: {
  template: TemplateData;
  onSelect: (t: TemplateData) => void;
}) {
  const [stationsExpanded, setStationsExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow">
      {/* Card Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/60">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Cohort label */}
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {template.cohort_label}
            </p>
            {/* Lab day title */}
            {template.title && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                {template.title}
              </p>
            )}
            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5">
              {/* Date */}
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                {formatDate(template.date)}
              </span>
              {/* Week / day */}
              {template.week_number != null && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Wk {template.week_number}
                  {template.day_number != null ? ` · Day ${template.day_number}` : ''}
                </span>
              )}
              {/* Station count badge */}
              <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                <Layers className="w-3 h-3" />
                {template.station_count} station{template.station_count !== 1 ? 's' : ''}
              </span>
              {/* Rating */}
              {template.average_rating != null && (
                <StarRating rating={template.average_rating} />
              )}
            </div>
          </div>

          {/* Use as Template button */}
          <button
            type="button"
            onClick={() => onSelect(template)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            Use Template
          </button>
        </div>
      </div>

      {/* Station Preview Toggle */}
      {template.station_count > 0 && (
        <div className="px-4 py-2">
          <button
            type="button"
            onClick={() => setStationsExpanded(!stationsExpanded)}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            {stationsExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            {stationsExpanded ? 'Hide stations' : 'Preview stations'}
          </button>

          {stationsExpanded && (
            <div className="mt-1 pb-1">
              <StationPreviewList stations={template.stations} />
            </div>
          )}
        </div>
      )}

      {template.station_count === 0 && (
        <div className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500 italic">
          No stations configured
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LabDayTemplateSelector({
  weekNumber,
  dayNumber,
  excludeCohortId,
  onSelectTemplate,
}: LabDayTemplateSelectorProps) {
  const [expanded, setExpanded] = useState(false);
  const [templates, setTemplates] = useState<TemplateData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [cohortFilter, setCohortFilter] = useState<string>('');
  const [semesterStart, setSemesterStart] = useState('');
  const [semesterEnd, setSemesterEnd] = useState('');

  // Derived list of unique cohort labels for the filter dropdown
  const cohortOptions = Array.from(
    new Map(
      templates.map((t) => [t.cohort_id, { id: t.cohort_id, label: t.cohort_label }])
    ).values()
  ).sort((a, b) => a.label.localeCompare(b.label));

  // Filtered templates
  const filteredTemplates = templates.filter((t) => {
    if (cohortFilter && t.cohort_id !== cohortFilter) return false;
    if (semesterStart) {
      const tDate = new Date(t.date + 'T12:00:00');
      const start = new Date(semesterStart + 'T00:00:00');
      if (tDate < start) return false;
    }
    if (semesterEnd) {
      const tDate = new Date(t.date + 'T12:00:00');
      const end = new Date(semesterEnd + 'T23:59:59');
      if (tDate > end) return false;
    }
    return true;
  });

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (weekNumber != null) params.set('week_number', String(weekNumber));
      if (dayNumber != null) params.set('day_number', String(dayNumber));
      if (excludeCohortId) params.set('cohort_id', excludeCohortId);

      const res = await fetch(`/api/lab-management/lab-days/templates?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to load templates');
        return;
      }

      setTemplates(data.templates || []);
    } catch (err) {
      console.error('Error loading lab day templates:', err);
      setError('Could not load templates. Please try again.');
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [weekNumber, dayNumber, excludeCohortId]);

  // Load when panel first expands
  useEffect(() => {
    if (expanded && !loaded) {
      fetchTemplates();
    }
  }, [expanded, loaded, fetchTemplates]);

  const handleSelect = (template: TemplateData) => {
    onSelectTemplate(template);
    // Collapse the panel after selection so the user can proceed
    setExpanded(false);
  };

  const hasFilters = weekNumber != null || dayNumber != null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Panel Header / Toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <div>
            <span className="font-semibold text-gray-900 dark:text-white text-sm">
              Previous Lab Configurations
            </span>
            {hasFilters && (weekNumber != null || dayNumber != null) && (
              <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                {weekNumber != null && `Wk ${weekNumber}`}
                {weekNumber != null && dayNumber != null && ' · '}
                {dayNumber != null && `Day ${dayNumber}`}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loaded && !loading && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {templates.length} found
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Panel Body */}
      {expanded && (
        <div className="border-t dark:border-gray-700">
          {/* Filter Bar */}
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/40 border-b dark:border-gray-700">
            <div className="flex flex-wrap items-end gap-3">
              <Filter className="w-4 h-4 text-gray-400 flex-shrink-0 mt-5" />

              {/* Cohort filter */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Cohort
                </label>
                <select
                  value={cohortFilter}
                  onChange={(e) => setCohortFilter(e.target.value)}
                  className="text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All cohorts</option>
                  {cohortOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date range start */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  From date
                </label>
                <input
                  type="date"
                  value={semesterStart}
                  onChange={(e) => setSemesterStart(e.target.value)}
                  className="text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Date range end */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  To date
                </label>
                <input
                  type="date"
                  value={semesterEnd}
                  onChange={(e) => setSemesterEnd(e.target.value)}
                  className="text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Clear filters */}
              {(cohortFilter || semesterStart || semesterEnd) && (
                <button
                  type="button"
                  onClick={() => {
                    setCohortFilter('');
                    setSemesterStart('');
                    setSemesterEnd('');
                  }}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline pb-1.5"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="px-4 py-4">
            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-10 gap-2">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Loading previous configurations...
                </span>
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && filteredTemplates.length === 0 && loaded && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <History className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  No previous configurations found
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs">
                  {hasFilters
                    ? 'No lab days from other cohorts match the current week/day filters. Try expanding the date range or clearing filters.'
                    : 'No lab days from other cohorts are available yet. They will appear here once more lab days are created.'}
                </p>
              </div>
            )}

            {/* Template Cards */}
            {!loading && !error && filteredTemplates.length > 0 && (
              <>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  {filteredTemplates.length === templates.length
                    ? `${templates.length} configuration${templates.length !== 1 ? 's' : ''} available`
                    : `Showing ${filteredTemplates.length} of ${templates.length} configurations`}
                  {' — '}select a template to pre-fill your station list.
                </p>
                <div className="space-y-3">
                  {filteredTemplates.map((template) => (
                    <TemplateCard
                      key={template.lab_day_id}
                      template={template}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
