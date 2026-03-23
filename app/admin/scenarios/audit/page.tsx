'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  BarChart3,
  FileText,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Database,
  Activity,
  Heart,
  Shield,
  Search,
  Wand2,
  ClipboardList,
  Sparkles,
  X,
  Baby,
  ArrowRight,
  Bot,
  Eye,
  Play,
  Square,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface FieldStat {
  field: string;
  populated: number;
  empty: number;
  percent: number;
}

interface ScenarioIssue {
  id: string;
  title: string;
  issues: string[];
  category: string | null;
  difficulty: string | null;
  has_phases: boolean;
  phase_count: number;
  has_vitals: boolean;
  has_chief_complaint: boolean;
  created_at: string;
}

interface IssueFrequency {
  issue: string;
  count: number;
  percent: number;
}

interface CompletenessEntry {
  id: string;
  title: string;
  category: string | null;
  missing: string[];
  present: number;
  total: number;
  percent_complete: number;
}

interface CompletenessData {
  fully_complete: number;
  total: number;
  report: CompletenessEntry[];
}

interface AutoFillFieldChange {
  field: string;
  old_value: unknown;
  new_value: unknown;
}

interface AutoFillScenarioChange {
  scenario_id: string;
  title: string;
  category: string | null;
  is_pediatric: boolean;
  changes: AutoFillFieldChange[];
}

interface AutoFillResult {
  total_checked: number;
  total_with_changes: number;
  total_unchanged: number;
  total_applied: number;
  total_errors: number;
  pediatric_scenarios: number;
  changelog: AutoFillScenarioChange[];
  errors: Array<{ scenario_id: string; title: string; error: string }>;
}

// AI content generation types
const AI_GENERABLE_FIELDS = [
  { key: 'phases', label: 'Phases (Clinical Progression)' },
  { key: 'sample_history', label: 'SAMPLE History' },
  { key: 'opqrst', label: 'OPQRST Assessment' },
  { key: 'secondary_survey', label: 'Secondary Survey' },
  { key: 'debrief_points', label: 'Debrief Points' },
  { key: 'learning_objectives', label: 'Learning Objectives' },
] as const;

interface AIGenerateState {
  scenarioId: string;
  scenarioTitle: string;
  selectedFields: Set<string>;
  emptyFields: string[];
}

interface AIGeneratePreview {
  generated: Record<string, unknown>;
  fields_generated: string[];
  skipped_fields: string[];
}

interface BulkGenerateProgress {
  total: number;
  current: number;
  currentTitle: string;
  results: Array<{ id: string; title: string; status: 'success' | 'error' | 'skipped'; message?: string }>;
  running: boolean;
}

interface AuditData {
  total: number;
  active: number;
  inactive: number;
  message?: string;

  field_stats: FieldStat[];
  category_breakdown: Record<string, number>;
  difficulty_breakdown: Record<string, number>;
  program_breakdown: Record<string, number>;

  phases: {
    has_phases: number;
    no_phases: number;
    avg_phase_count: number;
    phases_as_array: number;
    phases_as_other: number;
    phases_with_vitals: number;
    phases_with_expected_actions: number;
    phases_with_presentation_notes: number;
    sample_phase_structures: unknown[];
  };

  critical_actions: {
    has_critical_actions: number;
    as_object_array: number;
    as_string_array: number;
    as_other: number;
    sample_structures: unknown[];
  };

  vitals: {
    has_initial_vitals: number;
    vitals_as_object: number;
    vitals_with_bp: number;
    vitals_with_hr: number;
    vitals_with_full_xabcde: number;
    sample_structures: unknown[];
  };

  issue_frequency: IssueFrequency[];
  problematic_scenarios: number;
  clean_scenarios: number;
  issues: ScenarioIssue[];

  completeness?: CompletenessData;

  raw_samples: unknown[];
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------
function StatCard({ label, value, subValue, color }: { label: string; value: number | string; subValue?: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{label}</div>
      {subValue && <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subValue}</div>}
    </div>
  );
}

function FieldBar({ stat, total }: { stat: FieldStat; total: number }) {
  const pct = stat.percent;
  const barColor = pct === 100 ? 'bg-green-500' : pct >= 75 ? 'bg-blue-500' : pct >= 25 ? 'bg-yellow-500' : 'bg-red-500';
  const textColor = pct === 100 ? 'text-green-600 dark:text-green-400' : pct >= 75 ? 'text-blue-600 dark:text-blue-400' : pct >= 25 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-44 text-sm font-mono text-gray-700 dark:text-gray-300 truncate" title={stat.field}>
        {stat.field}
      </div>
      <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className={`w-20 text-right text-sm font-medium ${textColor}`}>
        {stat.populated}/{total} ({pct}%)
      </div>
    </div>
  );
}

