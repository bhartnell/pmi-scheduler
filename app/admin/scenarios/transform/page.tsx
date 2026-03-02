'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight,
  Wand2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCcw,
  Eye,
  ArrowLeft,
  Database,
  Shield,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ScenarioNeedingTransform {
  id: string;
  title: string;
  needs_transformation: boolean;
  reasons: string[];
  created_at: string;
}

interface PreviewData {
  total_checked: number;
  needs_transformation: number;
  already_correct: number;
  scenarios: ScenarioNeedingTransform[];
}

interface TransformResultDetail {
  id: string;
  title: string;
  status: 'transformed' | 'already_correct' | 'error';
  changes?: string[];
  error?: string;
}

interface TransformResults {
  success: boolean;
  total_checked: number;
  transformed: number;
  already_correct: number;
  errors: number;
  details: TransformResultDetail[];
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------
function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number | string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 flex items-center gap-4">
      <div className={`p-2 rounded-lg ${color.replace('text-', 'bg-').replace('-600', '-100').replace('-400', '-900/30')}`}>
        {icon}
      </div>
      <div>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        <div className="text-sm text-gray-600 dark:text-gray-400">{label}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TransformResultDetail['status'] }) {
  if (status === 'transformed') return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">Transformed</span>;
  if (status === 'already_correct') return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">Already Correct</span>;
  return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Error</span>;
}

