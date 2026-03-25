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
  Printer,
  Mail,
  ArrowRight,
  PartyPopper,
  Send,
  Clock,
  Ban,
  Plus,
  Trash2,
  Edit2,
  Eye,
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
type EmailPreference = 'pending' | 'queued' | 'sent' | 'do_not_send';

interface ExistingEvaluation {
  id: string;
  evaluation_type: string;
  result: string;
  notes: string | null;
  step_marks: Record<string, string> | null;
  step_details: any[] | null;
  email_status: string;
  status: string;
  attempt_number: number;
  created_at: string;
  evaluator: { id: string; name: string } | null;
}

interface StudentInfo {
  id: string;
  name: string;
  evaluated?: boolean;
  evaluationId?: string;
  inProgress?: boolean;
}

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
  /** List of all students for auto-advance flow */
  studentQueue?: StudentInfo[];
  /** Callback when evaluation is saved — parent can update its state */
  onEvaluationSaved?: (studentId: string, evaluationId: string, status: 'complete' | 'in_progress') => void;
  /** When true, renders as full-width embedded content instead of slide-out panel */
  embedded?: boolean;
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
  studentQueue,
  onEvaluationSaved,
  embedded = false,
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

  // ===== FORMATIVE NUMBERED COMPLETION =====
  // DO NOT REPLACE with pass/fail/caution icons.
  // Each step gets a single tap target that assigns a sequence number.
  // This has been accidentally reverted 3 times — preserve this code.
  // ==========================================
  const [stepSequence, setStepSequence] = useState<Record<number, number>>({});

  // Post-save state
  const [lastSavedEvalId, setLastSavedEvalId] = useState<string | null>(null);
  const [justSavedStudentName, setJustSavedStudentName] = useState<string | null>(null);
  const [showCompletionScreen, setShowCompletionScreen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [batchEmailProgress, setBatchEmailProgress] = useState<{ sent: number; total: number } | null>(null);

  // Existing evaluation state
  const [existingEvals, setExistingEvals] = useState<ExistingEvaluation[]>([]);
  const [evalViewMode, setEvalViewMode] = useState<'new' | 'existing'>('new');
  const [expandedEvalId, setExpandedEvalId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Check if there are unsaved changes (any step completed, notes typed, etc.)
  const hasUnsavedChanges = Object.keys(stepMarks).some(k => stepMarks[parseInt(k)] !== null) ||
    Object.keys(stepSequence).length > 0 ||
    notes.trim().length > 0;

  // Safe close: confirm if unsaved changes exist
  const handleSafeClose = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Close anyway?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

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
    } catch (err) {
      setError((err as Error).message || 'Failed to load skill sheet');
    }
    setLoading(false);
  }, [sheetId]);

  useEffect(() => {
    fetchSheet();
  }, [fetchSheet]);

  // Fetch existing evaluations when student changes
  const fetchExistingEvals = useCallback(async () => {
    if (!studentId || !sheetId) {
      setExistingEvals([]);
      return;
    }
    try {
      const res = await fetch(`/api/skill-sheets/${sheetId}/evaluations?student_id=${studentId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.evaluations)) {
        setExistingEvals(data.evaluations);
        const completedEvals = data.evaluations.filter((e: ExistingEvaluation) => e.status === 'complete');
        if (completedEvals.length > 0 && (mode === 'formative' || mode === 'final')) {
          setEvalViewMode('existing');
          setExpandedEvalId(completedEvals[0].id);
        } else {
          setEvalViewMode('new');
        }
      }
    } catch {
      // Non-critical
    }
  }, [studentId, sheetId, mode]);

  useEffect(() => {
    fetchExistingEvals();
  }, [fetchExistingEvals]);

  // Track student queue: mark as in_progress when panel opens with a student for a station
  useEffect(() => {
    if (studentId && labDayId && stationPoolId) {
      fetch('/api/lab-management/student-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lab_day_id: labDayId,
          student_id: studentId,
          station_id: stationPoolId,
          status: 'in_progress',
        }),
      }).catch(() => { /* non-blocking */ });
    }
  }, [studentId, labDayId, stationPoolId]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSafeClose();
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

  // Toggle step completion with sequence numbering (formative mode)
  const toggleStepComplete = (stepNumber: number) => {
    setStepSequence(prev => {
      if (prev[stepNumber] !== undefined) {
        // Uncomplete: remove this step and renumber subsequent ones
        const removedSeq = prev[stepNumber];
        const next: Record<number, number> = {};
        for (const [sn, seq] of Object.entries(prev)) {
          const snNum = parseInt(sn);
          if (snNum === stepNumber) continue;
          if (seq > removedSeq) {
            next[snNum] = seq - 1;
          } else {
            next[snNum] = seq;
          }
        }
        return next;
      } else {
        const maxSeq = Object.values(prev).length;
        return { ...prev, [stepNumber]: maxSeq + 1 };
      }
    });
    // Also toggle the pass mark so step_marks saves correctly
    setStepMarks(prev => ({
      ...prev,
      [stepNumber]: prev[stepNumber] === 'pass' ? null : 'pass',
    }));
  };

  const resetForm = () => {
    setStepMarks({});
    setStepSequence({});
    setNotes('');
    setResult('pass');
  };

  const handleSave = async (emailPref: EmailPreference = 'queued', saveStatus: 'complete' | 'in_progress' = 'complete') => {
    if (!studentId) {
      showToast('No student selected on the grading page', 'error');
      return;
    }

    if (saveStatus === 'complete' && mode === 'final' && result !== 'pass' && !notes.trim()) {
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

    // Build step_marks as a serializable object
    const stepMarksToSave: Record<string, string> = {};
    for (const [key, val] of Object.entries(stepMarks)) {
      if (val) stepMarksToSave[key] = val;
    }

    // Build step details with sequence numbers (formative mode)
    const stepDetails = mode === 'formative' && sheet ? sheet.steps.map(s => ({
      step_id: s.id,
      step_number: s.step_number,
      completed: stepSequence[s.step_number] !== undefined,
      sequence_number: stepSequence[s.step_number] ?? null,
      mark: stepMarks[s.step_number] || null,
      is_critical: s.is_critical,
    })) : undefined;

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
          email_status: saveStatus === 'in_progress' ? 'pending' : (mode === 'final' ? 'do_not_send' : (emailPref === 'sent' ? 'queued' : emailPref)),
          step_marks: Object.keys(stepMarksToSave).length > 0 ? stepMarksToSave : null,
          step_details: stepDetails || null,
          status: saveStatus,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const evalId = data.evaluation?.id;
        setLastSavedEvalId(evalId || null);
        setJustSavedStudentName(studentName || null);

        // Notify parent
        if (onEvaluationSaved && studentId && evalId) {
          onEvaluationSaved(studentId, evalId, saveStatus);
        }

        // Update student queue (fire-and-forget, non-blocking)
        // For formative mode, calculate pass/fail from actual step completion
        if (labDayId && studentId && stationPoolId) {
          let queueResult: string | undefined = undefined;
          if (saveStatus === 'complete') {
            if (mode === 'formative') {
              // Calculate from step data: pass only if all critical steps done AND >=70% total
              const totalSteps = sheet?.steps?.length || 0;
              const completedCount = Object.keys(stepSequence).length;
              const criticalSteps = (sheet?.steps || []).filter((s: { is_critical?: boolean }) => s.is_critical);
              const criticalDone = criticalSteps.filter((s: { step_number: number }) => stepSequence[s.step_number] !== undefined).length;
              const allCriticalDone = criticalSteps.length === 0 || criticalDone === criticalSteps.length;
              const meetsThreshold = totalSteps === 0 || (completedCount / totalSteps) >= 0.7;
              queueResult = (allCriticalDone && meetsThreshold) ? 'pass' : 'fail';
            } else {
              queueResult = evaluationResult === 'pass' ? 'pass' : 'fail';
            }
          }
          fetch('/api/lab-management/student-queue', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lab_day_id: labDayId,
              student_id: studentId,
              station_id: stationPoolId,
              status: saveStatus === 'complete' ? 'completed' : 'in_progress',
              result: queueResult || null,
              evaluation_id: evalId || null,
            }),
          }).catch(() => { /* non-blocking */ });
        }

        // Show toast
        showToast(
          saveStatus === 'in_progress'
            ? `Progress saved — ${studentName || 'Student'}`
            : `Saved — ${studentName || 'Student'}, ${sheet?.skill_name || 'Skill'}`,
          'success'
        );

        // If Send Now, fire the email immediately
        if (saveStatus === 'complete' && emailPref === 'sent' && evalId) {
          setSendingEmail(true);
          try {
            const emailRes = await fetch('/api/skill-sheets/evaluations/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ evaluation_id: evalId }),
            });
            const emailData = await emailRes.json();
            if (!emailData.success) {
              console.error('Email send failed:', emailData.error);
              // Friendly message for missing email
              if (emailData.no_email) {
                showToast(emailData.error || 'Email not on file for this student', 'error');
              } else {
                showToast(`Email failed: ${emailData.error || 'Unknown error'}`, 'error');
              }
            } else {
              showToast(`Email sent to ${studentName || 'student'}`, 'success');
            }
          } catch (emailErr) {
            console.error('Email send error:', emailErr);
            showToast('Email failed: Network error', 'error');
          }
          setSendingEmail(false);
        }

        // Only reset and advance for complete saves
        if (saveStatus === 'complete') {
          resetForm();
        }

        // Check if all students done (only for complete saves)
        if (saveStatus === 'complete' && studentQueue) {
          const updatedQueue = studentQueue.map(s =>
            s.id === studentId ? { ...s, evaluated: true, evaluationId: evalId } : s
          );
          const allDone = updatedQueue.every(s => s.evaluated);
          if (allDone) {
            setShowCompletionScreen(true);
          }
        }
      } else {
        showToast(data.error || 'Failed to save evaluation', 'error');
      }
    } catch (err) {
      console.error('Failed to save evaluation:', err);
      showToast('Failed to save evaluation', 'error');
    }
    setSaving(false);
  };

  const handlePrint = (evaluationId?: string) => {
    if (evaluationId) {
      window.open(`/api/skill-sheets/evaluations/print?evaluation_id=${evaluationId}`, '_blank');
    } else if (labDayId) {
      window.open(`/api/skill-sheets/evaluations/batch-print?lab_day_id=${labDayId}`, '_blank');
    }
  };

  const handleBatchEmail = async () => {
    if (!labDayId) return;
    setBatchEmailProgress({ sent: 0, total: 0 });
    try {
      const res = await fetch('/api/skill-sheets/evaluations/send-batch-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lab_day_id: labDayId }),
      });
      const data = await res.json();
      if (data.success) {
        setBatchEmailProgress({ sent: data.sent, total: data.sent + data.skipped + data.errors });
        showToast(
          `${data.sent} email${data.sent !== 1 ? 's' : ''} sent${data.doNotSendCount ? `, ${data.doNotSendCount} excluded` : ''}`,
          'success'
        );
      } else {
        showToast(data.error || 'Failed to send emails', 'error');
        setBatchEmailProgress(null);
      }
    } catch {
      showToast('Failed to send batch emails', 'error');
      setBatchEmailProgress(null);
    }
  };

  const handleDeleteEval = async (evalId: string) => {
    try {
      const res = await fetch(`/api/skill-sheets/${sheetId}/evaluations?evaluation_id=${evalId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        showToast('Evaluation deleted', 'success');
        setConfirmDeleteId(null);
        setExistingEvals(prev => prev.filter(e => e.id !== evalId));
        const remaining = existingEvals.filter(e => e.id !== evalId);
        if (remaining.filter(e => e.status === 'complete').length === 0) {
          setEvalViewMode('new');
        }
        if (onEvaluationSaved && studentId) {
          onEvaluationSaved(studentId, '', 'complete');
        }
      } else {
        showToast(data.error || 'Failed to delete', 'error');
      }
    } catch {
      showToast('Failed to delete evaluation', 'error');
    }
  };

  const handleEditEval = (evalItem: ExistingEvaluation) => {
    if (evalItem.step_marks) {
      const marks: Record<number, StepMark> = {};
      for (const [key, val] of Object.entries(evalItem.step_marks)) {
        marks[parseInt(key)] = val as StepMark;
      }
      setStepMarks(marks);
    }
    if (evalItem.step_details && Array.isArray(evalItem.step_details)) {
      const seq: Record<number, number> = {};
      for (const detail of evalItem.step_details) {
        if (detail.completed && detail.sequence_number != null) {
          seq[detail.step_number] = detail.sequence_number;
        }
      }
      setStepSequence(seq);
    }
    setNotes(evalItem.notes || '');
    setResult(evalItem.result as 'pass' | 'fail' | 'remediation');
    setMode(evalItem.evaluation_type === 'formative' ? 'formative' : 'final');
    setEvalViewMode('new');
  };

  const handleNewAttempt = () => {
    resetForm();
    setMode('formative');
    setEvalViewMode('new');
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  const stepsByPhase = sheet ? groupStepsByPhase(sheet.steps) : {};
  const orderedPhases = sheet ? getOrderedPhases(stepsByPhase) : [];
  const sourceBadge = sheet ? (SOURCE_BADGE[sheet.source] || SOURCE_BADGE.publisher) : null;

  // Completion screen
  if (showCompletionScreen) {
    const completedCount = studentQueue?.filter(s => s.evaluated).length || 0;
    const totalCount = studentQueue?.length || 0;

    return (
      <>
        <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[60%] md:w-[55%] lg:w-[50%] max-w-3xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col animate-slide-in-right">
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <PartyPopper className="w-16 h-16 text-green-500 mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              All students evaluated for this station!
            </h2>
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-6">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">{completedCount}/{totalCount} students completed</span>
            </div>

            <div className="w-full max-w-sm space-y-3">
              <button
                onClick={() => handlePrint()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                <Printer className="w-5 h-5" />
                Print All Score Sheets
              </button>

              <button
                onClick={handleBatchEmail}
                disabled={batchEmailProgress !== null}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
              >
                <Mail className="w-5 h-5" />
                {batchEmailProgress
                  ? `${batchEmailProgress.sent} emails sent`
                  : 'Email Results to Students'}
              </button>

              <button
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
              >
                Back to Lab Day
              </button>
            </div>
          </div>
        </div>
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

  // ─── Shared inner content ─────────────────────────────────────────────────
  const panelInner = (
    <>
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
              {studentName && (
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
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </>
  );

  // ─── Embedded mode ────────────────────────────────────────────────────────
  if (embedded) {
    // Completion screen for embedded mode
    if (showCompletionScreen) {
      const completedCount = studentQueue?.filter(s => s.evaluated).length || 0;
      const totalCount = studentQueue?.length || 0;
      return (
        <div className="flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-lg">
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <PartyPopper className="w-16 h-16 text-green-500 mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              All students evaluated!
            </h2>
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-6">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">{completedCount}/{totalCount} students completed</span>
            </div>
            <div className="w-full max-w-sm space-y-3">
              <button
                onClick={() => handlePrint()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                <Printer className="w-5 h-5" />
                Print All Score Sheets
              </button>
              <button
                onClick={handleBatchEmail}
                disabled={batchEmailProgress !== null}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
              >
                <Mail className="w-5 h-5" />
                {batchEmailProgress
                  ? `${batchEmailProgress.sent} emails sent`
                  : 'Email All Results'}
              </button>
              <button
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
              >
                Back to Lab Day
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-lg">
        {panelInner}

        {/* Student queue progress */}
        {studentQueue && studentQueue.length > 1 && (mode === 'formative' || mode === 'final') && (
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {studentQueue.filter(s => s.evaluated).length}/{studentQueue.length} students evaluated
              </span>
              <div className="flex gap-1">
                {studentQueue.map((s) => (
                  <div
                    key={s.id}
                    className={`w-2.5 h-2.5 rounded-full ${
                      s.evaluated
                        ? 'bg-green-500'
                        : s.inProgress
                        ? 'bg-amber-500'
                        : s.id === studentId
                        ? 'bg-blue-500'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                    title={`${s.name}${s.evaluated ? ' ✓' : s.inProgress ? ' ⏳' : ''}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Mode Toggle */}
        {sheet && (
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
            <div className="flex items-center justify-between">
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
              {mode === 'formative' && sheet.steps.length > 0 && (
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {Object.keys(stepSequence).length}/{sheet.steps.length} completed
                </span>
              )}
            </div>
            {(mode === 'formative' || mode === 'final') && !studentId && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Select a student first
              </p>
            )}
          </div>
        )}

        {/* Content — embedded mode: no scroll container, flows with page */}
        <div className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400 mb-3">{error}</p>
              <button onClick={fetchSheet} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Retry</button>
            </div>
          ) : sheet ? (
            <div className="p-4 space-y-4 pb-24">
              {/* Existing evaluation summary */}
              {evalViewMode === 'existing' && existingEvals.length > 0 && (mode === 'formative' || mode === 'final') && sheet && (
                <ExistingEvalSummary
                  evaluations={existingEvals}
                  expandedId={expandedEvalId}
                  onToggleExpand={(id) => setExpandedEvalId(expandedEvalId === id ? null : id)}
                  onEdit={handleEditEval}
                  onNewAttempt={handleNewAttempt}
                  onDelete={(id) => setConfirmDeleteId(id)}
                  confirmDeleteId={confirmDeleteId}
                  onConfirmDelete={handleDeleteEval}
                  onCancelDelete={() => setConfirmDeleteId(null)}
                  sheet={sheet}
                />
              )}

              {(evalViewMode === 'new' || mode === 'teaching') && (<>
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
                              sequenceNumber={stepSequence[step.step_number] ?? null}
                              onToggleComplete={() => toggleStepComplete(step.step_number)}
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
                  </div>

                  {/* Formative Save Options — four buttons */}
                  <div className="mt-3 space-y-2">
                    <button
                      onClick={() => handleSave('pending', 'in_progress')}
                      disabled={saving || !studentId}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      Finish Later
                    </button>
                    <button
                      onClick={() => handleSave('queued')}
                      disabled={saving || !studentId}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                      Save — Send Later
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleSave('sent')}
                        disabled={saving || sendingEmail || !studentId}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                      >
                        {sendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Save — Send Now
                      </button>
                      <button
                        onClick={() => handleSave('do_not_send')}
                        disabled={saving || !studentId}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        Do Not Send
                      </button>
                    </div>
                    {studentName && (
                      <p className="text-[10px] text-gray-400 text-center">
                        Saving for: {studentName}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Final competency action area */}
              {mode === 'final' && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
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
                            result === key ? `${color} text-white` : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          } ${key !== 'pass' ? 'border-l border-gray-300 dark:border-gray-600' : ''}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
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
                        result !== 'pass' && !notes.trim() ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                      }`}
                    />
                  </div>
                  <div className="space-y-2">
                    <button
                      onClick={() => handleSave('pending', 'in_progress')}
                      disabled={saving || !studentId}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      Finish Later
                    </button>
                    <button
                      onClick={() => handleSave('do_not_send')}
                      disabled={saving || !studentId}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium ${
                        result === 'fail' ? 'bg-red-600 hover:bg-red-700' : result === 'remediation' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                      Submit Competency{studentName ? ` — ${studentName}` : ''}
                    </button>
                    <p className="text-[10px] text-gray-400 text-center">
                      Final evaluations are not emailed to students
                    </p>
                  </div>
                  <div className="flex items-center justify-start">
                    <button
                      onClick={resetForm}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset
                    </button>
                  </div>
                </div>
              )}
              </>)}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop — confirm if unsaved changes */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={handleSafeClose}
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

          {/* Post-save actions */}
          {lastSavedEvalId && (
            <button
              onClick={() => handlePrint(lastSavedEvalId)}
              className="mr-2 p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Print last evaluation"
            >
              <Printer className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleSafeClose}
            className="ml-1 p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Just-saved transition banner */}
        {justSavedStudentName && studentName && justSavedStudentName !== studentName && (
          <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800 flex-shrink-0">
            <p className="text-xs text-green-800 dark:text-green-300 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              Completed: {justSavedStudentName}
              <ArrowRight className="w-3 h-3 mx-1" />
              Now grading: <strong>{studentName}</strong>
            </p>
          </div>
        )}

        {/* Student queue progress */}
        {studentQueue && studentQueue.length > 1 && (mode === 'formative' || mode === 'final') && (
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {studentQueue.filter(s => s.evaluated).length}/{studentQueue.length} students evaluated
              </span>
              <div className="flex gap-1">
                {studentQueue.map((s) => (
                  <div
                    key={s.id}
                    className={`w-2.5 h-2.5 rounded-full ${
                      s.evaluated
                        ? 'bg-green-500'
                        : s.inProgress
                        ? 'bg-amber-500'
                        : s.id === studentId
                        ? 'bg-blue-500'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                    title={`${s.name}${s.evaluated ? ' ✓' : s.inProgress ? ' ⏳' : ''}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

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
              {/* Existing evaluation summary */}
              {evalViewMode === 'existing' && existingEvals.length > 0 && (mode === 'formative' || mode === 'final') && sheet && (
                <ExistingEvalSummary
                  evaluations={existingEvals}
                  expandedId={expandedEvalId}
                  onToggleExpand={(id) => setExpandedEvalId(expandedEvalId === id ? null : id)}
                  onEdit={handleEditEval}
                  onNewAttempt={handleNewAttempt}
                  onDelete={(id) => setConfirmDeleteId(id)}
                  confirmDeleteId={confirmDeleteId}
                  onConfirmDelete={handleDeleteEval}
                  onCancelDelete={() => setConfirmDeleteId(null)}
                  sheet={sheet}
                />
              )}

              {(evalViewMode === 'new' || mode === 'teaching') && (<>
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
                              sequenceNumber={stepSequence[step.step_number] ?? null}
                              onToggleComplete={() => toggleStepComplete(step.step_number)}
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
                  </div>

                  {/* Formative Save Options — four buttons */}
                  <div className="mt-3 space-y-2">
                    <button
                      onClick={() => handleSave('pending', 'in_progress')}
                      disabled={saving || !studentId}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      Finish Later
                    </button>
                    <button
                      onClick={() => handleSave('queued')}
                      disabled={saving || !studentId}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                      Save — Send Later
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleSave('sent')}
                        disabled={saving || sendingEmail || !studentId}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                      >
                        {sendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Save — Send Now
                      </button>
                      <button
                        onClick={() => handleSave('do_not_send')}
                        disabled={saving || !studentId}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        Do Not Send
                      </button>
                    </div>
                    {studentName && (
                      <p className="text-[10px] text-gray-400 text-center">
                        Saving for: {studentName}
                      </p>
                    )}
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

                  <div className="space-y-2">
                    <button
                      onClick={() => handleSave('pending', 'in_progress')}
                      disabled={saving || !studentId}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      Finish Later
                    </button>
                    <button
                      onClick={() => handleSave('do_not_send')}
                      disabled={saving || !studentId}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium ${
                        result === 'fail'
                          ? 'bg-red-600 hover:bg-red-700'
                          : result === 'remediation'
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                      Submit Competency{studentName ? ` — ${studentName}` : ''}
                    </button>
                    <p className="text-[10px] text-gray-400 text-center">
                      Final evaluations are not emailed to students
                    </p>
                  </div>

                  <div className="flex items-center justify-start">
                    <button
                      onClick={resetForm}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset
                    </button>
                  </div>
                </div>
              )}
              </>)}
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
  sequenceNumber,
  onToggleComplete,
}: {
  step: Step;
  mode: DisplayMode;
  mark: StepMark;
  onSetMark: (mark: StepMark) => void;
  sequenceNumber?: number | null;
  onToggleComplete?: () => void;
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

  // ===== FORMATIVE NUMBERED COMPLETION =====
  // DO NOT REPLACE with pass/fail/caution icons.
  // Each step gets a single tap target that assigns a sequence number.
  // This has been accidentally reverted 3 times — preserve this code.
  // ==========================================
  if (mode === 'formative') {
    const isComplete = sequenceNumber != null;
    return (
      <div className={`px-3 py-2 transition-colors ${isCritical ? 'bg-red-50 dark:bg-red-900/20' : ''} ${isComplete ? 'bg-green-50 dark:bg-green-900/10' : ''}`}>
        <div className="flex items-start gap-2">
          <span className="text-xs font-mono text-gray-400 mt-0.5 w-5 text-right flex-shrink-0">
            {step.step_number}.
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-1.5">
                  <p className={`text-xs ${isComplete ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                    {step.instruction}
                  </p>
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
              {/* Single tap target: numbered completion */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isComplete && (
                  <span className="w-6 h-6 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {sequenceNumber}
                  </span>
                )}
                <button
                  onClick={onToggleComplete}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                    isComplete
                      ? 'bg-green-500 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-600'
                  }`}
                  title={isComplete ? `Completed #${sequenceNumber} — tap to undo` : 'Mark as completed'}
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Final mode - pass/fail icons
  return (
    <div className={`px-3 py-2 ${isCritical ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
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
            {/* Final mode: Pass/Fail buttons */}
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Existing Evaluation Summary ─────────────────────────────────────────────

function ExistingEvalSummary({
  evaluations,
  expandedId,
  onToggleExpand,
  onEdit,
  onNewAttempt,
  onDelete,
  confirmDeleteId,
  onConfirmDelete,
  onCancelDelete,
  sheet,
}: {
  evaluations: ExistingEvaluation[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onEdit: (evalItem: ExistingEvaluation) => void;
  onNewAttempt: () => void;
  onDelete: (id: string) => void;
  confirmDeleteId: string | null;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
  sheet: SkillSheet;
}) {
  const completedEvals = evaluations.filter(e => e.status === 'complete');
  const totalSteps = sheet.steps.length;
  const criticalCount = sheet.steps.filter(s => s.is_critical).length;

  if (completedEvals.length === 0) return null;

  return (
    <div className="space-y-3">
      {completedEvals.length > 1 && (
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {completedEvals.length} attempts
        </p>
      )}

      {completedEvals.map((ev) => {
        const isExpanded = expandedId === ev.id;
        const stepMarks = ev.step_marks as Record<string, string> | null;
        const passedSteps = stepMarks ? Object.values(stepMarks).filter(m => m === 'pass').length : 0;
        const criticalPassed = stepMarks
          ? sheet.steps.filter(s => s.is_critical && stepMarks[String(s.step_number)] === 'pass').length
          : 0;
        const evalDate = new Date(ev.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const evaluatorName = ev.evaluator?.name
          ? `${ev.evaluator.name.split(' ')[0][0]}. ${ev.evaluator.name.split(' ').slice(1).join(' ')}`
          : 'Unknown';
        const isConfirming = confirmDeleteId === ev.id;

        return (
          <div key={ev.id} className={`rounded-lg border overflow-hidden ${
            ev.result === 'pass' ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10' :
            ev.result === 'fail' ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10' :
            'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10'
          }`}>
            {/* Summary row */}
            <div className="px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                    ev.result === 'pass' ? 'bg-green-500 text-white' :
                    ev.result === 'fail' ? 'bg-red-500 text-white' :
                    'bg-amber-500 text-white'
                  }`}>
                    {ev.result}
                  </span>
                  {completedEvals.length > 1 && (
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                      Attempt {ev.attempt_number || 1}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-gray-400">{evalDate}</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                <span>Steps: {passedSteps}/{totalSteps}</span>
                <span>Critical: {criticalPassed}/{criticalCount}</span>
                <span>By: {evaluatorName}</span>
              </div>
              {ev.email_status && (
                <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] ${
                  ev.email_status === 'sent' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  ev.email_status === 'queued' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                  ev.email_status === 'do_not_send' ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' :
                  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                }`}>
                  Email: {ev.email_status === 'do_not_send' ? 'Do not send' : ev.email_status}
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50">
              {isConfirming ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600 dark:text-red-400 flex-1">Delete this evaluation?</span>
                  <button
                    onClick={() => onConfirmDelete(ev.id)}
                    className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-medium hover:bg-red-700"
                  >
                    Yes, Delete
                  </button>
                  <button
                    onClick={onCancelDelete}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-[10px] font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => onToggleExpand(ev.id)}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-[10px] font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {isExpanded ? 'Hide' : 'View Results'}
                    </span>
                  </button>
                  <button
                    onClick={() => onEdit(ev)}
                    className="px-2 py-1 border border-blue-300 dark:border-blue-600 rounded text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    <span className="flex items-center gap-1">
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </span>
                  </button>
                  <button
                    onClick={() => onDelete(ev.id)}
                    className="px-2 py-1 border border-red-300 dark:border-red-600 rounded text-[10px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <span className="flex items-center gap-1">
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Expanded step details */}
            {isExpanded && ev.step_details && Array.isArray(ev.step_details) && (
              <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <div className="space-y-1">
                  {[...ev.step_details]
                    .sort((a, b) => (a.sequence_number || 999) - (b.sequence_number || 999))
                    .map((detail) => (
                      <div key={detail.step_number} className="flex items-center gap-2 text-[10px]">
                        {detail.completed ? (
                          <span className="w-4 h-4 rounded-full bg-green-600 text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0">
                            {detail.sequence_number}
                          </span>
                        ) : (
                          <span className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                        )}
                        <span className={`${detail.completed ? 'text-gray-500 line-through' : 'text-gray-900 dark:text-white'} ${detail.is_critical ? 'font-medium' : ''}`}>
                          {detail.step_number}. {sheet.steps.find(s => s.step_number === detail.step_number)?.instruction || `Step ${detail.step_number}`}
                        </span>
                        {detail.is_critical && (
                          <span className="px-1 rounded text-[8px] font-bold text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400">C</span>
                        )}
                      </div>
                    ))}
                </div>
                {ev.notes && (
                  <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 italic">{ev.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Expanded step marks fallback (when no step_details) */}
            {isExpanded && !ev.step_details && ev.step_marks && (
              <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <div className="space-y-1">
                  {sheet.steps.map(step => {
                    const mark = (ev.step_marks as Record<string, string>)?.[String(step.step_number)];
                    return (
                      <div key={step.step_number} className="flex items-center gap-2 text-[10px]">
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[8px] ${
                          mark === 'pass' ? 'bg-green-500 text-white' :
                          mark === 'fail' ? 'bg-red-500 text-white' :
                          mark === 'caution' ? 'bg-amber-500 text-white' :
                          'bg-gray-200 dark:bg-gray-700'
                        }`}>
                          {mark === 'pass' ? '\u2713' : mark === 'fail' ? '\u2717' : mark === 'caution' ? '!' : ''}
                        </span>
                        <span className={step.is_critical ? 'font-medium' : ''}>
                          {step.step_number}. {step.instruction.substring(0, 60)}{step.instruction.length > 60 ? '...' : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* New Attempt button */}
      <button
        onClick={onNewAttempt}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
      >
        <Plus className="w-4 h-4" />
        New Attempt
      </button>
    </div>
  );
}
