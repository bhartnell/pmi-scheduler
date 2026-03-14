'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  X,
  FileText,
  ClipboardCheck,
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Package,
  ChevronDown,
  ChevronUp,
  Loader2,
  Save,
  RotateCcw,
  Info,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Step {
  id: string;
  step_number: number;
  phase: string;
  instruction: string;
  is_critical: boolean;
  detail_notes: string | null;
}

interface CanonicalSkill {
  id: string;
  canonical_name: string;
  skill_category: string;
  programs: string[];
  scope_notes: string;
  paramedic_only: boolean;
}

interface SkillSheet {
  id: string;
  skill_name: string;
  program: string;
  source: string;
  source_priority: number;
  equipment: string[];
  overview: string;
  critical_criteria: string[];
  critical_failures: string[];
  notes: string;
  platinum_skill_type: string | null;
  steps: Step[];
  canonical_skill: CanonicalSkill | null;
  alternate_sheets: { id: string; skill_name: string; source: string }[];
}

type DisplayMode = 'teaching' | 'formative' | 'final';
type StepMark = 'pass' | 'fail' | 'caution' | null;

interface SkillSheetPanelProps {
  sheetId: string;
  onClose: () => void;
  /** Pre-selected student from the grading page */
  studentId?: string;
  studentName?: string;
  /** Lab day ID from the grading page context */
  labDayId?: string;
  /** Station pool ID — when provided, skill sheet result also saves to station_completions */
  stationPoolId?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PHASE_ORDER = ['preparation', 'procedure', 'assessment', 'packaging'];

const PHASE_LABELS: Record<string, string> = {
  preparation: 'Preparation',
  procedure: 'Procedure',
  assessment: 'Assessment',
  packaging: 'Packaging',
};

const SOURCE_BADGE: Record<string, { label: string; classes: string }> = {
  nremt: { label: 'NREMT', classes: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  platinum: { label: 'Platinum', classes: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
  publisher: { label: 'Publisher', classes: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function groupStepsByPhase(steps: Step[]): Record<string, Step[]> {
  const groups: Record<string, Step[]> = {};
  for (const step of steps) {
    const phase = step.phase || 'procedure';
    if (!groups[phase]) groups[phase] = [];
    groups[phase].push(step);
  }
  for (const phase of Object.keys(groups)) {
    groups[phase].sort((a, b) => a.step_number - b.step_number);
  }
  return groups;
}

function getOrderedPhases(groups: Record<string, Step[]>): string[] {
  const ordered: string[] = [];
  for (const phase of PHASE_ORDER) {
    if (groups[phase]) ordered.push(phase);
  }
  for (const phase of Object.keys(groups)) {
    if (!ordered.includes(phase)) ordered.push(phase);
  }
  return ordered;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function SkillSheetPanel({
  sheetId,
  onClose,
  studentId,
  studentName,
  labDayId,
  stationPoolId,
}: SkillSheetPanelProps) {
  const [sheet, setSheet] = useState<SkillSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<DisplayMode>('teaching');
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());

  // Evaluation state
  const [stepMarks, setStepMarks] = useState<Record<number, StepMark>>({});
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<'pass' | 'fail' | 'remediation'>('pass');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ─── Data Fetching ──────────────────────────────────────────────────────

  const fetchSheet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/skill-sheets/${sheetId}`);
      if (!res.ok) throw new Error(`Failed to load skill sheet (${res.status})`);
      const data = await res.json();
      if (data.success && data.sheet) {
        setSheet(data.sheet);
      } else {
        setError(data.error || 'Skill sheet not found');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load skill sheet');
    }
    setLoading(false);
  }, [sheetId]);

  useEffect(() => {
    fetchSheet();
  }, [fetchSheet]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const togglePhase = (phase: string) => {
    setCollapsedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  };

  const setStepMarkDirect = (stepNumber: number, mark: StepMark) => {
    setStepMarks(prev => ({
      ...prev,
      [stepNumber]: prev[stepNumber] === mark ? null : mark,
    }));
  };

  const resetForm = () => {
    setStepMarks({});
    setNotes('');
    setResult('pass');
  };

  const handleSave = async () => {
    if (!studentId) {
      showToast('No student selected on the grading page', 'error');
      return;
    }

    if (mode === 'final' && result !== 'pass' && !notes.trim()) {
      showToast('Remediation plan is required for non-pass results', 'error');
      return;
    }

    const flaggedItems = Object.entries(stepMarks)
      .filter(([, mark]) => mark === 'fail' || mark === 'caution')
      .map(([stepNum, mark]) => ({
        step_number: parseInt(stepNum),
        status: mark,
      }));

    const evaluationType = mode === 'formative' ? 'formative' : 'final_competency';
    const evaluationResult = mode === 'formative' ? 'pass' : result;

    setSaving(true);
    try {
      const res = await fetch(`/api/skill-sheets/${sheetId}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          lab_day_id: labDayId || null,
          evaluation_type: evaluationType,
          result: evaluationResult,
          notes: notes.trim() || null,
          flagged_items: flaggedItems,
          station_id: stationPoolId || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(
          mode === 'formative'
            ? 'Formative evaluation saved'
            : 'Competency evaluation recorded',
          'success'
        );
        setStepMarks({});
        setNotes('');
        setResult('pass');
      } else {
        showToast(data.error || 'Failed to save evaluation', 'error');
      }
    } catch (err) {
      console.error('Failed to save evaluation:', err);
      showToast('Failed to save evaluation', 'error');
    }
    setSaving(false);
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  const stepsByPhase = sheet ? groupStepsByPhase(sheet.steps) : {};
  const orderedPhases = sheet ? getOrderedPhases(stepsByPhase) : [];
  const sourceBadge = sheet ? (SOURCE_BADGE[sheet.source] || SOURCE_BADGE.publisher) : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[60%] md:w-[55%] lg:w-[50%] max-w-3xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col animate-slide-in-right">
        {/* Toast */}
        {toast && (
          <div className={`absolute top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm ${
            toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}>
            {toast.message}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate">
              {loading ? 'Loading...' : sheet?.skill_name || 'Skill Sheet'}
            </h2>
            {sheet && sourceBadge && (
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${sourceBadge.classes}`}>
                  {sourceBadge.label}
                </span>
                {studentName && (mode === 'formative' || mode === 'final') && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Student: <span className="font-medium text-gray-700 dark:text-gray-300">{studentName}</span>
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-3 p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Toggle */}
        {sheet && (
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
            <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
              {([
                { key: 'teaching' as const, label: 'Teaching', icon: FileText },
                { key: 'formative' as const, label: 'Formative', icon: ClipboardCheck },
                { key: 'final' as const, label: 'Final', icon: Shield },
              ]).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                    mode === key
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  } ${key !== 'teaching' ? 'border-l border-gray-300 dark:border-gray-600' : ''}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
            {(mode === 'formative' || mode === 'final') && !studentId && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Select a student on the grading page first
              </p>
            )}
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400 mb-3">{error}</p>
              <button
                onClick={fetchSheet}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                Retry
              </button>
            </div>
          ) : sheet ? (
            <div className="p-4 space-y-4">
              {/* Canonical skill scope notes */}
              {sheet.canonical_skill?.scope_notes && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-800 dark:text-blue-300">{sheet.canonical_skill.scope_notes}</p>
                </div>
              )}

              {/* Critical Failures - shown FIRST in Final mode */}
              {mode === 'final' && sheet.critical_failures?.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
                    <XCircle className="w-4 h-4" />
                    Critical Failure Criteria
                  </h3>
                  <ul className="space-y-1">
                    {sheet.critical_failures.map((cf, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                        {cf}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Overview (teaching) */}
              {mode === 'teaching' && sheet.overview && (
                <p className="text-sm text-gray-700 dark:text-gray-300">{sheet.overview}</p>
              )}

              {/* Equipment (teaching) */}
              {mode === 'teaching' && sheet.equipment?.length > 0 && (
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Equipment
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {sheet.equipment.map((item, i) => (
                      <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs text-gray-700 dark:text-gray-300">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Steps by Phase */}
              <div className="space-y-3">
                {orderedPhases.map(phase => {
                  const phaseSteps = stepsByPhase[phase];
                  const isCollapsed = collapsedPhases.has(phase);
                  const phaseLabel = PHASE_LABELS[phase] || phase.charAt(0).toUpperCase() + phase.slice(1);

                  return (
                    <div key={phase} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <button
                        onClick={() => togglePhase(phase)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                          {phaseLabel}
                          <span className="ml-1.5 text-gray-400 font-normal normal-case tracking-normal">
                            ({phaseSteps.length})
                          </span>
                        </h3>
                        {isCollapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
                      </button>

                      {!isCollapsed && (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                          {phaseSteps.map(step => (
                            <PanelStepRow
                              key={step.id}
                              step={step}
                              mode={mode}
                              mark={stepMarks[step.step_number] || null}
                              onSetMark={(mark) => setStepMarkDirect(step.step_number, mark)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Critical Criteria (teaching) */}
              {mode === 'teaching' && sheet.critical_criteria?.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 p-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    Critical Criteria
                  </h3>
                  <ul className="space-y-1">
                    {sheet.critical_criteria.map((cc, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                        {cc}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Critical Failures (teaching) */}
              {mode === 'teaching' && sheet.critical_failures?.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
                    <XCircle className="w-4 h-4" />
                    Critical Failures
                  </h3>
                  <ul className="space-y-1">
                    {sheet.critical_failures.map((cf, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                        {cf}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Notes (teaching) */}
              {mode === 'teaching' && sheet.notes && (
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-1">
                    <FileText className="w-4 h-4 text-gray-500" />
                    Notes
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{sheet.notes}</p>
                </div>
              )}

              {/* Formative action area */}
              {mode === 'formative' && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Quick Notes</h3>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Observation notes..."
                    rows={2}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <button
                      onClick={resetForm}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !studentId}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save Formative
                    </button>
                  </div>
                </div>
              )}

              {/* Final competency action area */}
              {mode === 'final' && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
                  {/* Result */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Result</label>
                    <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                      {([
                        { key: 'pass' as const, label: 'Pass', color: 'bg-green-600' },
                        { key: 'fail' as const, label: 'Fail', color: 'bg-red-600' },
                        { key: 'remediation' as const, label: 'Remediation', color: 'bg-amber-600' },
                      ]).map(({ key, label, color }) => (
                        <button
                          key={key}
                          onClick={() => setResult(key)}
                          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                            result === key
                              ? `${color} text-white`
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          } ${key !== 'pass' ? 'border-l border-gray-300 dark:border-gray-600' : ''}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {result !== 'pass' ? <>Remediation Plan <span className="text-red-500">*</span></> : 'Notes'}
                    </label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder={result !== 'pass' ? 'Describe the remediation plan...' : 'Notes...'}
                      rows={2}
                      className={`w-full border rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        result !== 'pass' && !notes.trim()
                          ? 'border-red-300 dark:border-red-600'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={resetForm}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !studentId}
                      className={`flex items-center gap-1.5 px-4 py-1.5 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium ${
                        result === 'fail'
                          ? 'bg-red-600 hover:bg-red-700'
                          : result === 'remediation'
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                      Submit Competency
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Slide-in animation */}
      <style jsx global>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.25s ease-out;
        }
      `}</style>
    </>
  );
}

// ─── Step Row for Panel ─────────────────────────────────────────────────────

function PanelStepRow({
  step,
  mode,
  mark,
  onSetMark,
}: {
  step: Step;
  mode: DisplayMode;
  mark: StepMark;
  onSetMark: (mark: StepMark) => void;
}) {
  const isCritical = step.is_critical;
  const [noteExpanded, setNoteExpanded] = useState(false);

  // Teaching mode - read-only
  if (mode === 'teaching') {
    return (
      <div className={`px-3 py-2 ${isCritical ? 'border-l-4 border-red-500' : ''}`}>
        <div className="flex items-start gap-2">
          <span className="text-xs font-mono text-gray-400 mt-0.5 w-5 text-right flex-shrink-0">
            {step.step_number}.
          </span>
          <div className="flex-1">
            <div className="flex items-start gap-1.5">
              <p className="text-xs text-gray-900 dark:text-white">{step.instruction}</p>
              {isCritical && (
                <span className="flex-shrink-0 px-1 py-0.5 rounded text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30">
                  CRITICAL
                </span>
              )}
            </div>
            {step.detail_notes && (
              <>
                <button
                  onClick={() => setNoteExpanded(!noteExpanded)}
                  className="mt-0.5 text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {noteExpanded ? 'Hide notes' : 'Show notes'}
                </button>
                {noteExpanded && (
                  <p className="mt-0.5 text-[10px] italic text-gray-500 dark:text-gray-400">{step.detail_notes}</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Formative / Final mode - interactive
  return (
    <div className={`px-3 py-2 ${isCritical ? (mode === 'final' ? 'bg-red-50 dark:bg-red-900/20' : '') : ''}`}>
      <div className="flex items-start gap-2">
        <span className="text-xs font-mono text-gray-400 mt-0.5 w-5 text-right flex-shrink-0">
          {step.step_number}.
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-1.5">
                <p className="text-xs text-gray-900 dark:text-white">{step.instruction}</p>
                {isCritical && (
                  <span className="flex-shrink-0 px-1 py-0.5 rounded text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30">
                    CRITICAL
                  </span>
                )}
              </div>
            </div>
            {/* Mark buttons */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => onSetMark('pass')}
                className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                  mark === 'pass'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:bg-green-100 dark:hover:bg-green-900/30'
                }`}
                title="Pass"
              >
                <CheckCircle className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onSetMark('fail')}
                className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                  mark === 'fail'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                }`}
                title="Fail"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
              {mode === 'formative' && (
                <button
                  onClick={() => onSetMark('caution')}
                  className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                    mark === 'caution'
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                  }`}
                  title="Caution"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
