'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  History,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Eye,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/components/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScenarioVersion {
  id: string;
  version_number: number;
  data: Record<string, unknown>;
  created_by: string | null;
  change_summary: string | null;
  created_at: string;
}

interface Props {
  scenarioId: string;
  /** Current scenario title — shown alongside "v{n} (Current)" */
  currentTitle: string;
  /** User role — only lead_instructor+ can restore */
  userRole: string;
  /** Called after a successful restore so the parent can reload scenario data */
  onRestored?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Friendly label: "admin@pmi.edu" → "admin@pmi.edu" (kept as-is, emails are clear enough) */
function shortEmail(email: string): string {
  return email;
}

function canRestore(role: string): boolean {
  const levels: Record<string, number> = {
    superadmin: 5,
    admin: 4,
    lead_instructor: 3,
    instructor: 2,
    volunteer_instructor: 1,
    student: 1,
    guest: 1,
    pending: 0,
  };
  return (levels[role] ?? 0) >= levels['lead_instructor'];
}

// ─── Compare fields shown in the diff modal ───────────────────────────────────

const COMPARE_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'title', label: 'Title' },
  { key: 'chief_complaint', label: 'Chief Complaint' },
  { key: 'category', label: 'Category' },
  { key: 'subcategory', label: 'Subcategory' },
  { key: 'difficulty', label: 'Difficulty' },
  { key: 'estimated_duration', label: 'Estimated Duration (min)' },
  { key: 'dispatch_location', label: 'Dispatch Location' },
  { key: 'dispatch_notes', label: 'Dispatch Notes' },
  { key: 'patient_name', label: 'Patient Name' },
  { key: 'patient_age', label: 'Patient Age' },
  { key: 'patient_sex', label: 'Patient Sex' },
  { key: 'allergies', label: 'Allergies' },
  { key: 'instructor_notes', label: 'Instructor Notes' },
];

function stringify(val: unknown): string {
  if (val === null || val === undefined || val === '') return '(empty)';
  if (Array.isArray(val)) return val.join(', ') || '(none)';
  if (typeof val === 'object') return JSON.stringify(val, null, 2);
  return String(val);
}

// ─── Compare Modal ────────────────────────────────────────────────────────────

