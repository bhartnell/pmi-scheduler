'use client';

import { useState, useEffect } from 'react';
import {
  X,
  ArrowRight,
  CheckSquare,
  Square,
  Loader2,
  GitCompare,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiffItem {
  station_number: number;
  status: 'unchanged' | 'modified' | 'added' | 'removed';
  template_station: {
    sort_order: number;
    station_type: string;
    station_name: string | null;
    scenario_id: string | null;
    scenario_title: string | null;
    notes: string | null;
    metadata: Record<string, unknown>;
  } | null;
  lab_station: {
    station_number: number;
    station_type: string;
    custom_title: string | null;
    scenario_id: string | null;
    scenario_title: string | null;
    station_notes: string | null;
    metadata: Record<string, unknown>;
  } | null;
  changes: Array<{
    field: string;
    template_value: unknown;
    lab_value: unknown;
  }>;
}

interface DiffResult {
  has_changes: boolean;
  diff: DiffItem[];
}

interface TemplateDiffModalProps {
  labDayId: string;
  templateId: string;
  templateName: string;
  onClose: () => void;
  onApplied: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stationTypeBadge(type: string): string {
  switch (type) {
    case 'scenario':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'skill_drill':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
    case 'skills':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    case 'custom':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

function stationTypeLabel(type: string): string {
  switch (type) {
    case 'skill_drill':
      return 'Skill Drill';
    case 'scenario':
      return 'Scenario';
    case 'skills':
      return 'Skills';
    case 'custom':
      return 'Custom';
    default:
      return type;
  }
}

function fieldLabel(field: string): string {
  switch (field) {
    case 'station_type':
      return 'Type';
    case 'scenario_id':
      return 'Scenario';
    case 'title':
      return 'Title';
    case 'notes':
      return 'Notes';
    default:
      return field;
  }
}

function displayValue(val: unknown): string {
  if (val === null || val === undefined || val === '') return '(empty)';
  return String(val);
}

function getStationDisplayName(item: DiffItem): string {
  if (item.lab_station?.custom_title) return item.lab_station.custom_title;
  if (item.lab_station?.scenario_title) return item.lab_station.scenario_title;
  if (item.template_station?.station_name) return item.template_station.station_name;
  if (item.template_station?.scenario_title) return item.template_station.scenario_title;
  return `Station ${item.station_number}`;
}

function getStationType(item: DiffItem): string {
  return item.lab_station?.station_type ?? item.template_station?.station_type ?? 'scenario';
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

type StatusConfig = {
  borderClass: string;
  labelText: string;
  labelClass: string;
};

function getStatusConfig(status: DiffItem['status']): StatusConfig {
  switch (status) {
    case 'unchanged':
      return {
        borderClass: 'border-l-4 border-l-green-400 dark:border-l-green-600',
        labelText: 'Unchanged',
        labelClass: 'text-green-700 dark:text-green-400',
      };
    case 'modified':
      return {
        borderClass: 'border-l-4 border-l-amber-400 dark:border-l-amber-500',
        labelText: 'Modified',
        labelClass: 'text-amber-700 dark:text-amber-400',
      };
    case 'added':
      return {
        borderClass: 'border-l-4 border-l-blue-400 dark:border-l-blue-500',
        labelText: 'New in Lab Day',
        labelClass: 'text-blue-700 dark:text-blue-400',
      };
    case 'removed':
      return {
        borderClass: 'border-l-4 border-l-red-400 dark:border-l-red-500',
        labelText: 'Removed from Lab Day',
        labelClass: 'text-red-700 dark:text-red-400',
      };
  }
}

// ---------------------------------------------------------------------------
// StationRow sub-component
// ---------------------------------------------------------------------------

function StationRow({
  item,
  isSelected,
  onToggle,
  isExpanded,
  onToggleExpand,
}: {
  item: DiffItem;
  isSelected: boolean;
  onToggle: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const config = getStatusConfig(item.status);
  const displayName = getStationDisplayName(item);
  const stationType = getStationType(item);
  const isSelectable = item.status !== 'unchanged';

  return (
    <div
      className={`rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden ${config.borderClass}`}
    >
      {/* Row header */}
      <div
        className={`flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 ${
          item.status === 'unchanged' ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750' : ''
        }`}
        onClick={item.status === 'unchanged' ? onToggleExpand : undefined}
      >
        {/* Checkbox for selectable rows */}
        {isSelectable && (
          <button
            type="button"
            onClick={onToggle}
            className="flex-shrink-0 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
            aria-label={isSelected ? 'Deselect station' : 'Select station'}
          >
            {isSelected ? (
              <CheckSquare className="w-5 h-5" />
            ) : (
              <Square className="w-5 h-5 text-gray-400" />
            )}
          </button>
        )}

        {/* Station number */}
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
          {item.station_number}
        </span>

        {/* Station type badge */}
        <span
          className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${stationTypeBadge(
            stationType
          )}`}
        >
          {stationTypeLabel(stationType)}
        </span>

        {/* Name */}
        <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
          {displayName}
        </span>

        {/* Status label */}
        <span className={`flex-shrink-0 text-xs font-medium ${config.labelClass}`}>
          {config.labelText}
        </span>

        {/* Expand toggle for unchanged rows */}
        {item.status === 'unchanged' && (
          <span className="flex-shrink-0 text-xs text-gray-400">
            {isExpanded ? 'collapse' : 'expand'}
          </span>
        )}
      </div>

      {/* Modified: show changed fields */}
      {item.status === 'modified' && item.changes.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {item.changes.map((change) => (
            <div
              key={change.field}
              className="px-4 py-2 bg-gray-50 dark:bg-gray-700/30"
            >
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                {fieldLabel(change.field)}
              </p>
              <div className="flex items-start gap-2 flex-wrap">
                <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 line-through break-all">
                  {displayValue(change.template_value)}
                </span>
                <ArrowRight className="flex-shrink-0 w-4 h-4 text-gray-400 mt-0.5" />
                <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 break-all">
                  {displayValue(change.lab_value)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Added: show lab station details */}
      {item.status === 'added' && item.lab_station && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2 bg-blue-50 dark:bg-blue-900/10">
          <p className="text-xs text-blue-700 dark:text-blue-400">
            This station exists in the lab day but is not in the template.
            {item.lab_station.station_notes && (
              <span className="block mt-0.5 text-gray-600 dark:text-gray-400">
                Notes: {item.lab_station.station_notes}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Removed: show template station details */}
      {item.status === 'removed' && item.template_station && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2 bg-red-50 dark:bg-red-900/10">
          <p className="text-xs text-red-700 dark:text-red-400">
            This station is in the template but is missing from the lab day.
            {item.template_station.notes && (
              <span className="block mt-0.5 text-gray-600 dark:text-gray-400">
                Notes: {item.template_station.notes}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Unchanged: expandable detail */}
      {item.status === 'unchanged' && isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2 bg-gray-50 dark:bg-gray-700/20">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            No differences detected for this station.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TemplateDiffModal({
  labDayId,
  templateId,
  templateName,
  onClose,
  onApplied,
}: TemplateDiffModalProps) {
  const [loading, setLoading] = useState(true);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedChanges, setSelectedChanges] = useState<Set<number>>(new Set());
  const [changeSummary, setChangeSummary] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [expandedUnchanged, setExpandedUnchanged] = useState<Set<number>>(new Set());

  // Fetch diff on mount
  useEffect(() => {
    async function fetchDiff() {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await fetch(
          `/api/admin/lab-templates/compare?lab_day_id=${encodeURIComponent(
            labDayId
          )}&template_id=${encodeURIComponent(templateId)}`
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          setFetchError(data.error ?? 'Failed to load comparison');
          return;
        }
        setDiff(data as DiffResult);
        // Pre-select all changed stations (modified + added + removed)
        const defaultSelected = new Set<number>();
        for (const item of (data as DiffResult).diff) {
          if (item.status !== 'unchanged') {
            defaultSelected.add(item.station_number);
          }
        }
        setSelectedChanges(defaultSelected);
      } catch {
        setFetchError('Network error while loading comparison');
      } finally {
        setLoading(false);
      }
    }

    fetchDiff();
  }, [labDayId, templateId]);

  // Toggle a single station selection
  function toggleStation(stationNumber: number) {
    setSelectedChanges((prev) => {
      const next = new Set(prev);
      if (next.has(stationNumber)) {
        next.delete(stationNumber);
      } else {
        next.add(stationNumber);
      }
      return next;
    });
  }

  // Toggle expand for unchanged stations
  function toggleExpand(stationNumber: number) {
    setExpandedUnchanged((prev) => {
      const next = new Set(prev);
      if (next.has(stationNumber)) {
        next.delete(stationNumber);
      } else {
        next.add(stationNumber);
      }
      return next;
    });
  }

  // Selectables are non-unchanged stations
  const selectableNumbers: number[] =
    diff?.diff
      .filter((d) => d.status !== 'unchanged')
      .map((d) => d.station_number) ?? [];

  function selectAll() {
    setSelectedChanges(new Set(selectableNumbers));
  }

  function deselectAll() {
    setSelectedChanges(new Set());
  }

  // Apply selected changes
  async function handleApply() {
    if (selectedChanges.size === 0) return;
    setApplying(true);
    setApplyError(null);
    try {
      const res = await fetch('/api/admin/lab-templates/update-from-lab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: templateId,
          lab_day_id: labDayId,
          selected_changes: Array.from(selectedChanges),
          change_summary: changeSummary || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setApplyError(data.error ?? 'Failed to update template');
        return;
      }
      onApplied();
    } catch {
      setApplyError('Network error while updating template');
    } finally {
      setApplying(false);
    }
  }

  const selectedCount = selectedChanges.size;
  const hasSelectableChanges = selectableNumbers.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="diff-modal-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <GitCompare className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div className="min-w-0">
              <h2
                id="diff-modal-title"
                className="text-lg font-semibold text-gray-900 dark:text-white"
              >
                Compare Lab Day vs Template
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                Template: {templateName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ml-3"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin mr-2" />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Loading comparison...
              </span>
            </div>
          )}

          {/* Fetch error */}
          {!loading && fetchError && (
            <div className="px-6 py-8 text-center">
              <p className="text-red-600 dark:text-red-400 font-medium">{fetchError}</p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          )}

          {/* No changes */}
          {!loading && diff && !diff.has_changes && (
            <div className="px-6 py-12 text-center">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <GitCompare className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-gray-800 dark:text-gray-200 font-medium">
                No differences found
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                No differences found between this lab day and the source template.
              </p>
              <button
                onClick={onClose}
                className="mt-6 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          )}

          {/* Diff list */}
          {!loading && diff && diff.has_changes && (
            <>
              {/* Summary bar */}
              <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/30 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectableNumbers.length} change{selectableNumbers.length !== 1 ? 's' : ''} found,{' '}
                  {diff.diff.filter((d) => d.status === 'unchanged').length} unchanged
                </p>
                {hasSelectableChanges && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAll}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <button
                      onClick={deselectAll}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Deselect All
                    </button>
                  </div>
                )}
              </div>

              {/* Scrollable station list */}
              <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2 max-h-[60vh]">
                {diff.diff.map((item) => (
                  <StationRow
                    key={item.station_number}
                    item={item}
                    isSelected={selectedChanges.has(item.station_number)}
                    onToggle={() => toggleStation(item.station_number)}
                    isExpanded={expandedUnchanged.has(item.station_number)}
                    onToggleExpand={() => toggleExpand(item.station_number)}
                  />
                ))}
              </div>

              {/* Change summary textarea */}
              <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                <label
                  htmlFor="change-summary"
                  className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
                >
                  Change summary (optional)
                </label>
                <textarea
                  id="change-summary"
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  placeholder="Describe what changed..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer — only shown when diff has changes */}
        {!loading && diff && diff.has_changes && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
            {/* Apply error */}
            {applyError && (
              <p className="text-sm text-red-600 dark:text-red-400 flex-1 mr-4">{applyError}</p>
            )}
            {!applyError && <div className="flex-1" />}

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                disabled={applying}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={selectedCount === 0 || applying}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {applying && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Update Template
                {selectedCount > 0 && ` (${selectedCount} change${selectedCount !== 1 ? 's' : ''})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