// ---------------------------------------------------------------------------
// Confirmation Modal
// ---------------------------------------------------------------------------
function ConfirmModal({
  count,
  onConfirm,
  onCancel,
}: {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Confirm Transform All</h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to transform <strong className="text-gray-900 dark:text-white">{count} scenario{count !== 1 ? 's' : ''}</strong>?
          This will modify database records. All original data is backed up in the{' '}
          <code className="text-xs bg-gray-100 dark:bg-gray-700 rounded px-1 py-0.5 font-mono">legacy_data</code> column before changes are applied.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            Yes, Transform All
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ScenarioTransformPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [transforming, setTransforming] = useState(false);
  const [results, setResults] = useState<TransformResults | null>(null);
  const [dryRunResults, setDryRunResults] = useState<TransformResults | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const loadPreview = () => {
    setLoading(true);
    setPreviewError(null);
    fetch('/api/admin/scenarios/transform')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.preview) {
          const p = data.preview as PreviewData;
          setPreview(p);
          // Default: select all that need transform
          const needsIds = p.scenarios.filter((s) => s.needs_transformation).map((s) => s.id);
          setSelectedIds(new Set(needsIds));
        } else {
          setPreviewError(data.error || 'Failed to load preview');
        }
      })
      .catch((err) => setPreviewError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (session) {
      loadPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const handleToggleScenario = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!preview) return;
    setSelectedIds(new Set(preview.scenarios.filter(s => s.needs_transformation).map((s) => s.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const runTransform = async (ids: string[], dryRun: boolean) => {
    setTransforming(true);
    setResults(null);
    if (dryRun) setDryRunResults(null);

    try {
      const needsCount = preview?.scenarios.filter(s => s.needs_transformation).length ?? 0;
      const body =
        ids.length === needsCount && !dryRun
          ? { dryRun, transformAll: true }
          : { dryRun, scenarioIds: ids };

      const res = await fetch('/api/admin/scenarios/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      const transformResults: TransformResults = data.results
        ? { success: data.success, ...data.results }
        : { success: false, total_checked: 0, transformed: 0, already_correct: 0, errors: 1, details: [{ id: '', title: 'Request failed', status: 'error' as const, error: data.error || 'Unknown error' }] };

      if (dryRun) {
        setDryRunResults(transformResults);
      } else {
        setResults(transformResults);
        // Refresh preview to show updated counts
        loadPreview();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      const errResult: TransformResults = { success: false, total_checked: 0, transformed: 0, already_correct: 0, errors: 1, details: [{ id: '', title: 'Request failed', status: 'error', error: msg }] };
      if (dryRun) {
        setDryRunResults(errResult);
      } else {
        setResults(errResult);
      }
    } finally {
      setTransforming(false);
    }
  };

  const handleDryRun = () => {
    runTransform(Array.from(selectedIds), true);
  };

  const handleTransformSelected = () => {
    if (selectedIds.size === 0) return;
    runTransform(Array.from(selectedIds), false);
  };

  const handleTransformAll = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmTransformAll = () => {
    setShowConfirmModal(false);
    if (!preview) return;
    runTransform(preview.scenarios.filter(s => s.needs_transformation).map((s) => s.id), false);
  };

  // ---------------------------------------------------------------------------
  // Render: session guard
  // ---------------------------------------------------------------------------
  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin h-8 w-8 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Confirmation modal */}
      {showConfirmModal && preview && (
        <ConfirmModal
          count={preview.needs_transformation}
          onConfirm={handleConfirmTransformAll}
          onCancel={() => setShowConfirmModal(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-1">
            <Link href="/admin" className="hover:text-gray-700 dark:hover:text-gray-200">Admin</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/admin/scenarios/audit" className="hover:text-gray-700 dark:hover:text-gray-200">Scenarios</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-gray-700 dark:text-gray-300">Transform Structure</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Wand2 className="h-6 w-6 text-amber-500" />
            Scenario Structure Transform
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Normalizes scenario data — converts string critical_actions to objects, seeds missing phases, and standardises vitals format.
          </p>
        </div>
      </div>

      {/* Backup notice */}
      <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <Shield className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <strong>Backup guarantee:</strong> All original data is backed up in the{' '}
          <code className="text-xs bg-blue-100 dark:bg-blue-800/40 rounded px-1 py-0.5 font-mono">legacy_data</code> column before any changes are made. No data is permanently lost.
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="animate-spin h-10 w-10 text-amber-500 mx-auto" />
            <p className="mt-3 text-gray-500 dark:text-gray-400">Scanning scenarios...</p>
          </div>
        </div>
      )}

      {/* Preview error */}
      {previewError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 flex items-center gap-3">
          <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <span className="text-red-800 dark:text-red-300">{previewError}</span>
        </div>
      )}

      {preview && !loading && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Total Scenarios"
              value={preview.total_checked}
              color="text-gray-700 dark:text-gray-300"
              icon={<Database className="h-5 w-5 text-gray-500" />}
            />
            <StatCard
              label="Needs Transform"
              value={preview.needs_transformation}
              color="text-amber-600 dark:text-amber-400"
              icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
            />
            <StatCard
              label="Already Correct"
              value={preview.already_correct}
              color="text-green-600 dark:text-green-400"
              icon={<CheckCircle className="h-5 w-5 text-green-500" />}
            />
          </div>

          {/* Scenario list */}
          {preview.scenarios.filter(s => s.needs_transformation).length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              {/* List header */}
              <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    Scenarios Needing Transformation
                  </span>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    {preview.needs_transformation}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <button
                    onClick={handleSelectAll}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Select all
                  </button>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <button
                    onClick={handleDeselectAll}
                    className="text-gray-500 dark:text-gray-400 hover:underline"
                  >
                    Deselect all
                  </button>
                  <span className="text-gray-500 dark:text-gray-400 ml-2">
                    {selectedIds.size} selected
                  </span>
                </div>
              </div>

              {/* Rows */}
              <div className="divide-y dark:divide-gray-700 max-h-[480px] overflow-y-auto">
                {preview.scenarios.filter(s => s.needs_transformation).map((s) => (
                  <label
                    key={s.id}
                    className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedIds.has(s.id)}
                      onChange={() => handleToggleScenario(s.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {s.title}
                        </span>
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {s.reasons.map((reason, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                            {reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-6 flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-800 dark:text-green-300">All scenarios are already in the correct structure.</p>
                <p className="text-sm text-green-700 dark:text-green-400 mt-0.5">No transformation is needed at this time.</p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {preview.needs_transformation > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleDryRun}
                disabled={transforming || selectedIds.size === 0}
                className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {transforming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                Dry Run
              </button>

              <button
                onClick={handleTransformSelected}
                disabled={transforming || selectedIds.size === 0}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {transforming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Transform Selected ({selectedIds.size})
              </button>

              <button
                onClick={handleTransformAll}
                disabled={transforming}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {transforming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Transform All ({preview.needs_transformation})
              </button>
            </div>
          )}

          {/* Refresh button (shown after a successful real transform) */}
          {results && results.success && (
            <button
              onClick={loadPreview}
              className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh Preview
            </button>
          )}
        </>
      )}

      {/* Transforming spinner */}
      {transforming && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center gap-4">
          <Loader2 className="animate-spin h-8 w-8 text-amber-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">Transforming scenarios...</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Please wait, do not close this page.</p>
          </div>
        </div>
      )}

      {/* Dry-run results */}
      {dryRunResults && !transforming && (
        <ResultsPanel results={dryRunResults} isDryRun />
      )}

      {/* Transform results */}
      {results && !transforming && (
        <ResultsPanel results={results} isDryRun={false} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results panel (shared between dry-run and real transform)
// ---------------------------------------------------------------------------
function ResultsPanel({ results, isDryRun }: { results: TransformResults; isDryRun: boolean }) {
  return (
    <div className="space-y-4">
      {/* Heading */}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        {isDryRun ? (
          <>
            <Eye className="h-5 w-5 text-gray-500" />
            Dry Run Results
          </>
        ) : (
          <>
            <Wand2 className="h-5 w-5 text-amber-500" />
            Transform Results
          </>
        )}
      </h2>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
          <div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">{results.transformed}</div>
            <div className="text-sm text-green-600 dark:text-green-500">
              {isDryRun ? 'Would be transformed' : 'Transformed successfully'}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center gap-3">
          <Database className="h-6 w-6 text-gray-400 flex-shrink-0" />
          <div>
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{results.already_correct}</div>
            <div className="text-sm text-gray-500 dark:text-gray-500">Already correct</div>
          </div>
        </div>

        {results.errors > 0 ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 flex items-center gap-3">
            <XCircle className="h-6 w-6 text-red-500 flex-shrink-0" />
            <div>
              <div className="text-2xl font-bold text-red-700 dark:text-red-400">{results.errors}</div>
              <div className="text-sm text-red-600 dark:text-red-500">Errors</div>
            </div>
          </div>
        ) : (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
            <div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">0</div>
              <div className="text-sm text-green-600 dark:text-green-500">Errors</div>
            </div>
          </div>
        )}
      </div>

      {/* Detail list */}
      {results.details.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Detail</h3>
          </div>
          <div className="divide-y dark:divide-gray-700 max-h-[480px] overflow-y-auto">
            {results.details.map((d, i) => (
              <div key={d.id || i} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <StatusBadge status={d.status} />
                  <span className="text-sm font-medium text-gray-900 dark:text-white flex-1 truncate">
                    {d.title || d.id}
                  </span>
                </div>
                {d.changes && d.changes.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 pl-2">
                    {d.changes.map((change, ci) => (
                      <li key={ci} className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                        <ChevronRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
                        {change}
                      </li>
                    ))}
                  </ul>
                )}
                {d.error && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400 pl-2">{d.error}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View in Audit link */}
      {!isDryRun && (
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/admin/scenarios/audit"
            className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
          >
            <Eye className="h-4 w-4" />
            View updated results in Audit
          </Link>
        </div>
      )}
    </div>
  );
}