function SeverityBadge({ count }: { count: number }) {
  if (count >= 8) return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">Critical</span>;
  if (count >= 5) return <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">High</span>;
  if (count >= 3) return <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">Medium</span>;
  return <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Low</span>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ScenarioAuditPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState<AuditData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview', 'quality', 'issues']));
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);
  const [expandedCompletenessId, setExpandedCompletenessId] = useState<string | null>(null);
  const [issueFilter, setIssueFilter] = useState('');
  const [qualityFilter, setQualityFilter] = useState<'all' | 'incomplete' | 'complete' | 'pending_review'>('incomplete');

  // Track pending review scenario IDs
  const [pendingReviewIds, setPendingReviewIds] = useState<Set<string>>(new Set());

  // Auto-fill state
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const [autoFillPreview, setAutoFillPreview] = useState<AutoFillResult | null>(null);
  const [autoFillApplying, setAutoFillApplying] = useState(false);
  const [autoFillDone, setAutoFillDone] = useState<AutoFillResult | null>(null);
  const [showAutoFillModal, setShowAutoFillModal] = useState(false);

  // AI generate state
  const [showAIGenerateModal, setShowAIGenerateModal] = useState(false);
  const [aiGenerateState, setAIGenerateState] = useState<AIGenerateState | null>(null);
  const [aiGenerateLoading, setAIGenerateLoading] = useState(false);
  const [aiGeneratePreview, setAIGeneratePreview] = useState<AIGeneratePreview | null>(null);
  const [aiGenerateApplying, setAIGenerateApplying] = useState(false);
  const [aiGenerateError, setAIGenerateError] = useState<string | null>(null);

  // Bulk generate state
  const [showBulkGenerateModal, setShowBulkGenerateModal] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProgress, setBulkProgress] = useState<BulkGenerateProgress | null>(null);
  const [bulkAbortRef] = useState<{ current: boolean }>({ current: false });

  const loadAudit = () => {
    setLoading(true);
    setError(null);
    // Fetch audit data and pending review scenarios in parallel
    Promise.all([
      fetch('/api/admin/scenarios/audit').then(r => r.json()),
      fetch('/api/admin/scenarios/generate-content?pending_review=true').then(r => r.json()).catch(() => ({ ids: [] })),
    ])
      .then(([auditData, pendingData]) => {
        if (auditData.success) {
          setAudit(auditData.audit);
        } else {
          setError(auditData.error || 'Failed to load audit');
        }
        if (pendingData.ids) {
          setPendingReviewIds(new Set(pendingData.ids));
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  const handleAutoFillPreview = async () => {
    setAutoFillLoading(true);
    setAutoFillPreview(null);
    setAutoFillDone(null);
    setShowAutoFillModal(true);
    try {
      const res = await fetch('/api/admin/scenarios/auto-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preview: true }),
      });
      const data = await res.json();
      if (data.success) {
        setAutoFillPreview(data.results);
      } else {
        setError(data.error || 'Failed to preview auto-fill');
        setShowAutoFillModal(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to preview auto-fill');
      setShowAutoFillModal(false);
    } finally {
      setAutoFillLoading(false);
    }
  };

  const handleAutoFillApply = async () => {
    setAutoFillApplying(true);
    try {
      const res = await fetch('/api/admin/scenarios/auto-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preview: false }),
      });
      const data = await res.json();
      if (data.success) {
        setAutoFillDone(data.results);
        setAutoFillPreview(null);
        // Refresh audit data
        loadAudit();
      } else {
        setError(data.error || 'Failed to apply auto-fill');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to apply auto-fill');
    } finally {
      setAutoFillApplying(false);
    }
  };

  // ---------------------------------------------------------------------------
  // AI Content Generation handlers
  // ---------------------------------------------------------------------------
  const openAIGenerateModal = useCallback((scenarioId: string, scenarioTitle: string, missingFields: string[]) => {
    // Determine which AI-generable fields are empty
    const emptyFields = missingFields.filter(f =>
      AI_GENERABLE_FIELDS.some(af => af.key === f)
    );
    setAIGenerateState({
      scenarioId,
      scenarioTitle,
      selectedFields: new Set(emptyFields),
      emptyFields,
    });
    setAIGeneratePreview(null);
    setAIGenerateError(null);
    setAIGenerateLoading(false);
    setAIGenerateApplying(false);
    setShowAIGenerateModal(true);
  }, []);

  const handleAIGeneratePreview = async () => {
    if (!aiGenerateState || aiGenerateState.selectedFields.size === 0) return;
    setAIGenerateLoading(true);
    setAIGeneratePreview(null);
    setAIGenerateError(null);
    try {
      const res = await fetch('/api/admin/scenarios/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario_id: aiGenerateState.scenarioId,
          fields_to_generate: Array.from(aiGenerateState.selectedFields),
          preview: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAIGeneratePreview({
          generated: data.generated,
          fields_generated: data.fields_generated || [],
          skipped_fields: data.skipped_fields || [],
        });
      } else {
        setAIGenerateError(data.error || 'Failed to generate content');
      }
    } catch (err: unknown) {
      setAIGenerateError(err instanceof Error ? err.message : 'Failed to generate content');
    } finally {
      setAIGenerateLoading(false);
    }
  };

  const handleAIGenerateApply = async () => {
    if (!aiGenerateState || aiGenerateState.selectedFields.size === 0) return;
    setAIGenerateApplying(true);
    setAIGenerateError(null);
    try {
      const res = await fetch('/api/admin/scenarios/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario_id: aiGenerateState.scenarioId,
          fields_to_generate: Array.from(aiGenerateState.selectedFields),
          preview: false,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAIGeneratePreview({
          generated: data.generated,
          fields_generated: data.fields_generated || [],
          skipped_fields: data.skipped_fields || [],
        });
        // Refresh audit data
        loadAudit();
      } else {
        setAIGenerateError(data.error || 'Failed to apply generated content');
      }
    } catch (err: unknown) {
      setAIGenerateError(err instanceof Error ? err.message : 'Failed to apply generated content');
    } finally {
      setAIGenerateApplying(false);
    }
  };

  const closeAIGenerateModal = () => {
    setShowAIGenerateModal(false);
    setAIGenerateState(null);
    setAIGeneratePreview(null);
    setAIGenerateError(null);
  };

  // ---------------------------------------------------------------------------
  // Bulk AI Generation handlers
  // ---------------------------------------------------------------------------
  const openBulkGenerateModal = () => {
    if (!audit?.completeness) return;
    // Find scenarios below 75% completeness
    const lowCompleteness = audit.completeness.report.filter(e => e.percent_complete < 75);
    setBulkSelectedIds(new Set(lowCompleteness.map(e => e.id)));
    setBulkProgress(null);
    bulkAbortRef.current = false;
    setShowBulkGenerateModal(true);
  };

  const handleBulkGenerate = async () => {
    if (!audit?.completeness || bulkSelectedIds.size === 0) return;

    const selected = audit.completeness.report.filter(e => bulkSelectedIds.has(e.id));
    const progress: BulkGenerateProgress = {
      total: selected.length,
      current: 0,
      currentTitle: '',
      results: [],
      running: true,
    };
    setBulkProgress({ ...progress });
    bulkAbortRef.current = false;

    for (const entry of selected) {
      if (bulkAbortRef.current) {
        progress.running = false;
        setBulkProgress({ ...progress });
        break;
      }

      progress.current++;
      progress.currentTitle = entry.title;
      setBulkProgress({ ...progress });

      // Determine which fields can be AI-generated
      const aiFields = entry.missing.filter(f =>
        AI_GENERABLE_FIELDS.some(af => af.key === f)
      );

      if (aiFields.length === 0) {
        progress.results.push({ id: entry.id, title: entry.title, status: 'skipped', message: 'No AI-generable fields' });
        setBulkProgress({ ...progress });
        continue;
      }

      try {
        const res = await fetch('/api/admin/scenarios/generate-content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenario_id: entry.id,
            fields_to_generate: aiFields,
            preview: false,
          }),
        });
        const data = await res.json();
        if (data.success) {
          const count = data.fields_generated?.length || 0;
          progress.results.push({ id: entry.id, title: entry.title, status: 'success', message: `Generated ${count} field(s)` });
        } else {
          progress.results.push({ id: entry.id, title: entry.title, status: 'error', message: data.error || 'Unknown error' });
        }
      } catch (err: unknown) {
        progress.results.push({
          id: entry.id,
          title: entry.title,
          status: 'error',
          message: err instanceof Error ? err.message : 'Network error',
        });
      }
      setBulkProgress({ ...progress });

      // Rate limit delay: wait 6.5 seconds between requests
      if (!bulkAbortRef.current && progress.current < selected.length) {
        await new Promise(resolve => setTimeout(resolve, 6500));
      }
    }

    progress.running = false;
    setBulkProgress({ ...progress });
    // Refresh audit data
    loadAudit();
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    if (session) {
      loadAudit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin h-8 w-8 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-indigo-500" />
            Scenario Data Audit
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Comprehensive analysis of scenario data structure and quality
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={openBulkGenerateModal}
            disabled={!audit?.completeness}
            className="flex items-center gap-2 px-4 py-2 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border border-violet-300 dark:border-violet-600 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Bot className="h-4 w-4" />
            Bulk AI Generate
          </button>
          <button
            onClick={handleAutoFillPreview}
            disabled={autoFillLoading || !audit}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-600 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {autoFillLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Fix Incomplete Scenarios
          </button>
          <Link
            href="/admin/scenarios/transform"
            className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-600 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors whitespace-nowrap"
          >
            <Wand2 className="h-4 w-4" />
            Transform Tool
          </Link>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="animate-spin h-10 w-10 text-indigo-500 mx-auto" />
            <p className="mt-3 text-gray-500 dark:text-gray-400">Auditing all scenarios...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 flex items-center gap-3">
          <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <span className="text-red-800 dark:text-red-300">{error}</span>
        </div>
      )}

      {/* Auto-Fill Modal */}
      {showAutoFillModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-emerald-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {autoFillDone ? 'Auto-Fill Complete' : autoFillPreview ? 'Auto-Fill Preview' : 'Analyzing Scenarios...'}
                </h2>
              </div>
              <button
                onClick={() => { setShowAutoFillModal(false); setAutoFillPreview(null); setAutoFillDone(null); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {autoFillLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Loader2 className="animate-spin h-8 w-8 text-emerald-500 mx-auto" />
                    <p className="mt-3 text-gray-500 dark:text-gray-400">Analyzing scenarios for auto-fill...</p>
                  </div>
                </div>
              )}

              {/* Preview Results */}
              {autoFillPreview && (
                <div className="space-y-4">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-gray-900 dark:text-white">{autoFillPreview.total_checked}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Checked</div>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{autoFillPreview.total_with_changes}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Can Auto-Fill</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-gray-500 dark:text-gray-400">{autoFillPreview.total_unchanged}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">No Changes</div>
                    </div>
                    {autoFillPreview.pediatric_scenarios > 0 && (
                      <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-pink-600 dark:text-pink-400 flex items-center justify-center gap-1">
                          <Baby className="h-4 w-4" />
                          {autoFillPreview.pediatric_scenarios}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Pediatric</div>
                      </div>
                    )}
                  </div>

                  {autoFillPreview.total_with_changes === 0 ? (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <span className="text-green-800 dark:text-green-300">All auto-fillable fields are already populated. No changes needed.</span>
                    </div>
                  ) : (
                    <>
                      {/* Change Details */}
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Changes Preview ({autoFillPreview.changelog.filter(c => c.changes.some(ch => ch.field !== '_pediatric_missing_fields')).length} scenarios)
                        </h3>
                        {autoFillPreview.changelog
                          .filter(c => c.changes.some(ch => ch.field !== '_pediatric_missing_fields'))
                          .map((entry) => (
                            <div key={entry.scenario_id} className="bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600 p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {entry.title}
                                </span>
                                {entry.is_pediatric && (
                                  <span className="px-1.5 py-0.5 text-xs rounded bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 flex items-center gap-1">
                                    <Baby className="h-3 w-3" />
                                    Pediatric
                                  </span>
                                )}
                                {entry.category && (
                                  <span className="px-1.5 py-0.5 text-xs rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                                    {entry.category}
                                  </span>
                                )}
                              </div>
                              <div className="space-y-1.5">
                                {entry.changes
                                  .filter(ch => ch.field !== '_pediatric_missing_fields')
                                  .map((change, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs">
                                      <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400 whitespace-nowrap mt-0.5">
                                        {change.field}
                                      </span>
                                      <ArrowRight className="h-3 w-3 text-gray-400 flex-shrink-0 mt-0.5" />
                                      <div className="flex-1 min-w-0">
                                        <span className="text-gray-500 dark:text-gray-400 line-through mr-2">
                                          {change.old_value === null || change.old_value === undefined
                                            ? '(empty)'
                                            : typeof change.old_value === 'string'
                                              ? change.old_value
                                              : JSON.stringify(change.old_value)}
                                        </span>
                                        <span className="text-emerald-700 dark:text-emerald-400">
                                          {typeof change.new_value === 'string'
                                            ? change.new_value
                                            : Array.isArray(change.new_value)
                                              ? (change.new_value as string[]).join(', ')
                                              : JSON.stringify(change.new_value)}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                {/* Pediatric missing fields info */}
                                {entry.changes
                                  .filter(ch => ch.field === '_pediatric_missing_fields')
                                  .map((change, i) => (
                                    <div key={`ped-${i}`} className="flex items-start gap-2 text-xs mt-1 pt-1 border-t dark:border-gray-600">
                                      <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0 mt-0.5" />
                                      <span className="text-amber-700 dark:text-amber-400">
                                        Pediatric fields needing manual attention: {Array.isArray(change.old_value) ? (change.old_value as string[]).join(', ') : String(change.old_value)}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          ))}
                      </div>

                      {/* Pediatric-only entries (info only, no auto-fill changes) */}
                      {autoFillPreview.changelog.filter(c => c.is_pediatric && !c.changes.some(ch => ch.field !== '_pediatric_missing_fields')).length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-pink-700 dark:text-pink-300 flex items-center gap-1">
                            <Baby className="h-4 w-4" />
                            Pediatric Scenarios - Manual Review Needed
                          </h3>
                          {autoFillPreview.changelog
                            .filter(c => c.is_pediatric && !c.changes.some(ch => ch.field !== '_pediatric_missing_fields'))
                            .map((entry) => {
                              const pedChange = entry.changes.find(ch => ch.field === '_pediatric_missing_fields');
                              if (!pedChange) return null;
                              return (
                                <div key={entry.scenario_id} className="bg-pink-50 dark:bg-pink-900/10 rounded-lg border border-pink-200 dark:border-pink-800 p-3">
                                  <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">{entry.title}</div>
                                  <div className="flex flex-wrap gap-1">
                                    {Array.isArray(pedChange.old_value) && (pedChange.old_value as string[]).map((field, i) => (
                                      <span key={i} className="px-1.5 py-0.5 text-xs bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded">
                                        {field}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Apply Results */}
              {autoFillDone && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{autoFillDone.total_applied}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Applied</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-gray-500 dark:text-gray-400">{autoFillDone.total_unchanged}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Unchanged</div>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-red-600 dark:text-red-400">{autoFillDone.total_errors}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Errors</div>
                    </div>
                    {autoFillDone.pediatric_scenarios > 0 && (
                      <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-pink-600 dark:text-pink-400">{autoFillDone.pediatric_scenarios}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Pediatric</div>
                      </div>
                    )}
                  </div>

                  {autoFillDone.total_applied > 0 && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg p-4 flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                      <span className="text-emerald-800 dark:text-emerald-300">
                        Successfully auto-filled {autoFillDone.total_applied} scenario(s). Audit data has been refreshed.
                      </span>
                    </div>
                  )}

                  {autoFillDone.total_errors > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-red-700 dark:text-red-300">Errors</h3>
                      {autoFillDone.errors.map((err, i) => (
                        <div key={i} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 text-sm">
                          <span className="font-medium text-red-800 dark:text-red-300">{err.title}:</span>{' '}
                          <span className="text-red-600 dark:text-red-400">{err.error}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Show what was changed */}
                  {autoFillDone.changelog.filter(c => c.changes.some(ch => ch.field !== '_pediatric_missing_fields')).length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Applied Changes</h3>
                      {autoFillDone.changelog
                        .filter(c => c.changes.some(ch => ch.field !== '_pediatric_missing_fields'))
                        .map((entry) => (
                          <div key={entry.scenario_id} className="bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600 p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                              <span className="text-sm font-medium text-gray-900 dark:text-white">{entry.title}</span>
                              {entry.is_pediatric && (
                                <span className="px-1.5 py-0.5 text-xs rounded bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300">Pediatric</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 ml-5">
                              {entry.changes.filter(ch => ch.field !== '_pediatric_missing_fields').map(ch => ch.field).join(', ')} updated
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t dark:border-gray-700">
              {autoFillPreview && autoFillPreview.total_with_changes > 0 && (
                <button
                  onClick={handleAutoFillApply}
                  disabled={autoFillApplying}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {autoFillApplying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Apply {autoFillPreview.total_with_changes} Change{autoFillPreview.total_with_changes !== 1 ? 's' : ''}
                </button>
              )}
              <button
                onClick={() => { setShowAutoFillModal(false); setAutoFillPreview(null); setAutoFillDone(null); }}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {autoFillDone ? 'Close' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Generate Content Modal */}
      {showAIGenerateModal && aiGenerateState && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Bot className="h-5 w-5 text-violet-500" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    AI Content Generation
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{aiGenerateState.scenarioTitle}</p>
                </div>
              </div>
              <button onClick={closeAIGenerateModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Close dialog">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {aiGenerateError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <span className="text-sm text-red-800 dark:text-red-300">{aiGenerateError}</span>
                </div>
              )}

              {/* Field selection */}
              {!aiGeneratePreview && !aiGenerateApplying && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Select fields to generate:
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {AI_GENERABLE_FIELDS.map(({ key, label }) => {
                      const isEmpty = aiGenerateState.emptyFields.includes(key);
                      const isSelected = aiGenerateState.selectedFields.has(key);
                      return (
                        <label
                          key={key}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-300 dark:border-violet-600'
                              : 'bg-white dark:bg-gray-700/30 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          } ${!isEmpty ? 'opacity-50' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!isEmpty}
                            onChange={() => {
                              if (!isEmpty) return;
                              const next = new Set(aiGenerateState.selectedFields);
                              if (next.has(key)) next.delete(key);
                              else next.add(key);
                              setAIGenerateState({ ...aiGenerateState, selectedFields: next });
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
                            {!isEmpty && (
                              <span className="ml-2 text-xs text-green-600 dark:text-green-400">(already populated)</span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  {aiGenerateState.selectedFields.size === 0 && aiGenerateState.emptyFields.length > 0 && (
                    <p className="text-sm text-amber-600 dark:text-amber-400">Select at least one field to generate.</p>
                  )}
                  {aiGenerateState.emptyFields.length === 0 && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-800 dark:text-green-300">All AI-generable fields are already populated.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Loading */}
              {aiGenerateLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Loader2 className="animate-spin h-8 w-8 text-violet-500 mx-auto" />
                    <p className="mt-3 text-gray-500 dark:text-gray-400">Generating content with AI...</p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">This may take 10-30 seconds</p>
                  </div>
                </div>
              )}

              {/* Preview */}
              {aiGeneratePreview && !aiGenerateApplying && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Eye className="h-4 w-4 text-violet-500" />
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      Generated {aiGeneratePreview.fields_generated.length} field(s)
                    </span>
                    {aiGeneratePreview.skipped_fields.length > 0 && (
                      <span className="text-gray-500 dark:text-gray-400">
                        (skipped {aiGeneratePreview.skipped_fields.length}: already populated)
                      </span>
                    )}
                  </div>

                  {Object.entries(aiGeneratePreview.generated).map(([field, value]) => (
                    <div key={field} className="bg-gray-50 dark:bg-gray-700/30 rounded-lg border dark:border-gray-600 overflow-hidden">
                      <div className="px-4 py-2 bg-violet-50 dark:bg-violet-900/20 border-b dark:border-gray-600">
                        <span className="text-sm font-mono font-semibold text-violet-700 dark:text-violet-300">{field}</span>
                      </div>
                      <pre className="p-4 text-xs text-gray-700 dark:text-gray-300 overflow-x-auto max-h-64 overflow-y-auto">
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t dark:border-gray-700">
              {!aiGeneratePreview && !aiGenerateLoading && aiGenerateState.selectedFields.size > 0 && (
                <button
                  onClick={handleAIGeneratePreview}
                  disabled={aiGenerateLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <Eye className="h-4 w-4" />
                  Preview Generation
                </button>
              )}
              {aiGeneratePreview && !aiGenerateApplying && Object.keys(aiGeneratePreview.generated).length > 0 && (
                <>
                  <button
                    onClick={() => { setAIGeneratePreview(null); setAIGenerateError(null); }}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Re-generate
                  </button>
                  <button
                    onClick={handleAIGenerateApply}
                    disabled={aiGenerateApplying}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {aiGenerateApplying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Apply to Scenario
                  </button>
                </>
              )}
              <button
                onClick={closeAIGenerateModal}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {aiGenerateApplying ? 'Close' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk AI Generate Modal */}
      {showBulkGenerateModal && audit?.completeness && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Bot className="h-5 w-5 text-violet-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Bulk AI Content Generation
                </h2>
              </div>
              <button
                onClick={() => { setShowBulkGenerateModal(false); setBulkProgress(null); bulkAbortRef.current = true; }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Pre-run: scenario selection */}
              {!bulkProgress && (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Select scenarios below 75% completeness to generate missing AI-generable content. Each scenario will be processed sequentially.
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {bulkSelectedIds.size} of {audit.completeness.report.filter(e => e.percent_complete < 75).length} selected
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setBulkSelectedIds(new Set(audit!.completeness!.report.filter(e => e.percent_complete < 75).map(e => e.id)))}
                        className="text-xs text-violet-600 dark:text-violet-400 hover:underline"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => setBulkSelectedIds(new Set())}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 max-h-80 overflow-y-auto">
                    {audit.completeness.report
                      .filter(e => e.percent_complete < 75)
                      .sort((a, b) => a.percent_complete - b.percent_complete)
                      .map(entry => {
                        const aiFieldCount = entry.missing.filter(f => AI_GENERABLE_FIELDS.some(af => af.key === f)).length;
                        return (
                          <label
                            key={entry.id}
                            className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                              bulkSelectedIds.has(entry.id)
                                ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700'
                                : 'bg-white dark:bg-gray-700/30 border-gray-200 dark:border-gray-600'
                            } ${aiFieldCount === 0 ? 'opacity-40' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={bulkSelectedIds.has(entry.id)}
                              disabled={aiFieldCount === 0}
                              onChange={() => {
                                const next = new Set(bulkSelectedIds);
                                if (next.has(entry.id)) next.delete(entry.id);
                                else next.add(entry.id);
                                setBulkSelectedIds(next);
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-gray-900 dark:text-white truncate block">{entry.title}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {entry.percent_complete}% complete | {aiFieldCount} AI-generable field(s) missing
                              </span>
                            </div>
                          </label>
                        );
                      })}
                  </div>

                  {audit.completeness.report.filter(e => e.percent_complete < 75).length === 0 && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="text-green-800 dark:text-green-300">All scenarios are above 75% completeness!</span>
                    </div>
                  )}
                </>
              )}

              {/* Progress */}
              {bulkProgress && (
                <div className="space-y-4">
                  {/* Progress bar */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {bulkProgress.running
                          ? `Processing ${bulkProgress.current} of ${bulkProgress.total}...`
                          : `Complete: ${bulkProgress.results.length} of ${bulkProgress.total} processed`}
                      </span>
                      <span className="text-sm font-mono text-gray-500 dark:text-gray-400">
                        {Math.round((bulkProgress.current / bulkProgress.total) * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500 transition-all duration-500"
                        style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                      />
                    </div>
                    {bulkProgress.running && bulkProgress.currentTitle && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                        Currently: {bulkProgress.currentTitle}
                      </p>
                    )}
                  </div>

                  {/* Results summary */}
                  {bulkProgress.results.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                          {bulkProgress.results.filter(r => r.status === 'success').length}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Generated</div>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-red-600 dark:text-red-400">
                          {bulkProgress.results.filter(r => r.status === 'error').length}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Failed</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                        <div className="text-xl font-bold text-gray-500 dark:text-gray-400">
                          {bulkProgress.results.filter(r => r.status === 'skipped').length}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Skipped</div>
                      </div>
                    </div>
                  )}

                  {/* Result details */}
                  {bulkProgress.results.length > 0 && (
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {bulkProgress.results.map((result, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded text-sm">
                          {result.status === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />}
                          {result.status === 'error' && <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                          {result.status === 'skipped' && <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                          <span className="flex-1 text-gray-800 dark:text-gray-200 truncate">{result.title}</span>
                          <span className={`text-xs ${
                            result.status === 'success' ? 'text-emerald-600 dark:text-emerald-400' :
                            result.status === 'error' ? 'text-red-600 dark:text-red-400' :
                            'text-gray-500 dark:text-gray-400'
                          }`}>
                            {result.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t dark:border-gray-700">
              {!bulkProgress && bulkSelectedIds.size > 0 && (
                <button
                  onClick={handleBulkGenerate}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
                >
                  <Play className="h-4 w-4" />
                  Generate All ({bulkSelectedIds.size})
                </button>
              )}
              {bulkProgress?.running && (
                <button
                  onClick={() => { bulkAbortRef.current = true; }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  <Square className="h-4 w-4" />
                  Stop
                </button>
              )}
              <button
                onClick={() => { setShowBulkGenerateModal(false); setBulkProgress(null); bulkAbortRef.current = true; }}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {bulkProgress && !bulkProgress.running ? 'Close' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {audit && (
        <>
          {/* Overview Stats */}
          <section>
            <button
              onClick={() => toggleSection('overview')}
              className="w-full flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-3"
            >
              {expandedSections.has('overview') ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              <Database className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              Overview
            </button>
            {expandedSections.has('overview') && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard label="Total Scenarios" value={audit.total} color="text-gray-900 dark:text-white" />
                <StatCard label="Active" value={audit.active} color="text-green-600 dark:text-green-400" />
                <StatCard label="Inactive" value={audit.inactive} color="text-gray-500 dark:text-gray-400" />
                <StatCard label="Clean" value={audit.clean_scenarios} subValue="No issues" color="text-green-600 dark:text-green-400" />
                <StatCard label="With Issues" value={audit.problematic_scenarios} color="text-red-600 dark:text-red-400" />
                <StatCard label="Avg Phases" value={audit.phases.avg_phase_count} color="text-blue-600 dark:text-blue-400" />
              </div>
            )}
          </section>

          {/* Data Quality / Completeness */}
          {audit.completeness && (
            <section>
              <button
                onClick={() => toggleSection('quality')}
                className="w-full flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-3"
              >
                {expandedSections.has('quality') ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                <ClipboardList className="h-5 w-5 text-emerald-500" />
                Data Quality ({audit.completeness.fully_complete} of {audit.completeness.total} scenarios fully complete)
              </button>
              {expandedSections.has('quality') && (
                <div className="space-y-4">
                  {/* Summary bar */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Overall Completeness
                      </span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {audit.completeness.fully_complete} / {audit.completeness.total} fully complete
                      </span>
                    </div>
                    <div className="w-full h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${audit.completeness.total > 0 ? Math.round((audit.completeness.fully_complete / audit.completeness.total) * 100) : 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>{audit.completeness.total - audit.completeness.fully_complete} need attention</span>
                      <span>{audit.completeness.total > 0 ? Math.round((audit.completeness.fully_complete / audit.completeness.total) * 100) : 0}%</span>
                    </div>
                  </div>

                  {/* Filter tabs */}
                  <div className="flex gap-2 flex-wrap">
                    {([
                      ['all', 'All'],
                      ['incomplete', 'Incomplete'],
                      ['complete', 'Complete'],
                      ['pending_review', 'Pending Review'],
                    ] as const).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setQualityFilter(key as typeof qualityFilter)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          qualityFilter === key
                            ? key === 'pending_review'
                              ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium'
                              : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {key === 'pending_review' && <Bot className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />}
                        {label}
                        {key === 'incomplete' && (
                          <span className="ml-1 text-xs">({audit.completeness!.total - audit.completeness!.fully_complete})</span>
                        )}
                        {key === 'complete' && (
                          <span className="ml-1 text-xs">({audit.completeness!.fully_complete})</span>
                        )}
                        {key === 'pending_review' && pendingReviewIds.size > 0 && (
                          <span className="ml-1 text-xs">({pendingReviewIds.size})</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Completeness list */}
                  <div className="space-y-2">
                    {audit.completeness.report
                      .filter(entry => {
                        if (qualityFilter === 'incomplete') return entry.missing.length > 0;
                        if (qualityFilter === 'complete') return entry.missing.length === 0;
                        if (qualityFilter === 'pending_review') return pendingReviewIds.has(entry.id);
                        return true;
                      })
                      .map((entry) => {
                        const pctColor = entry.percent_complete === 100
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : entry.percent_complete >= 75
                            ? 'text-blue-600 dark:text-blue-400'
                            : entry.percent_complete >= 50
                              ? 'text-yellow-600 dark:text-yellow-400'
                              : 'text-red-600 dark:text-red-400';

                        const barColor = entry.percent_complete === 100
                          ? 'bg-emerald-500'
                          : entry.percent_complete >= 75
                            ? 'bg-blue-500'
                            : entry.percent_complete >= 50
                              ? 'bg-yellow-500'
                              : 'bg-red-500';

                        return (
                          <div key={entry.id} className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                            <button
                              onClick={() => setExpandedCompletenessId(expandedCompletenessId === entry.id ? null : entry.id)}
                              className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                            >
                              {expandedCompletenessId === entry.id ? (
                                <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {entry.title}
                                  </span>
                                  {entry.missing.length === 0 && (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  <span>{entry.category || 'No category'}</span>
                                  <span>{entry.present}/{entry.total} fields</span>
                                  {entry.missing.length > 0 && (
                                    <span className="text-red-500 dark:text-red-400">{entry.missing.length} missing</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="w-24 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div className={`h-full ${barColor} transition-all`} style={{ width: `${entry.percent_complete}%` }} />
                                </div>
                                <span className={`text-sm font-mono font-medium w-10 text-right ${pctColor}`}>
                                  {entry.percent_complete}%
                                </span>
                              </div>
                              <Link
                                href={`/labs/scenarios/${entry.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex-shrink-0"
                                title="Open in editor"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </button>

                            {expandedCompletenessId === entry.id && entry.missing.length > 0 && (
                              <div className="px-4 pb-3 border-t dark:border-gray-700 pt-2">
                                <div className="flex items-center justify-between mb-1.5">
                                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Missing fields:</p>
                                  {entry.missing.some(f => AI_GENERABLE_FIELDS.some(af => af.key === f)) && (
                                    <button
                                      onClick={() => openAIGenerateModal(entry.id, entry.title, entry.missing)}
                                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
                                    >
                                      <Bot className="h-3.5 w-3.5" />
                                      Generate Content
                                    </button>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {entry.missing.map((field, i) => (
                                    <span key={i} className={`px-2 py-0.5 text-xs rounded-full border ${
                                      AI_GENERABLE_FIELDS.some(af => af.key === field)
                                        ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800'
                                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                                    }`}>
                                      {field}
                                      {AI_GENERABLE_FIELDS.some(af => af.key === field) && (
                                        <Bot className="inline h-3 w-3 ml-1 -mt-0.5 opacity-60" />
                                      )}
                                    </span>
                                  ))}
                                </div>
                                {pendingReviewIds.has(entry.id) && (
                                  <div className="mt-2 flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400">
                                    <Bot className="h-3.5 w-3.5" />
                                    AI-generated content pending review
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Category & Difficulty Breakdown */}
          <section>
            <button
              onClick={() => toggleSection('breakdown')}
              className="w-full flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-3"
            >
              {expandedSections.has('breakdown') ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              <BarChart3 className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              Category & Difficulty Breakdown
            </button>
            {expandedSections.has('breakdown') && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Categories */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Categories</h3>
                  <div className="space-y-2">
                    {Object.entries(audit.category_breakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, count]) => (
                        <div key={cat} className="flex justify-between text-sm">
                          <span className="text-gray-700 dark:text-gray-300">{cat}</span>
                          <span className="font-mono text-gray-500 dark:text-gray-400">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Difficulty */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Difficulty</h3>
                  <div className="space-y-2">
                    {Object.entries(audit.difficulty_breakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([diff, count]) => (
                        <div key={diff} className="flex justify-between text-sm">
                          <span className="text-gray-700 dark:text-gray-300 capitalize">{diff}</span>
                          <span className="font-mono text-gray-500 dark:text-gray-400">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Programs */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Programs</h3>
                  <div className="space-y-2">
                    {Object.entries(audit.program_breakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([prog, count]) => (
                        <div key={prog} className="flex justify-between text-sm">
                          <span className="text-gray-700 dark:text-gray-300">{prog}</span>
                          <span className="font-mono text-gray-500 dark:text-gray-400">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Field Population */}
          <section>
            <button
              onClick={() => toggleSection('fields')}
              className="w-full flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-3"
            >
              {expandedSections.has('fields') ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              <FileText className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              Field Population ({audit.field_stats.filter(f => f.percent === 100).length}/{audit.field_stats.length} fully populated)
            </button>
            {expandedSections.has('fields') && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                <div className="space-y-0.5">
                  {[...audit.field_stats].sort((a, b) => a.percent - b.percent).map(stat => (
                    <FieldBar key={stat.field} stat={stat} total={audit.total} />
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Structure Analysis */}
          <section>
            <button
              onClick={() => toggleSection('structure')}
              className="w-full flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-3"
            >
              {expandedSections.has('structure') ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              <Activity className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              Data Structure Analysis
            </button>
            {expandedSections.has('structure') && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Phases */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-500" />
                    Phases
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Has phases</span>
                      <span className="font-mono text-green-600 dark:text-green-400">{audit.phases.has_phases}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">No phases</span>
                      <span className="font-mono text-red-600 dark:text-red-400">{audit.phases.no_phases}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Avg phase count</span>
                      <span className="font-mono">{audit.phases.avg_phase_count}</span>
                    </div>
                    <hr className="dark:border-gray-700" />
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">With vitals</span>
                      <span className="font-mono">{audit.phases.phases_with_vitals}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">With actions</span>
                      <span className="font-mono">{audit.phases.phases_with_expected_actions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">With notes</span>
                      <span className="font-mono">{audit.phases.phases_with_presentation_notes}</span>
                    </div>
                  </div>
                </div>

                {/* Critical Actions */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-orange-500" />
                    Critical Actions
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Has actions</span>
                      <span className="font-mono">{audit.critical_actions.has_critical_actions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">As {'{id, desc}'} objects</span>
                      <span className="font-mono text-green-600 dark:text-green-400">{audit.critical_actions.as_object_array}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">As plain strings</span>
                      <span className="font-mono text-yellow-600 dark:text-yellow-400">{audit.critical_actions.as_string_array}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Other format</span>
                      <span className="font-mono text-red-600 dark:text-red-400">{audit.critical_actions.as_other}</span>
                    </div>
                  </div>
                </div>

                {/* Vitals */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Heart className="h-4 w-4 text-red-500" />
                    Initial Vitals
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Has vitals</span>
                      <span className="font-mono">{audit.vitals.has_initial_vitals}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">As objects</span>
                      <span className="font-mono">{audit.vitals.vitals_as_object}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Has BP</span>
                      <span className="font-mono">{audit.vitals.vitals_with_bp}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Has HR</span>
                      <span className="font-mono">{audit.vitals.vitals_with_hr}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Full XABCDE format</span>
                      <span className="font-mono">{audit.vitals.vitals_with_full_xabcde}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Issue Frequency */}
          <section>
            <button
              onClick={() => toggleSection('frequency')}
              className="w-full flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-3"
            >
              {expandedSections.has('frequency') ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Issue Frequency
            </button>
            {expandedSections.has('frequency') && audit.issue_frequency.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                      <th className="text-left py-2 px-4 font-medium text-gray-600 dark:text-gray-400">Issue</th>
                      <th className="text-right py-2 px-4 font-medium text-gray-600 dark:text-gray-400">Count</th>
                      <th className="text-right py-2 px-4 font-medium text-gray-600 dark:text-gray-400">% of All</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {audit.issue_frequency.map((iss, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="py-2 px-4 text-gray-800 dark:text-gray-200">{iss.issue}</td>
                        <td className="py-2 px-4 text-right font-mono text-gray-600 dark:text-gray-400">{iss.count}</td>
                        <td className="py-2 px-4 text-right">
                          <span className={`font-mono ${iss.percent >= 75 ? 'text-red-600 dark:text-red-400' : iss.percent >= 50 ? 'text-orange-600 dark:text-orange-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                            {iss.percent}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {expandedSections.has('frequency') && audit.issue_frequency.length === 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-green-800 dark:text-green-300">All scenarios pass audit checks!</span>
              </div>
            )}
          </section>

          {/* Problematic Scenarios */}
          <section>
            <button
              onClick={() => toggleSection('issues')}
              className="w-full flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-3"
            >
              {expandedSections.has('issues') ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              <XCircle className="h-5 w-5 text-red-500" />
              Problematic Scenarios ({audit.problematic_scenarios})
            </button>
            {expandedSections.has('issues') && audit.issues.length > 0 && (
              <div className="space-y-3">
                {/* Filter */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={issueFilter}
                    onChange={(e) => setIssueFilter(e.target.value)}
                    placeholder="Filter scenarios by title or issue..."
                    className="w-full pl-9 pr-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-2">
                  {audit.issues
                    .filter(s => {
                      if (!issueFilter) return true;
                      const q = issueFilter.toLowerCase();
                      return s.title.toLowerCase().includes(q) || s.issues.some(i => i.toLowerCase().includes(q));
                    })
                    .map((s) => (
                      <div key={s.id} className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                        <button
                          onClick={() => setExpandedScenario(expandedScenario === s.id ? null : s.id)}
                          className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                        >
                          {expandedScenario === s.id ? (
                            <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {s.title}
                              </span>
                              <SeverityBadge count={s.issues.length} />
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              <span>{s.category || 'No category'}</span>
                              <span>{s.difficulty || 'No difficulty'}</span>
                              <span>{s.phase_count} phases</span>
                              <span>{s.issues.length} issues</span>
                            </div>
                          </div>
                          <Link
                            href={`/labs/scenarios/${s.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex-shrink-0"
                            title="Open in editor"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </button>

                        {expandedScenario === s.id && (
                          <div className="px-4 pb-3 border-t dark:border-gray-700 pt-2">
                            <div className="space-y-1">
                              {s.issues.map((issue, i) => (
                                <div key={i} className="flex items-start gap-2 text-sm">
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                                  <span className="text-gray-700 dark:text-gray-300">{issue}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2 text-xs text-gray-400 dark:text-gray-500 font-mono">
                              ID: {s.id}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </section>

          {/* Raw Samples */}
          <section>
            <button
              onClick={() => toggleSection('samples')}
              className="w-full flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-3"
            >
              {expandedSections.has('samples') ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              <Database className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              Raw Data Samples ({audit.raw_samples.length})
            </button>
            {expandedSections.has('samples') && (
              <div className="space-y-4">
                {audit.raw_samples.map((sample, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      Sample {i + 1}
                    </h4>
                    <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto bg-gray-50 dark:bg-gray-900 rounded p-3 max-h-96 overflow-y-auto">
                      {JSON.stringify(sample, null, 2)}
                    </pre>
                  </div>
                ))}

                {/* Phase structure samples */}
                {audit.phases.sample_phase_structures.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      Phase Structure Samples
                    </h4>
                    <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto bg-gray-50 dark:bg-gray-900 rounded p-3 max-h-96 overflow-y-auto">
                      {JSON.stringify(audit.phases.sample_phase_structures, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Vitals structure samples */}
                {audit.vitals.sample_structures.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      Vitals Structure Samples
                    </h4>
                    <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto bg-gray-50 dark:bg-gray-900 rounded p-3 max-h-96 overflow-y-auto">
                      {JSON.stringify(audit.vitals.sample_structures, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Critical actions structure samples */}
                {audit.critical_actions.sample_structures.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      Critical Actions Structure Samples
                    </h4>
                    <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto bg-gray-50 dark:bg-gray-900 rounded p-3 max-h-96 overflow-y-auto">
                      {JSON.stringify(audit.critical_actions.sample_structures, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