function CompareModal({
  version,
  currentContent,
  onClose,
}: {
  version: ScenarioVersion;
  /** The full current scenario object passed down from the parent */
  currentContent: Record<string, unknown>;
  onClose: () => void;
}) {
  const vContent = version.data ?? {};

  const changedFields = COMPARE_FIELDS.filter(({ key }) => {
    const old = stringify(vContent[key]);
    const cur = stringify(currentContent[key]);
    return old !== cur;
  });

  const unchangedFields = COMPARE_FIELDS.filter(({ key }) => {
    const old = stringify(vContent[key]);
    const cur = stringify(currentContent[key]);
    return old === cur;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Compare v{version.version_number} &rarr; Current
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              v{version.version_number} saved {formatDate(version.created_at)}{version.created_by ? ` by ${shortEmail(version.created_by)}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {changedFields.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p className="font-medium">No field differences detected</p>
              <p className="text-sm mt-1">The content of this version appears identical to the current scenario.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                {changedFields.length} changed field{changedFields.length !== 1 ? 's' : ''}
                {unchangedFields.length > 0 && `, ${unchangedFields.length} unchanged`}
              </p>
              {changedFields.map(({ key, label }) => {
                const oldVal = stringify(vContent[key]);
                const curVal = stringify(currentContent[key]);
                return (
                  <div key={key} className="rounded-lg border dark:border-gray-600 overflow-hidden">
                    <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-600">
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                        {label}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 divide-x dark:divide-gray-600">
                      {/* Old value (version) */}
                      <div className="p-3 bg-red-50 dark:bg-red-900/10">
                        <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">
                          v{version.version_number}
                        </p>
                        <p className="text-sm text-red-800 dark:text-red-300 whitespace-pre-wrap break-words">
                          {oldVal}
                        </p>
                      </div>
                      {/* New value (current) */}
                      <div className="p-3 bg-green-50 dark:bg-green-900/10">
                        <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">
                          Current
                        </p>
                        <p className="text-sm text-green-800 dark:text-green-300 whitespace-pre-wrap break-words">
                          {curVal}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Restore Confirmation Dialog ──────────────────────────────────────────────

function RestoreDialog({
  version,
  onConfirm,
  onCancel,
  restoring,
}: {
  version: ScenarioVersion;
  onConfirm: () => void;
  onCancel: () => void;
  restoring: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                Restore Version {version.version_number}?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                The current scenario will be overwritten with the content from{' '}
                <span className="font-medium">v{version.version_number}</span> saved on{' '}
                {formatDate(version.created_at)}. The current state will be auto-saved
                as a new version first so nothing is permanently lost.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              disabled={restoring}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={restoring}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              {restoring ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              {restoring ? 'Restoring...' : 'Yes, Restore'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ScenarioVersionHistory({
  scenarioId,
  currentTitle,
  userRole,
  onRestored,
}: Props) {
  const toast = useToast();

  const [expanded, setExpanded] = useState(false);
  const [versions, setVersions] = useState<ScenarioVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Compare modal
  const [compareVersion, setCompareVersion] = useState<ScenarioVersion | null>(null);
  const [currentContent, setCurrentContent] = useState<Record<string, unknown>>({});

  // Restore dialog
  const [restoreTarget, setRestoreTarget] = useState<ScenarioVersion | null>(null);
  const [restoring, setRestoring] = useState(false);

  const fetchVersions = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/lab-management/scenarios/${scenarioId}/versions`);
      const data = await res.json();
      if (data.success) {
        setVersions(data.versions);
      } else {
        toast.error('Failed to load version history');
      }
    } catch {
      toast.error('Error loading version history');
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [scenarioId, loaded, toast]);

  // Load versions when panel is first expanded
  useEffect(() => {
    if (expanded && !loaded) {
      fetchVersions();
    }
  }, [expanded, loaded, fetchVersions]);

  // Open compare — also fetch current scenario for field-level diff
  const handleCompare = async (version: ScenarioVersion) => {
    try {
      const res = await fetch(`/api/lab-management/scenarios/${scenarioId}`);
      const data = await res.json();
      if (data.success && data.scenario) {
        setCurrentContent(data.scenario);
      } else {
        setCurrentContent({ title: currentTitle });
      }
    } catch {
      setCurrentContent({ title: currentTitle });
    }
    setCompareVersion(version);
  };

  const handleRestoreConfirm = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      const res = await fetch(`/api/lab-management/scenarios/${scenarioId}/versions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version_id: restoreTarget.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Restored to version ${restoreTarget.version_number}`);
        setRestoreTarget(null);
        // Reload version list
        setLoaded(false);
        setVersions([]);
        onRestored?.();
      } else {
        toast.error(data.error || 'Failed to restore version');
      }
    } catch {
      toast.error('Error restoring version');
    } finally {
      setRestoring(false);
    }
  };

  const allowRestore = canRestore(userRole);

  return (
    <>
      {/* Version History Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        {/* Header / Toggle */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-3 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-900 dark:text-white">Version History</span>
          </div>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {/* Body */}
        {expanded && (
          <div className="border-t dark:border-gray-700 px-4 pb-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="ml-2 text-sm text-gray-500">Loading history...</span>
              </div>
            ) : versions.length === 0 ? (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No versions saved yet.</p>
                <p className="text-xs mt-1">
                  A version snapshot is saved automatically each time this scenario is edited.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {versions.map((ver, idx) => {
                  const isCurrent = idx === 0;
                  return (
                    <div
                      key={ver.id}
                      className={`rounded-lg border p-3 ${
                        isCurrent
                          ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30'
                      }`}
                    >
                      {/* Version header row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-sm font-semibold ${
                                isCurrent
                                  ? 'text-blue-700 dark:text-blue-300'
                                  : 'text-gray-700 dark:text-gray-200'
                              }`}
                            >
                              v{ver.version_number}
                              {isCurrent && (
                                <span className="ml-1.5 text-xs font-normal px-1.5 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded">
                                  Current
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDate(ver.created_at)}
                            </span>
                            {ver.created_by && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                by {shortEmail(ver.created_by)}
                              </span>
                            )}
                          </div>

                          {/* Title from data snapshot */}
                          {'title' in (ver.data || {}) && ver.data?.title ? (
                            <p className="text-sm text-gray-800 dark:text-gray-200 mt-0.5 truncate">
                              {String(ver.data.title)}
                            </p>
                          ) : null}

                          {/* Change summary */}
                          {ver.change_summary && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">
                              &ldquo;{ver.change_summary}&rdquo;
                            </p>
                          )}
                        </div>

                        {/* Actions (not shown on current version) */}
                        {!isCurrent && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => handleCompare(ver)}
                              title="Compare with current"
                              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded hover:bg-gray-100 dark:hover:bg-gray-600"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Compare
                            </button>
                            {allowRestore && (
                              <button
                                onClick={() => setRestoreTarget(ver)}
                                title="Restore this version"
                                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-600 rounded hover:bg-amber-100 dark:hover:bg-amber-900/50"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Restore
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Compare Modal */}
      {compareVersion && (
        <CompareModal
          version={compareVersion}
          currentContent={currentContent}
          onClose={() => setCompareVersion(null)}
        />
      )}

      {/* Restore Confirmation Dialog */}
      {restoreTarget && (
        <RestoreDialog
          version={restoreTarget}
          onConfirm={handleRestoreConfirm}
          onCancel={() => setRestoreTarget(null)}
          restoring={restoring}
        />
      )}
    </>
  );
}
