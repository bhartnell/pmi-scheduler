'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
  Users,
  Star,
  User,
  Megaphone,
} from 'lucide-react';
import { findMinimumPoints } from '@/lib/nremt-instructions';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SubItem {
  label?: string;
  description?: string;
}

interface Step {
  id: string;
  step_number: number;
  phase: string;
  instruction: string;
  is_critical: boolean;
  detail_notes: string | null;
  possible_points: number | null;
  sub_items: SubItem[] | null;
  section_header: string | null;
  proctor_prompt: string | null;
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
  nremt_code: string | null;
  steps: Step[];
  canonical_skill: CanonicalSkill | null;
  alternate_sheets: { id: string; skill_name: string; source: string }[];
}

type DisplayMode = 'teaching' | 'formative' | 'final';
type StepMark = 'pass' | 'fail' | 'caution' | null;
type EmailPreference = 'pending' | 'queued' | 'sent' | 'do_not_send';
type GradeMode = 'individual' | 'team';

interface TeamMember {
  student_id: string;
  student_name: string;
  team_role: 'leader' | 'assistant';
}

interface TeamEvalResult {
  student_name: string;
  team_role: string;
  result: string;
  score?: number;
  total?: number;
  id: string;
}

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
  /** Callback fired after a successful complete save.
   *  Parent should clear its student selection and any parent-owned state
   *  (examiner notes, critical fail flags, etc.) so the next selection starts fresh.
   *  Return true to indicate the reset should be deferred (e.g. a modal will be shown
   *  and the parent will trigger reset later via the resetSignal prop). */
  onAfterSubmit?: () => boolean | void;
  /** Increment to force SkillSheetPanel to reset its form state. Used by parents
   *  that deferred the post-save reset (e.g. dual-station handoff modal). */
  resetSignal?: number;
  /** When true, renders as full-width embedded content instead of slide-out panel */
  embedded?: boolean;
  /** Default display mode — use 'final' for NREMT testing days */
  defaultMode?: DisplayMode;
  /** When true, hide Teaching and Formative tabs (NREMT mode) */
  nremtMode?: boolean;
  /** When true, this is an NREMT testing day — enables threshold checking */
  isNremtTesting?: boolean;
  /** Critical fail flag from the examiner panel (grading page state) */
  criticalFail?: boolean;
  /** Examiner notes from the NREMT sticky panel — saved as the evaluation's notes field */
  examinerNotes?: string;
  /** Critical failure criteria checked from the NREMT sticky panel */
  checkedCriticalCriteria?: string[];
  /** Critical fail notes from the NREMT sticky panel */
  criticalFailNotes?: string;
  /** When true, this evaluation is a retake attempt */
  isRetake?: boolean;
  /** The original evaluation ID this retake links to */
  originalEvaluationId?: string;
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

/** Check if a skill sheet uses multi-point scoring (has any step with possible_points > 1 or sub_items) */
function hasMultiPointScoring(steps: Step[]): boolean {
  return steps.some(s => (s.possible_points && s.possible_points > 1) || (s.sub_items && s.sub_items.length > 0));
}

/** Check if steps should be displayed sequentially (by step_number) instead of grouped by phase.
 *  NREMT sheets use section_header for grouping, not the phase field. */
function useSequentialDisplay(sheet: SkillSheet): boolean {
  return sheet.source === 'nremt' || sheet.steps.some(s => s.section_header != null);
}

/** Group sequential steps into sections based on section_header values.
 *  Returns an array of { header, steps } in step_number order. */
function groupStepsBySectionHeader(steps: Step[]): Array<{ header: string | null; steps: Step[] }> {
  const sorted = [...steps].sort((a, b) => a.step_number - b.step_number);
  const sections: Array<{ header: string | null; steps: Step[] }> = [];
  let currentHeader: string | null = null;
  let currentSteps: Step[] = [];

  for (const step of sorted) {
    if (step.section_header != null) {
      // Start a new section
      if (currentSteps.length > 0) {
        sections.push({ header: currentHeader, steps: currentSteps });
      }
      currentHeader = step.section_header;
      currentSteps = [step];
    } else {
      currentSteps.push(step);
    }
  }
  if (currentSteps.length > 0) {
    sections.push({ header: currentHeader, steps: currentSteps });
  }
  return sections;
}

/** Effective possible points for a step: use sub_items length when present
 *  to stay consistent with earned-point counting (which counts checked sub-items). */
function effectivePossiblePoints(step: Step): number {
  if (step.sub_items && step.sub_items.length > 0) {
    return step.sub_items.length;
  }
  return step.possible_points || 1;
}

/** Coerce any critical-failure shape to a display string. Some rows store
 *  strings; others may store { description, ... } or { step_number, status }
 *  objects. Returning a string prevents React render error #31. */
function cfToText(cf: unknown): string {
  if (typeof cf === 'string') return cf;
  if (cf && typeof cf === 'object') {
    const o = cf as Record<string, unknown>;
    if (typeof o.description === 'string') return o.description;
    if (typeof o.text === 'string') return o.text;
    if (typeof o.label === 'string') return o.label;
    if (typeof o.criterion === 'string') return o.criterion;
    if ('step_number' in o) {
      const sn = o.step_number;
      const st = 'status' in o ? String(o.status) : '';
      return st ? `Step ${sn}: ${st}` : `Step ${sn}`;
    }
    try { return JSON.stringify(o); } catch { return String(o); }
  }
  return String(cf);
}

/**
 * Determine whether a step instruction is semantically linked to any critical-failure
 * criterion for the skill sheet. Used to highlight matching steps in red on the NREMT
 * grading view so proctors can identify them at a glance.
 *
 * Uses keyword-overlap fuzzy matching: tokenizes both strings to meaningful words
 * (4+ chars, not stopwords) and returns true if at least 2 significant words overlap
 * OR if one string contains a distinctive phrase from the other.
 */
const STEP_MATCH_STOPWORDS = new Set([
  'with', 'that', 'this', 'from', 'have', 'will', 'when', 'been', 'were', 'their',
  'they', 'them', 'what', 'does', 'such', 'each', 'into', 'upon', 'which', 'would',
  'should', 'could', 'before', 'after', 'while', 'within', 'about', 'being', 'other',
  'also', 'then', 'than', 'your', 'these', 'those', 'more', 'most', 'some', 'very',
  'patient', 'candidate', 'examiner',
]);

function tokenizeForMatch(s: string): Set<string> {
  const tokens = s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STEP_MATCH_STOPWORDS.has(w));
  return new Set(tokens);
}

function stepMatchesCriticalFailure(stepText: string, criticalFailures: string[]): boolean {
  if (!stepText || !criticalFailures || criticalFailures.length === 0) return false;
  const stepTokens = tokenizeForMatch(stepText);
  if (stepTokens.size === 0) return false;
  for (const cfRaw of criticalFailures) {
    const cfText = cfToText(cfRaw);
    if (!cfText) continue;
    const cfTokens = tokenizeForMatch(cfText);
    if (cfTokens.size === 0) continue;
    // Count overlapping significant tokens
    let overlap = 0;
    for (const t of stepTokens) {
      if (cfTokens.has(t)) overlap++;
      if (overlap >= 2) return true;
    }
  }
  return false;
}

/** Get earned points for a step based on sub-item marks or pass/fail mark */
function getStepEarnedPoints(
  step: Step,
  mark: StepMark,
  subItemChecks?: boolean[],
): number {
  // Sub-item steps: earned = number of checked sub-items
  if (step.sub_items && step.sub_items.length > 0) {
    if (subItemChecks) {
      return subItemChecks.filter(Boolean).length;
    }
    // Sub-item step with no checks yet → 0 (don't fall through to mark-based logic)
    return 0;
  }
  // Simple step: pass = full points, anything else = 0
  const possiblePts = step.possible_points || 1;
  return mark === 'pass' ? possiblePts : 0;
}

/** Calculate total possible points across all steps */
function getTotalPossiblePoints(steps: Step[]): number {
  return steps.reduce((sum, s) => sum + effectivePossiblePoints(s), 0);
}

/** Calculate total earned points */
function getTotalEarnedPoints(
  steps: Step[],
  stepMarks: Record<number, StepMark>,
  subItemMarks: Record<number, boolean[]>,
): number {
  return steps.reduce((sum, s) => {
    return sum + getStepEarnedPoints(s, stepMarks[s.step_number] || null, subItemMarks[s.step_number]);
  }, 0);
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
  onAfterSubmit,
  resetSignal,
  embedded = false,
  defaultMode,
  nremtMode = false,
  isNremtTesting = false,
  criticalFail = false,
  examinerNotes = '',
  checkedCriticalCriteria = [],
  criticalFailNotes: _externalCriticalFailNotes = '',
  isRetake = false,
  originalEvaluationId,
}: SkillSheetPanelProps) {
  const [sheet, setSheet] = useState<SkillSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<DisplayMode>(defaultMode || (nremtMode ? 'final' : 'teaching'));
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());

  // Evaluation state
  const [stepMarks, setStepMarks] = useState<Record<number, StepMark>>({});
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<'pass' | 'fail' | 'remediation'>('pass');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Sub-item checkbox state: { [stepNumber]: [true, false, true, ...] }
  const [subItemMarks, setSubItemMarks] = useState<Record<number, boolean[]>>({});

  // Tracks whether the examiner has actually started evaluating this student.
  // Becomes true on the first checklist interaction (stepMarks / subItemMarks /
  // stepSequence). Until then, we do NOT POST an in_progress queue row — mere
  // selection from the student dropdown should not create a draft evaluation.
  const [evaluationTouched, setEvaluationTouched] = useState(false);

  // Per-step sub-item notes: { [stepNumber]: "missed medications, last oral intake" }
  const [subItemNotes, setSubItemNotes] = useState<Record<number, string>>({});

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
  const [sendingResultsId, setSendingResultsId] = useState<string | null>(null);
  const [sentResultsIds, setSentResultsIds] = useState<Set<string>>(new Set());
  const [sendErrorId, setSendErrorId] = useState<string | null>(null);

  // Team grading state — forced to 'individual' on NREMT testing days
  const [gradeMode, setGradeMode] = useState<GradeMode>('individual');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // FIX 1: Force individual mode when NREMT testing
  useEffect(() => {
    if (isNremtTesting) {
      setGradeMode('individual');
      setTeamMembers([]);
    }
  }, [isNremtTesting]);
  const [showTeamAddDropdown, setShowTeamAddDropdown] = useState(false);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [teamCompletionResults, setTeamCompletionResults] = useState<TeamEvalResult[] | null>(null);

  // NREMT threshold warning modal state
  const [showThresholdWarning, setShowThresholdWarning] = useState(false);
  const [showCriticalFailBlock, setShowCriticalFailBlock] = useState(false);
  const pendingSaveRef = useRef<{ emailPref: EmailPreference; saveStatus: 'complete' | 'in_progress' } | null>(null);

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

  // Watch checklist state: once any step/sub-item has been marked, flag the
  // evaluation as "touched" so the in-progress queue row can be created.
  useEffect(() => {
    if (evaluationTouched) return;
    const hasStepMark = Object.values(stepMarks).some(v => v != null);
    const hasSubItemMark = Object.values(subItemMarks).some(arr => Array.isArray(arr) && arr.some(Boolean));
    const hasSeq = Object.keys(stepSequence).length > 0;
    if (hasStepMark || hasSubItemMark || hasSeq) {
      setEvaluationTouched(true);
    }
  }, [stepMarks, subItemMarks, stepSequence, evaluationTouched]);

  // External reset trigger: parent increments resetSignal to force a form reset
  // (used after a deferred reset like the dual-station handoff modal is dismissed).
  const didMountResetSignalRef = useRef(false);
  useEffect(() => {
    if (!didMountResetSignalRef.current) {
      didMountResetSignalRef.current = true;
      return;
    }
    if (resetSignal !== undefined) {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  // Reset the "touched" flag whenever the selected student changes.
  // A fresh selection should NOT create an in_progress row; only explicit
  // examiner interaction (first checklist mark) does.
  useEffect(() => {
    setEvaluationTouched(false);
  }, [studentId]);

  // Track student queue: mark as in_progress ONLY after the examiner has
  // actually started grading (first checklist interaction). This prevents
  // a draft/in-progress row from being created on mere student selection.
  useEffect(() => {
    if (evaluationTouched && studentId && labDayId && stationPoolId) {
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
  }, [evaluationTouched, studentId, labDayId, stationPoolId]);

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
    setSubItemMarks({});
    setSubItemNotes({});
    setNotes('');
    setResult('pass');
    setEvaluationTouched(false);
    setCollapsedPhases(new Set());
    setShowThresholdWarning(false);
    setShowCriticalFailBlock(false);
  };

  const handleSave = async (emailPref: EmailPreference = 'queued', saveStatus: 'complete' | 'in_progress' = 'complete') => {
    if (!studentId) {
      showToast('No student selected on the grading page', 'error');
      return;
    }

    // FIX 2: On NREMT days, use examiner notes from sticky panel instead of local notes
    const effectiveNotes = isNremtTesting ? examinerNotes : notes;

    if (saveStatus === 'complete' && mode === 'final' && result !== 'pass' && !isNremtTesting && !notes.trim()) {
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
    // New format for multi-point steps: { "1": { "completed": true, "sub_items": [true, false, true], "points": 2 } }
    // Old format for simple steps: { "1": "pass" }
    const isMultiPoint = sheet ? hasMultiPointScoring(sheet.steps) : false;
    const stepMarksToSave: Record<string, unknown> = {};
    if (isMultiPoint && sheet) {
      for (const step of sheet.steps) {
        const mark = stepMarks[step.step_number];
        const subs = subItemMarks[step.step_number];
        if (step.sub_items && step.sub_items.length > 0 && subs) {
          const pts = subs.filter(Boolean).length;
          const effPossible = effectivePossiblePoints(step);
          const noteText = subItemNotes[step.step_number]?.trim() || undefined;
          stepMarksToSave[String(step.step_number)] = {
            completed: pts === effPossible,
            sub_items: subs,
            points: pts,
            ...(noteText ? { sub_item_notes: noteText } : {}),
          };
        } else if (mark) {
          const effPossible = effectivePossiblePoints(step);
          stepMarksToSave[String(step.step_number)] = {
            completed: mark === 'pass',
            points: mark === 'pass' ? effPossible : 0,
          };
        }
      }
    } else {
      for (const [key, val] of Object.entries(stepMarks)) {
        if (val) stepMarksToSave[key] = val;
      }
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
          notes: effectiveNotes.trim() || null,
          flagged_items: flaggedItems,
          station_id: stationPoolId || null,
          email_status: saveStatus === 'in_progress' ? 'pending' : (mode === 'final' ? 'do_not_send' : (emailPref === 'sent' ? 'queued' : emailPref)),
          step_marks: Object.keys(stepMarksToSave).length > 0 ? stepMarksToSave : null,
          step_details: stepDetails || null,
          status: saveStatus,
          // FIX 3: Include critical fail data from NREMT examiner panel
          // Note: critical fail notes are now merged into examiner comments (single field)
          ...(isNremtTesting && criticalFail ? {
            critical_fail: true,
            critical_fail_notes: effectiveNotes.trim() || null,
            critical_criteria_checked: checkedCriticalCriteria,
          } : {}),
          // Retake fields
          ...(isRetake ? {
            is_retake: true,
            original_evaluation_id: originalEvaluationId || null,
          } : {}),
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
        if (labDayId && studentId && stationPoolId) {
          const queueResult = saveStatus === 'complete' ? (evaluationResult === 'pass' ? 'pass' : 'fail') : undefined;
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
            : `\u2713 Evaluation submitted for ${studentName || 'student'}`,
          'success'
        );

        // If Send Now, fire the email immediately
        if (saveStatus === 'complete' && emailPref === 'sent' && evalId) {
          setSendingEmail(true);
          try {
            await fetch('/api/skill-sheets/evaluations/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ evaluation_id: evalId }),
            });
          } catch {
            console.warn('Failed to send immediate email');
          }
          setSendingEmail(false);
        }

        // Only reset and advance for complete saves
        if (saveStatus === 'complete') {
          // Let the parent decide whether to defer the reset (e.g. to show a
          // dual-station handoff modal). If onAfterSubmit returns truthy the
          // parent will trigger the reset later via the resetSignal prop.
          const defer = onAfterSubmit ? onAfterSubmit() === true : false;
          if (!defer) {
            resetForm();
          }
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

  const handleSendResults = async (evalId: string) => {
    if (!labDayId) return;
    setSendingResultsId(evalId);
    setSendErrorId(null);
    try {
      const res = await fetch(`/api/lab-management/lab-days/${labDayId}/skill-results/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluation_ids: [evalId] }),
      });
      const data = await res.json();
      if (data.success) {
        setSentResultsIds(prev => new Set(prev).add(evalId));
        setExistingEvals(prev => prev.map(e => e.id === evalId ? { ...e, email_status: 'sent' } : e));
      } else {
        setSendErrorId(evalId);
      }
    } catch {
      setSendErrorId(evalId);
    } finally {
      setSendingResultsId(null);
    }
  };

  const handleEditEval = (evalItem: ExistingEvaluation) => {
    if (evalItem.step_marks) {
      const marks: Record<number, StepMark> = {};
      const subs: Record<number, boolean[]> = {};
      const restoredNotes: Record<number, string> = {};
      for (const [key, val] of Object.entries(evalItem.step_marks)) {
        const stepNum = parseInt(key);
        if (typeof val === 'string') {
          // Old format: simple string mark
          marks[stepNum] = val as StepMark;
        } else if (typeof val === 'object' && val !== null) {
          // New format: { completed, sub_items, points, sub_item_notes }
          const obj = val as { completed?: boolean; sub_items?: boolean[]; points?: number; sub_item_notes?: string };
          marks[stepNum] = obj.completed ? 'pass' : null;
          if (obj.sub_items) {
            subs[stepNum] = obj.sub_items;
          }
          if (obj.sub_item_notes) {
            restoredNotes[stepNum] = obj.sub_item_notes;
          }
        }
      }
      setStepMarks(marks);
      setSubItemMarks(subs);
      setSubItemNotes(restoredNotes);
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

  // ─── Team Grading Handlers ────────────────────────────────────────────────

  const addTeamMember = (student: StudentInfo) => {
    if (teamMembers.find(m => m.student_id === student.id)) return;
    const isFirst = teamMembers.length === 0;
    setTeamMembers(prev => [...prev, {
      student_id: student.id,
      student_name: student.name,
      team_role: isFirst ? 'leader' : 'assistant',
    }]);
    setShowTeamAddDropdown(false);
    setTeamSearchQuery('');
  };

  const removeTeamMember = (studentId: string) => {
    setTeamMembers(prev => {
      const updated = prev.filter(m => m.student_id !== studentId);
      // If we removed the leader, promote the first remaining member
      if (updated.length > 0 && !updated.some(m => m.team_role === 'leader')) {
        updated[0].team_role = 'leader';
      }
      return updated;
    });
  };

  const setTeamLeader = (studentId: string) => {
    setTeamMembers(prev => prev.map(m => ({
      ...m,
      team_role: m.student_id === studentId ? 'leader' : 'assistant',
    })));
  };

  const handleTeamSave = async (emailPref: EmailPreference = 'queued', saveStatus: 'complete' | 'in_progress' = 'complete') => {
    if (teamMembers.length < 2) {
      showToast('Team must have at least 2 members', 'error');
      return;
    }
    if (!teamMembers.some(m => m.team_role === 'leader')) {
      showToast('Team must have a leader', 'error');
      return;
    }

    const effectiveTeamNotes = isNremtTesting ? examinerNotes : notes;

    if (saveStatus === 'complete' && mode === 'final' && result !== 'pass' && !isNremtTesting && !notes.trim()) {
      showToast('Remediation plan is required for non-pass results', 'error');
      return;
    }

    const flaggedItems = Object.entries(stepMarks)
      .filter(([, mark]) => mark === 'fail' || mark === 'caution')
      .map(([stepNum, mark]) => ({ step_number: parseInt(stepNum), status: mark }));

    const evaluationType = mode === 'formative' ? 'formative' : 'final_competency';
    const evaluationResult = mode === 'formative' ? 'pass' : result;

    // Build step_marks (same logic as individual)
    const isMultiPoint = sheet ? hasMultiPointScoring(sheet.steps) : false;
    const stepMarksToSave: Record<string, unknown> = {};
    if (isMultiPoint && sheet) {
      for (const step of sheet.steps) {
        const mark = stepMarks[step.step_number];
        const subs = subItemMarks[step.step_number];
        if (step.sub_items && step.sub_items.length > 0 && subs) {
          const pts = subs.filter(Boolean).length;
          const effPossible = effectivePossiblePoints(step);
          const noteText = subItemNotes[step.step_number]?.trim() || undefined;
          stepMarksToSave[String(step.step_number)] = {
            completed: pts === effPossible,
            sub_items: subs,
            points: pts,
            ...(noteText ? { sub_item_notes: noteText } : {}),
          };
        } else if (mark) {
          const effPossible = effectivePossiblePoints(step);
          stepMarksToSave[String(step.step_number)] = {
            completed: mark === 'pass',
            points: mark === 'pass' ? effPossible : 0,
          };
        }
      }
    } else {
      for (const [key, val] of Object.entries(stepMarks)) {
        if (val) stepMarksToSave[key] = val;
      }
    }

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
          team_members: teamMembers,
          lab_day_id: labDayId || null,
          evaluation_type: evaluationType,
          result: evaluationResult,
          notes: effectiveTeamNotes.trim() || null,
          flagged_items: flaggedItems,
          station_id: stationPoolId || null,
          email_status: saveStatus === 'in_progress' ? 'pending' : (mode === 'final' ? 'do_not_send' : (emailPref === 'sent' ? 'queued' : emailPref)),
          step_marks: Object.keys(stepMarksToSave).length > 0 ? stepMarksToSave : null,
          step_details: stepDetails || null,
          status: saveStatus,
        }),
      });

      const data = await res.json();
      if (data.success && data.team) {
        // Compute score for completion screen
        let earned = 0;
        let total = 0;
        if (sheet) {
          earned = getTotalEarnedPoints(sheet.steps, stepMarks, subItemMarks);
          total = getTotalPossiblePoints(sheet.steps);
        }

        const results: TeamEvalResult[] = (data.evaluations || []).map((ev: Record<string, unknown>) => ({
          student_name: ev.student_name as string,
          team_role: ev.team_role as string,
          result: ev.result as string,
          score: earned,
          total: total,
          id: ev.id as string,
        }));

        setTeamCompletionResults(results);

        // Notify parent for each team member
        if (onEvaluationSaved) {
          for (const ev of data.evaluations || []) {
            onEvaluationSaved(ev.student_id as string, ev.id as string, saveStatus);
          }
        }

        showToast(`Team evaluation saved for ${teamMembers.length} students`, 'success');

        if (saveStatus === 'complete') {
          resetForm();
        }
      } else {
        showToast(data.error || 'Failed to save team evaluation', 'error');
      }
    } catch (err) {
      console.error('Failed to save team evaluation:', err);
      showToast('Failed to save team evaluation', 'error');
    }
    setSaving(false);
  };

  // Dispatch save: team or individual (with NREMT threshold checks)
  const doSave = (emailPref: EmailPreference = 'queued', saveStatus: 'complete' | 'in_progress' = 'complete') => {
    if (gradeMode === 'team') {
      handleTeamSave(emailPref, saveStatus);
    } else {
      handleSave(emailPref, saveStatus);
    }
  };

  const dispatchSave = (emailPref: EmailPreference = 'queued', saveStatus: 'complete' | 'in_progress' = 'complete') => {
    // For non-complete saves (Finish Later), skip threshold checks
    if (saveStatus !== 'complete') {
      doSave(emailPref, saveStatus);
      return;
    }

    // NREMT threshold checks on final submit
    if (isNremtTesting && mode === 'final') {
      // Block: critical fail + pass
      if (criticalFail && result === 'pass') {
        setShowCriticalFailBlock(true);
        return;
      }

      // FIX 3: Require examiner comments when result is fail on NREMT days
      if (result === 'fail' && !examinerNotes?.trim()) {
        showToast('Examiner comments are required for a Fail result on NREMT testing days', 'error');
        return;
      }

      // Warn: below minimum + pass
      if (sheet && result === 'pass') {
        const minPts = findMinimumPoints(sheet.skill_name);
        if (minPts !== null) {
          const earned = getTotalEarnedPoints(sheet.steps, stepMarks, subItemMarks);
          if (earned < minPts) {
            pendingSaveRef.current = { emailPref, saveStatus };
            setShowThresholdWarning(true);
            return;
          }
        }
      }
    }

    doSave(emailPref, saveStatus);
  };

  // Confirm override from threshold warning modal
  const confirmThresholdOverride = () => {
    setShowThresholdWarning(false);
    if (pendingSaveRef.current) {
      doSave(pendingSaveRef.current.emailPref, pendingSaveRef.current.saveStatus);
      pendingSaveRef.current = null;
    }
  };

  // Can save? For individual mode: needs studentId. For team mode: needs 2+ members.
  const canSave = gradeMode === 'team'
    ? teamMembers.length >= 2 && teamMembers.some(m => m.team_role === 'leader')
    : !!studentId;

  // ─── NREMT Auto-Suggest Result ──────────────────────────────────────────
  // When NREMT testing + final mode, auto-suggest result based on score threshold and critical fail
  const prevAutoSuggestRef = useRef<{ earned: number; minPts: number | null; critFail: boolean } | null>(null);

  useEffect(() => {
    if (!isNremtTesting || mode !== 'final' || !sheet) return;

    const earned = getTotalEarnedPoints(sheet.steps, stepMarks, subItemMarks);
    const minPts = findMinimumPoints(sheet.skill_name);

    // Only auto-suggest when the relevant inputs change
    const prev = prevAutoSuggestRef.current;
    if (prev && prev.earned === earned && prev.minPts === minPts && prev.critFail === criticalFail) return;
    prevAutoSuggestRef.current = { earned, minPts, critFail: criticalFail };

    if (criticalFail) {
      setResult('fail');
    } else if (minPts !== null) {
      if (earned >= minPts) {
        setResult('pass');
      } else {
        setResult('fail');
      }
    }
  }, [isNremtTesting, mode, sheet, stepMarks, subItemMarks, criticalFail]);

  // ─── Render ─────────────────────────────────────────────────────────────

  const stepsByPhase = sheet ? groupStepsByPhase(sheet.steps) : {};
  const orderedPhases = sheet ? getOrderedPhases(stepsByPhase) : [];
  const sourceBadge = sheet ? (SOURCE_BADGE[sheet.source] || SOURCE_BADGE.publisher) : null;
  const isSequential = sheet ? useSequentialDisplay(sheet) : false;
  const sectionGroups = sheet && isSequential ? groupStepsBySectionHeader(sheet.steps) : [];

  // Pre-compute which step numbers correlate to critical failure criteria.
  // Only relevant for NREMT testing mode; empty Set otherwise.
  const criticalFailureStepNumbers = (() => {
    if (!isNremtTesting || !sheet?.critical_failures?.length || !sheet?.steps?.length) {
      return new Set<number>();
    }
    const matches = new Set<number>();
    for (const step of sheet.steps) {
      if (stepMatchesCriticalFailure(step.instruction, sheet.critical_failures)) {
        matches.add(step.step_number);
      }
    }
    return matches;
  })();

  // NREMT desktop section header styling — larger, more prominent on lg screens
  const nremtSectionHeaderClass = isNremtTesting
    ? 'bg-gray-100 dark:bg-gray-700 px-3 py-2 font-bold text-sm uppercase tracking-wider border-b border-gray-200 dark:border-gray-600 lg:px-4 lg:py-3 lg:text-base lg:border-l-4 lg:border-l-blue-500 dark:lg:border-l-blue-400 lg:bg-blue-50 dark:lg:bg-blue-900/20 lg:text-blue-900 dark:lg:text-blue-200 lg:mt-3 lg:mb-1'
    : 'bg-gray-100 dark:bg-gray-700 px-3 py-2 font-bold text-sm uppercase tracking-wider border-b border-gray-200 dark:border-gray-600';

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

  // Team completion screen for slide-out mode (before the team completion screen variable definition)
  if (teamCompletionResults && !embedded) {
    return (
      <>
        <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[60%] md:w-[55%] lg:w-[50%] max-w-3xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col animate-slide-in-right">
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <Users className="w-16 h-16 text-green-500 mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Team evaluation saved for {teamCompletionResults.length} students
            </h2>
            <div className="w-full max-w-md space-y-2 mt-4">
              {teamCompletionResults.map((tr) => (
                <div key={tr.id} className="flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="flex-shrink-0">
                    {tr.team_role === 'leader' ? (
                      <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                    ) : (
                      <User className="w-5 h-5 text-gray-400" />
                    )}
                  </span>
                  <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white text-left">
                    {tr.student_name}
                    <span className="ml-2 text-xs text-gray-500">
                      ({tr.team_role === 'leader' ? 'Leader' : 'Assistant'})
                    </span>
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {tr.score !== undefined && tr.total !== undefined ? `${tr.score}/${tr.total} pts` : ''}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    tr.result === 'pass'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : tr.result === 'fail'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                  }`}>
                    {tr.result === 'pass' ? 'Pass' : tr.result === 'fail' ? 'Fail' : 'Remediation'}
                  </span>
                </div>
              ))}
            </div>
            <div className="w-full max-w-sm space-y-3 mt-6">
              <button
                onClick={() => {
                  setTeamCompletionResults(null);
                  setTeamMembers([]);
                  resetForm();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                <Users className="w-5 h-5" />
                Next Team
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

  // ─── Team Completion Screen ───────────────────────────────────────────────
  const teamCompletionScreen = teamCompletionResults && (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <Users className="w-16 h-16 text-green-500 mb-4" />
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
        Team evaluation saved for {teamCompletionResults.length} students
      </h2>
      <div className="w-full max-w-md space-y-2 mt-4">
        {teamCompletionResults.map((tr) => (
          <div key={tr.id} className="flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <span className="flex-shrink-0">
              {tr.team_role === 'leader' ? (
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              ) : (
                <User className="w-5 h-5 text-gray-400" />
              )}
            </span>
            <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white text-left">
              {tr.student_name}
              <span className="ml-2 text-xs text-gray-500">
                ({tr.team_role === 'leader' ? 'Leader' : 'Assistant'})
              </span>
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {tr.score !== undefined && tr.total !== undefined ? `${tr.score}/${tr.total} pts` : ''}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
              tr.result === 'pass'
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                : tr.result === 'fail'
                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
            }`}>
              {tr.result === 'pass' ? 'Pass' : tr.result === 'fail' ? 'Fail' : 'Remediation'}
            </span>
          </div>
        ))}
      </div>

      <div className="w-full max-w-sm space-y-3 mt-6">
        <button
          onClick={handleBatchEmail}
          disabled={batchEmailProgress !== null}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
        >
          <Mail className="w-5 h-5" />
          {batchEmailProgress ? `${batchEmailProgress.sent} emails sent` : 'Send Emails'}
        </button>

        <div className="grid grid-cols-2 gap-3">
          {teamCompletionResults.map((tr) => (
            <button
              key={`print-${tr.id}`}
              onClick={() => handlePrint(tr.id)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-medium"
            >
              <Printer className="w-3.5 h-3.5" />
              Print {tr.student_name.split(',')[0]}
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            setTeamCompletionResults(null);
            setTeamMembers([]);
            resetForm();
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          <Users className="w-5 h-5" />
          Next Team
        </button>

        <button
          onClick={onClose}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
        >
          Back to Lab Day
        </button>
      </div>
    </div>
  );

  // ─── Team Member Selector UI ────────────────────────────────────────────
  const availableStudents = (studentQueue || []).filter(
    s => !teamMembers.find(m => m.student_id === s.id)
  );
  const filteredStudents = teamSearchQuery
    ? availableStudents.filter(s => s.name.toLowerCase().includes(teamSearchQuery.toLowerCase()))
    : availableStudents;

  const teamMemberSelector = gradeMode === 'team' && (mode === 'formative' || mode === 'final') && (
    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          Team Members ({teamMembers.length})
        </span>
        {teamMembers.length < 2 && (
          <span className="text-[10px] text-amber-600 dark:text-amber-400">Min. 2 members required</span>
        )}
      </div>

      {/* Current team members list */}
      {teamMembers.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {teamMembers.map((member) => (
            <div key={member.student_id} className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <button
                onClick={() => setTeamLeader(member.student_id)}
                className="flex-shrink-0"
                title={member.team_role === 'leader' ? 'Team Leader' : 'Click to make leader'}
              >
                {member.team_role === 'leader' ? (
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                ) : (
                  <User className="w-4 h-4 text-gray-400 hover:text-amber-400" />
                )}
              </button>
              <span className="flex-1 text-xs text-gray-900 dark:text-white font-medium">
                {member.student_name}
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                {member.team_role === 'leader' ? 'Team Leader' : 'Assistant'}
              </span>
              <button
                onClick={() => removeTeamMember(member.student_id)}
                className="flex-shrink-0 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500"
                title="Remove from team"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add team member dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowTeamAddDropdown(!showTeamAddDropdown)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <Plus className="w-3.5 h-3.5" />
          Add team member
        </button>

        {showTeamAddDropdown && (
          <div className="absolute z-30 mt-1 w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-48 overflow-hidden">
            <div className="p-2 border-b border-gray-100 dark:border-gray-700">
              <input
                type="text"
                value={teamSearchQuery}
                onChange={(e) => setTeamSearchQuery(e.target.value)}
                placeholder="Search students..."
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto max-h-32">
              {filteredStudents.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400">
                  {availableStudents.length === 0 ? 'All students added' : 'No matches'}
                </p>
              ) : (
                filteredStudents.map(student => (
                  <button
                    key={student.id}
                    onClick={() => addTeamMember(student)}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    {student.name}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ─── Grade Mode Selector ────────────────────────────────────────────────
  // FIX 1: Hide team toggle entirely on NREMT testing days
  const gradeModeSelector = !isNremtTesting && (mode === 'formative' || mode === 'final') && studentQueue && studentQueue.length > 1 && (
    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Grade Mode:</span>
        <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
          <button
            onClick={() => { setGradeMode('individual'); setTeamMembers([]); setTeamCompletionResults(null); }}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors ${
              gradeMode === 'individual'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <User className="w-3 h-3" />
            Individual
          </button>
          <button
            onClick={() => setGradeMode('team')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
              gradeMode === 'team'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Users className="w-3 h-3" />
            Team
          </button>
        </div>
      </div>
    </div>
  );

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
            {sheet?.nremt_code && (
              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 rounded align-middle">NREMT</span>
            )}
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

  // ─── NREMT Threshold Warning Modals ─────────────────────────────────────
  const nremtThresholdModals = (
    <>
      {/* Threshold warning — below minimum but examiner wants to pass */}
      {showThresholdWarning && sheet && (() => {
        const earned = getTotalEarnedPoints(sheet.steps, stepMarks, subItemMarks);
        const total = getTotalPossiblePoints(sheet.steps);
        const minPts = findMinimumPoints(sheet.skill_name);
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Score Below NREMT Minimum</h3>
                  <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                    <p>This student scored <strong>{earned}/{total}</strong> points.</p>
                    <p>The NREMT minimum is <strong>{minPts}</strong> points.</p>
                  </div>
                  <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                    Are you sure you want to mark this as Pass?
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setShowThresholdWarning(false); pendingSaveRef.current = null; }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmThresholdOverride}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700"
                >
                  Override — Mark as Pass
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Critical fail block — cannot pass with critical failure */}
      {showCriticalFailBlock && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cannot Pass with Critical Failure</h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  A critical failure has been recorded. Only Fail or Remediation results are allowed.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowCriticalFailBlock(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // ─── Embedded mode ────────────────────────────────────────────────────────
  if (embedded) {
    // Completion screen for embedded mode
    if (showCompletionScreen) {
      const completedCount = studentQueue?.filter(s => s.evaluated).length || 0;
      const totalCount = studentQueue?.length || 0;
      return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden">
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

    // Team completion screen for embedded mode
    if (teamCompletionResults) {
      return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden">
          {teamCompletionScreen}
        </div>
      );
    }

    return (
      // NREMT desktop (lg+): un-cap height + remove overflow so the center
      // column participates in the normal page scroll (no scroll trap).
      // Mobile/non-NREMT: keep the original fixed-height internal-scroll behavior.
      <div className={`flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden ${isNremtTesting ? 'lg:h-auto lg:overflow-visible' : ''}`}>
        {panelInner}

        {/* Student queue progress (individual mode only) */}
        {gradeMode === 'individual' && studentQueue && studentQueue.length > 1 && (mode === 'formative' || mode === 'final') && (
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
                ]).filter(({ key }) => !nremtMode || key === 'final').map(({ key, label, icon: Icon }) => (
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
                  {hasMultiPointScoring(sheet.steps) ? (() => {
                    const earned = getTotalEarnedPoints(sheet.steps, stepMarks, subItemMarks);
                    const total = getTotalPossiblePoints(sheet.steps);
                    const pct = total > 0 ? Math.round((earned / total) * 100) : 0;
                    return `Points: ${earned}/${total} (${pct}%)`;
                  })() : `${Object.keys(stepSequence).length}/${sheet.steps.length} completed`}
                </span>
              )}
              {mode === 'final' && !isNremtTesting && sheet.steps.length > 0 && (
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {(() => {
                    const earned = getTotalEarnedPoints(sheet.steps, stepMarks, subItemMarks);
                    const total = getTotalPossiblePoints(sheet.steps);
                    return `Points: ${earned}/${total}`;
                  })()}
                </span>
              )}
            </div>
            {/* NREMT threshold indicator — prominent at top of center column on desktop */}
            {isNremtTesting && mode === 'final' && sheet.steps.length > 0 && (() => {
              const earned = getTotalEarnedPoints(sheet.steps, stepMarks, subItemMarks);
              const total = getTotalPossiblePoints(sheet.steps);
              const minPts = findMinimumPoints(sheet.skill_name);
              if (minPts === null) return null;
              const meetsMin = earned >= minPts;
              const nearMin = !meetsMin && earned >= minPts - 3;
              const colorClass = criticalFail
                ? 'text-red-600 dark:text-red-400'
                : meetsMin
                ? 'text-green-600 dark:text-green-400'
                : nearMin
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-600 dark:text-red-400';
              const statusLabel = criticalFail
                ? 'Critical Failure'
                : meetsMin
                ? 'Meets minimum'
                : nearMin
                ? 'Near minimum threshold'
                : `Below minimum (${minPts} required)`;
              return (
                <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 lg:text-2xl">
                  <span className="text-sm lg:text-lg font-semibold text-gray-700 dark:text-gray-200">
                    Points:
                  </span>
                  <span className={`font-bold text-lg lg:text-3xl tabular-nums ${colorClass}`}>
                    {earned}
                    <span className="text-gray-400 dark:text-gray-500 font-normal">/{total}</span>
                  </span>
                  <span className="text-sm lg:text-lg font-semibold text-gray-700 dark:text-gray-200">
                    Min: <span className="tabular-nums">{minPts}</span>
                  </span>
                  <span className={`text-xs lg:text-sm font-medium ${colorClass}`}>
                    — {statusLabel}
                  </span>
                </div>
              );
            })()}
            {(mode === 'formative' || mode === 'final') && gradeMode === 'individual' && !studentId && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Select a student first
              </p>
            )}
          </div>
        )}

        {/* Grade Mode Selector */}
        {gradeModeSelector}

        {/* Team Member Selector */}
        {teamMemberSelector}

        {/* Scrollable Content — on NREMT desktop (lg+) this flows with the page scroll instead of trapping wheel events */}
        <div className={`flex-1 overflow-y-auto overscroll-contain ${isNremtTesting ? 'lg:flex-none lg:overflow-visible lg:overscroll-auto' : ''}`}>
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
                  labDayId={labDayId}
                  onSendResults={handleSendResults}
                  sendingResultsId={sendingResultsId}
                  sentResultsIds={sentResultsIds}
                  sendErrorId={sendErrorId}
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
                        {cfToText(cf)}
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

              {/* Steps — sequential (NREMT) or by phase */}
              {isSequential ? (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {sectionGroups.map((section, sIdx) => (
                      <div key={sIdx}>
                        {section.header && (
                          <div className={nremtSectionHeaderClass}>
                            {section.header}
                          </div>
                        )}
                        {section.steps.map(step => (
                          <PanelStepRow
                            key={step.id}
                            step={step}
                            mode={mode}
                            mark={stepMarks[step.step_number] || null}
                            onSetMark={(mark) => setStepMarkDirect(step.step_number, mark)}
                            sequenceNumber={stepSequence[step.step_number] ?? null}
                            onToggleComplete={() => toggleStepComplete(step.step_number)}
                            subItemChecks={subItemMarks[step.step_number]}
                            onSubItemToggle={(idx) => {
                              setSubItemMarks(prev => {
                                const current = prev[step.step_number] || new Array(step.sub_items?.length || 0).fill(false);
                                const next = [...current];
                                next[idx] = !next[idx];
                                return { ...prev, [step.step_number]: next };
                              });
                            }}
                            subItemNote={subItemNotes[step.step_number]}
                            onSubItemNoteChange={(note) => setSubItemNotes(prev => ({ ...prev, [step.step_number]: note }))}
                            isNremtTesting={isNremtTesting}
                            matchesCriticalFailure={criticalFailureStepNumbers.has(step.step_number)}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
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
                              <div key={step.id}>
                                {step.section_header && (
                                  <div className={nremtSectionHeaderClass}>
                                    {step.section_header}
                                  </div>
                                )}
                                <PanelStepRow
                                  step={step}
                                  mode={mode}
                                  mark={stepMarks[step.step_number] || null}
                                  onSetMark={(mark) => setStepMarkDirect(step.step_number, mark)}
                                  sequenceNumber={stepSequence[step.step_number] ?? null}
                                  onToggleComplete={() => toggleStepComplete(step.step_number)}
                                  subItemChecks={subItemMarks[step.step_number]}
                                  onSubItemToggle={(idx) => {
                                    setSubItemMarks(prev => {
                                      const current = prev[step.step_number] || new Array(step.sub_items?.length || 0).fill(false);
                                      const next = [...current];
                                      next[idx] = !next[idx];
                                      return { ...prev, [step.step_number]: next };
                                    });
                                  }}
                                  subItemNote={subItemNotes[step.step_number]}
                                  onSubItemNoteChange={(note) => setSubItemNotes(prev => ({ ...prev, [step.step_number]: note }))}
                                  isNremtTesting={isNremtTesting}
                                  matchesCriticalFailure={criticalFailureStepNumbers.has(step.step_number)}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

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
                        {cfToText(cf)}
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
                      onClick={() => dispatchSave('pending', 'in_progress')}
                      disabled={saving || !canSave}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      Finish Later
                    </button>
                    <button
                      onClick={() => dispatchSave('queued')}
                      disabled={saving || !canSave}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                      {gradeMode === 'team' ? `Save Team (${teamMembers.length})` : 'Save — Send Later'}
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => dispatchSave('sent')}
                        disabled={saving || sendingEmail || !canSave}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                      >
                        {sendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Save — Send Now
                      </button>
                      <button
                        onClick={() => dispatchSave('do_not_send')}
                        disabled={saving || !canSave}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        Do Not Send
                      </button>
                    </div>
                    {gradeMode === 'team' ? (
                      <p className="text-[10px] text-gray-400 text-center">
                        Saving for team: {teamMembers.map(m => m.student_name.split(',')[0]).join(', ')}
                      </p>
                    ) : studentName ? (
                      <p className="text-[10px] text-gray-400 text-center">
                        Saving for: {studentName}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Final competency action area */}
              {mode === 'final' && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3 lg:p-4">
                  <div>
                    <label className={`block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 ${isNremtTesting ? 'lg:text-sm lg:mb-2' : ''}`}>Result</label>
                    <div className={`inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden ${isNremtTesting ? 'lg:w-full' : ''}`}>
                      {([
                        { key: 'pass' as const, label: 'Pass', color: 'bg-green-600' },
                        { key: 'fail' as const, label: 'Fail', color: 'bg-red-600' },
                        { key: 'remediation' as const, label: 'Remediation', color: 'bg-amber-600' },
                      ]).map(({ key, label, color }) => (
                        <button
                          key={key}
                          onClick={() => setResult(key)}
                          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                            isNremtTesting ? 'lg:flex-1 lg:px-5 lg:py-3 lg:text-base lg:min-h-[48px]' : ''
                          } ${
                            result === key ? `${color} text-white` : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          } ${key !== 'pass' ? 'border-l border-gray-300 dark:border-gray-600' : ''}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* NREMT below-minimum warning when Fail is selected */}
                  {isNremtTesting && result === 'fail' && sheet && (() => {
                    const earned = getTotalEarnedPoints(sheet.steps, stepMarks, subItemMarks);
                    const minPts = findMinimumPoints(sheet.skill_name);
                    if (minPts === null || earned >= minPts) return null;
                    return (
                      <div className="rounded-md border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-3 py-2 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 lg:w-5 lg:h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs lg:text-sm text-red-700 dark:text-red-300">
                          <span className="font-semibold">Below NREMT minimum:</span> {earned} points scored, {minPts} required. Candidate did not meet the minimum threshold.
                        </p>
                      </div>
                    );
                  })()}
                  {/* FIX 2: Hide notes/remediation on NREMT days — examiner panel handles notes */}
                  {!isNremtTesting && (
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
                  )}
                  <div className="space-y-2 lg:space-y-3">
                    <button
                      onClick={() => dispatchSave('pending', 'in_progress')}
                      disabled={saving || !canSave}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium ${
                        isNremtTesting ? 'lg:py-3 lg:text-base lg:min-h-[48px]' : ''
                      }`}
                    >
                      <Save className="w-4 h-4" />
                      Finish Later
                    </button>
                    <button
                      onClick={() => dispatchSave('do_not_send')}
                      disabled={saving || !canSave}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium ${
                        isNremtTesting ? 'lg:py-4 lg:text-lg lg:min-h-[56px] lg:font-semibold' : ''
                      } ${
                        result === 'fail' ? 'bg-red-600 hover:bg-red-700' : result === 'remediation' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                      {gradeMode === 'team' ? `Submit Team (${teamMembers.length})` : `Submit Competency${studentName ? ` — ${studentName}` : ''}`}
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
        {nremtThresholdModals}
      </div>
    );
  }

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
              {sheet?.nremt_code && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 rounded align-middle">NREMT</span>
              )}
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
            onClick={onClose}
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
            {(mode === 'formative' || mode === 'final') && gradeMode === 'individual' && !studentId && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Select a student on the grading page first
              </p>
            )}
          </div>
        )}

        {/* Grade Mode Selector */}
        {gradeModeSelector}

        {/* Team Member Selector */}
        {teamMemberSelector}

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
                  labDayId={labDayId}
                  onSendResults={handleSendResults}
                  sendingResultsId={sendingResultsId}
                  sentResultsIds={sentResultsIds}
                  sendErrorId={sendErrorId}
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
                        {cfToText(cf)}
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

              {/* Steps — sequential (NREMT) or by phase */}
              {isSequential ? (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {sectionGroups.map((section, sIdx) => (
                      <div key={sIdx}>
                        {section.header && (
                          <div className={nremtSectionHeaderClass}>
                            {section.header}
                          </div>
                        )}
                        {section.steps.map(step => (
                          <PanelStepRow
                            key={step.id}
                            step={step}
                            mode={mode}
                            mark={stepMarks[step.step_number] || null}
                            onSetMark={(mark) => setStepMarkDirect(step.step_number, mark)}
                            sequenceNumber={stepSequence[step.step_number] ?? null}
                            onToggleComplete={() => toggleStepComplete(step.step_number)}
                            subItemChecks={subItemMarks[step.step_number]}
                            onSubItemToggle={(idx) => {
                              setSubItemMarks(prev => {
                                const current = prev[step.step_number] || new Array(step.sub_items?.length || 0).fill(false);
                                const next = [...current];
                                next[idx] = !next[idx];
                                return { ...prev, [step.step_number]: next };
                              });
                            }}
                            subItemNote={subItemNotes[step.step_number]}
                            onSubItemNoteChange={(note) => setSubItemNotes(prev => ({ ...prev, [step.step_number]: note }))}
                            isNremtTesting={isNremtTesting}
                            matchesCriticalFailure={criticalFailureStepNumbers.has(step.step_number)}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
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
                              <div key={step.id}>
                                {step.section_header && (
                                  <div className={nremtSectionHeaderClass}>
                                    {step.section_header}
                                  </div>
                                )}
                                <PanelStepRow
                                  step={step}
                                  mode={mode}
                                  mark={stepMarks[step.step_number] || null}
                                  onSetMark={(mark) => setStepMarkDirect(step.step_number, mark)}
                                  sequenceNumber={stepSequence[step.step_number] ?? null}
                                  onToggleComplete={() => toggleStepComplete(step.step_number)}
                                  subItemChecks={subItemMarks[step.step_number]}
                                  onSubItemToggle={(idx) => {
                                    setSubItemMarks(prev => {
                                      const current = prev[step.step_number] || new Array(step.sub_items?.length || 0).fill(false);
                                      const next = [...current];
                                      next[idx] = !next[idx];
                                      return { ...prev, [step.step_number]: next };
                                    });
                                  }}
                                  subItemNote={subItemNotes[step.step_number]}
                                  onSubItemNoteChange={(note) => setSubItemNotes(prev => ({ ...prev, [step.step_number]: note }))}
                                  isNremtTesting={isNremtTesting}
                                  matchesCriticalFailure={criticalFailureStepNumbers.has(step.step_number)}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

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
                        {cfToText(cf)}
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
                      onClick={() => dispatchSave('pending', 'in_progress')}
                      disabled={saving || !canSave}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      Finish Later
                    </button>
                    <button
                      onClick={() => dispatchSave('queued')}
                      disabled={saving || !canSave}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                      {gradeMode === 'team' ? `Save Team (${teamMembers.length})` : 'Save — Send Later'}
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => dispatchSave('sent')}
                        disabled={saving || sendingEmail || !canSave}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                      >
                        {sendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Save — Send Now
                      </button>
                      <button
                        onClick={() => dispatchSave('do_not_send')}
                        disabled={saving || !canSave}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        Do Not Send
                      </button>
                    </div>
                    {gradeMode === 'team' ? (
                      <p className="text-[10px] text-gray-400 text-center">
                        Saving for team: {teamMembers.map(m => m.student_name.split(',')[0]).join(', ')}
                      </p>
                    ) : studentName ? (
                      <p className="text-[10px] text-gray-400 text-center">
                        Saving for: {studentName}
                      </p>
                    ) : null}
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

                  {/* FIX 2: Hide notes/remediation on NREMT days — examiner panel handles notes */}
                  {!isNremtTesting && (
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
                  )}

                  <div className="space-y-2">
                    <button
                      onClick={() => dispatchSave('pending', 'in_progress')}
                      disabled={saving || !canSave}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      Finish Later
                    </button>
                    <button
                      onClick={() => dispatchSave('do_not_send')}
                      disabled={saving || !canSave}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium ${
                        result === 'fail'
                          ? 'bg-red-600 hover:bg-red-700'
                          : result === 'remediation'
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                      {gradeMode === 'team' ? `Submit Team (${teamMembers.length})` : `Submit Competency${studentName ? ` — ${studentName}` : ''}`}
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

      {nremtThresholdModals}

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
  subItemChecks,
  onSubItemToggle,
  subItemNote,
  onSubItemNoteChange,
  isNremtTesting = false,
  matchesCriticalFailure = false,
}: {
  step: Step;
  mode: DisplayMode;
  mark: StepMark;
  onSetMark: (mark: StepMark) => void;
  sequenceNumber?: number | null;
  onToggleComplete?: () => void;
  subItemChecks?: boolean[];
  onSubItemToggle?: (index: number) => void;
  subItemNote?: string;
  onSubItemNoteChange?: (note: string) => void;
  isNremtTesting?: boolean;
  matchesCriticalFailure?: boolean;
}) {
  // NREMT: highlight steps linked to critical failure criteria
  const highlightCriticalFail = isNremtTesting && matchesCriticalFailure;
  const criticalFailTextClass = highlightCriticalFail
    ? 'text-red-600 dark:text-red-400 font-medium'
    : '';
  const criticalFailDot = highlightCriticalFail ? (
    <span
      className="inline-block w-2 h-2 rounded-full bg-red-500 dark:bg-red-400 flex-shrink-0 mr-1.5"
      aria-label="Critical failure linked"
      title="Critical failure criterion — failing this step may result in a critical failure"
    />
  ) : null;
  // NREMT desktop styling classes — apply only at lg+ when NREMT testing
  const nremtRowPadding = isNremtTesting ? 'lg:px-4 lg:py-3' : '';
  const nremtInstructionText = isNremtTesting ? 'lg:text-[15px] lg:leading-relaxed' : '';
  const nremtBtnSize = isNremtTesting ? 'lg:w-11 lg:h-11 lg:min-h-[44px] lg:min-w-[44px]' : '';
  const nremtBtnIconSize = isNremtTesting ? 'lg:w-5 lg:h-5' : '';
  const isCritical = step.is_critical;
  const [noteExpanded, setNoteExpanded] = useState(false);
  const hasSubItems = step.sub_items && step.sub_items.length > 0;
  const possiblePts = effectivePossiblePoints(step);
  const isMultiPoint = possiblePts > 1 || hasSubItems;

  // Compute checked count for sub-items
  const checkedCount = subItemChecks ? subItemChecks.filter(Boolean).length : 0;

  // Detail notes tooltip helper
  const detailNotesIcon = step.detail_notes ? (
    <span className="text-gray-400 dark:text-gray-500 cursor-help flex-shrink-0" title={step.detail_notes}>
      <Info className="w-3 h-3" />
    </span>
  ) : null;

  // Partial indicator for sub-item groups
  const totalSubItems = step.sub_items?.length || 0;
  const isPartial = checkedCount > 0 && checkedCount < totalSubItems;
  const isAllChecked = checkedCount === totalSubItems && totalSubItems > 0;

  const partialBadge = hasSubItems && mode !== 'teaching' && checkedCount > 0 ? (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
      isAllChecked
        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    }`}>
      {isPartial ? `Partial (${checkedCount}/${totalSubItems})` : `${checkedCount}/${totalSubItems}`}
    </span>
  ) : null;

  // Sub-items rendering (for formative and final modes)
  // NREMT desktop: larger text, 44x44 tap targets, more row padding
  const subItemRowClass = isNremtTesting
    ? 'flex items-center gap-2 ml-6 py-0.5 cursor-pointer lg:gap-3 lg:ml-8 lg:px-4 lg:py-2 lg:min-h-[44px] lg:rounded-md lg:hover:bg-gray-50 lg:dark:hover:bg-gray-800/40'
    : 'flex items-center gap-2 ml-6 py-0.5 cursor-pointer';
  const subItemInputWrapClass = isNremtTesting
    ? 'flex items-center justify-center lg:p-2 lg:-m-2'
    : '';
  const subItemInputClass = isNremtTesting
    ? 'w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 lg:w-5 lg:h-5'
    : 'w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500';
  const subItemTextClass = isNremtTesting
    ? 'text-xs lg:text-[14px] lg:leading-relaxed'
    : 'text-xs';
  const subItemsBlock = hasSubItems && mode !== 'teaching' && onSubItemToggle ? (
    <div className="mt-1 space-y-0.5 lg:space-y-1">
      {step.sub_items!.map((item, i) => {
        const isChecked = subItemChecks ? subItemChecks[i] || false : false;
        return (
          <label key={i} className={subItemRowClass}>
            <span className={subItemInputWrapClass}>
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onSubItemToggle(i)}
                className={subItemInputClass}
              />
            </span>
            <span className={`${subItemTextClass} ${isChecked ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300'}`}>
              {item.label || item.description || String(item)}
            </span>
          </label>
        );
      })}
      {checkedCount > 0 && onSubItemNoteChange && (
        <div className="ml-6 mt-1">
          <input
            type="text"
            value={subItemNote || ''}
            onChange={(e) => onSubItemNoteChange(e.target.value)}
            placeholder="e.g., missed medications, last oral intake"
            className="w-full px-2 py-1 text-[10px] border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">Notes (optional)</span>
        </div>
      )}
    </div>
  ) : null;

  // Sub-items rendering for teaching mode (read-only list)
  const subItemsTeaching = hasSubItems && mode === 'teaching' ? (
    <div className="mt-1 space-y-0.5">
      {step.sub_items!.map((item, i) => (
        <div key={i} className="flex items-center gap-2 ml-6 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {item.label || item.description || String(item)}
          </span>
        </div>
      ))}
    </div>
  ) : null;

  // Point display for multi-point steps
  const pointsBadge = isMultiPoint && mode !== 'teaching' ? (
    <span className="flex items-center gap-1.5 flex-shrink-0">
      {partialBadge}
      <span className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
        {hasSubItems ? checkedCount : (mark === 'pass' ? possiblePts : 0)}/{possiblePts} pts
      </span>
    </span>
  ) : null;

  // Proctor prompt banner — shown after the step when it has been marked/completed
  const isStepCompleted = mode === 'formative'
    ? (hasSubItems ? checkedCount === possiblePts : sequenceNumber != null)
    : mark === 'pass' || mark === 'fail' || (hasSubItems && checkedCount > 0);
  const proctorPromptBanner = step.proctor_prompt && isStepCompleted ? (
    <div className="mx-1 mt-2 mb-1 rounded-lg border-2 border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/30 px-3 py-2.5 shadow-sm">
      <div className="flex items-start gap-2">
        <Megaphone className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300 mb-1">
            Proctor Prompt — Read to Candidate
          </p>
          <p className="text-xs text-amber-900 dark:text-amber-200 italic leading-relaxed">
            &ldquo;{step.proctor_prompt}&rdquo;
          </p>
        </div>
      </div>
    </div>
  ) : null;

  // Teaching mode proctor prompt (always visible since teaching is read-only reference)
  const teachingProctorPrompt = step.proctor_prompt ? (
    <div className="mx-1 mt-1 mb-1 rounded-lg border-2 border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/30 px-3 py-2.5 shadow-sm">
      <div className="flex items-start gap-2">
        <Megaphone className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300 mb-1">
            Proctor Prompt — Read to Candidate
          </p>
          <p className="text-xs text-amber-900 dark:text-amber-200 italic leading-relaxed">
            &ldquo;{step.proctor_prompt}&rdquo;
          </p>
        </div>
      </div>
    </div>
  ) : null;

  // Teaching mode - read-only
  if (mode === 'teaching') {
    return (
      <>
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
                {detailNotesIcon}
                {isMultiPoint && (
                  <span className="text-[10px] text-gray-400 flex-shrink-0 whitespace-nowrap">({possiblePts} pts)</span>
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
              {subItemsTeaching}
            </div>
          </div>
        </div>
        {teachingProctorPrompt}
      </>
    );
  }

  // ===== FORMATIVE NUMBERED COMPLETION =====
  // DO NOT REPLACE with pass/fail/caution icons.
  // Each step gets a single tap target that assigns a sequence number.
  // For multi-point steps with sub-items, use checkboxes instead.
  // This has been accidentally reverted 3 times — preserve this code.
  // ==========================================
  if (mode === 'formative') {
    const isComplete = hasSubItems ? checkedCount === possiblePts : sequenceNumber != null;
    return (
    <>
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
                  {detailNotesIcon}
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
              {/* For simple steps: numbered completion button. For sub-item steps: point badge */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {pointsBadge}
                {!hasSubItems && (
                  <>
                    {sequenceNumber != null && (
                      <span className="w-6 h-6 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {sequenceNumber}
                      </span>
                    )}
                    <button
                      onClick={onToggleComplete}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                        sequenceNumber != null
                          ? 'bg-green-500 text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-600'
                      }`}
                      title={sequenceNumber != null ? `Completed #${sequenceNumber} — tap to undo` : 'Mark as completed'}
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
            {subItemsBlock}
          </div>
        </div>
      </div>
      {proctorPromptBanner}
    </>
    );
  }

  // Final mode - pass/fail icons (for simple steps) or sub-item checkboxes (for multi-point)
  return (
    <>
      <div className={`px-3 py-2 ${nremtRowPadding} ${isCritical ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
        <div className="flex items-start gap-2">
          {criticalFailDot}
          <span className={`text-xs font-mono text-gray-400 mt-0.5 w-5 text-right flex-shrink-0 ${isNremtTesting ? 'lg:text-sm lg:w-7' : ''}`}>
            {step.step_number}.
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-1.5">
                  <p className={`text-xs ${criticalFailTextClass || 'text-gray-900 dark:text-white'} ${nremtInstructionText}`}>{step.instruction}</p>
                  {isCritical && (
                    <span className="flex-shrink-0 px-1 py-0.5 rounded text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30">
                      CRITICAL
                    </span>
                  )}
                  {detailNotesIcon}
                </div>
              </div>
              {/* Final mode: Pass/Fail buttons for simple steps, point badge for sub-item steps */}
              <div className="flex items-center gap-0.5 lg:gap-1.5 flex-shrink-0">
                {pointsBadge}
                {!hasSubItems && (
                  <>
                    <button
                      onClick={() => onSetMark('pass')}
                      className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${nremtBtnSize} ${
                        mark === 'pass'
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:bg-green-100 dark:hover:bg-green-900/30'
                      }`}
                      title="Pass"
                    >
                      <CheckCircle className={`w-3.5 h-3.5 ${nremtBtnIconSize}`} />
                    </button>
                    <button
                      onClick={() => onSetMark('fail')}
                      className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${nremtBtnSize} ${
                        mark === 'fail'
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                      }`}
                      title="Fail"
                    >
                      <XCircle className={`w-3.5 h-3.5 ${nremtBtnIconSize}`} />
                    </button>
                  </>
                )}
              </div>
            </div>
            {subItemsBlock}
          </div>
        </div>
      </div>
      {proctorPromptBanner}
    </>
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
  labDayId,
  onSendResults,
  sendingResultsId,
  sentResultsIds,
  sendErrorId,
}: {
  evaluations: ExistingEvaluation[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onEdit: (evalItem: ExistingEvaluation) => void;
  onNewAttempt: () => void;
  onDelete: (id: string) => void;
  confirmDeleteId: string | null;
  onConfirmDelete: (id: string) => Promise<void> | void;
  onCancelDelete: () => void;
  sheet: SkillSheet;
  labDayId?: string;
  onSendResults: (evalId: string) => void;
  sendingResultsId: string | null;
  sentResultsIds: Set<string>;
  sendErrorId: string | null;
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
        const rawMarks = ev.step_marks as Record<string, unknown> | null;

        // Handle both old format (string marks) and new format (object marks with points)
        let passedSteps = 0;
        let earnedPts = 0;
        let criticalPassed = 0;
        const isMultiPt = hasMultiPointScoring(sheet.steps);

        if (rawMarks) {
          for (const [key, val] of Object.entries(rawMarks)) {
            const stepNum = parseInt(key);
            const stepDef = sheet.steps.find(s => s.step_number === stepNum);
            if (typeof val === 'string') {
              // Old format
              if (val === 'pass') {
                passedSteps++;
                earnedPts += stepDef ? effectivePossiblePoints(stepDef) : 1;
                if (stepDef?.is_critical) criticalPassed++;
              }
            } else if (typeof val === 'object' && val !== null) {
              // New format
              const obj = val as { completed?: boolean; points?: number };
              if (obj.completed) {
                passedSteps++;
                if (stepDef?.is_critical) criticalPassed++;
              }
              earnedPts += obj.points || 0;
            }
          }
        }

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
                {isMultiPt ? (
                  <span>Points: {earnedPts}/{getTotalPossiblePoints(sheet.steps)} ({getTotalPossiblePoints(sheet.steps) > 0 ? Math.round((earnedPts / getTotalPossiblePoints(sheet.steps)) * 100) : 0}%)</span>
                ) : (
                  <span>Steps: {passedSteps}/{totalSteps}</span>
                )}
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
                    onClick={() => { void onConfirmDelete(ev.id); }}
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
                  {/* Send Results button — shown when email not yet sent */}
                  {labDayId && ev.email_status && ev.email_status !== 'sent' && ev.email_status !== 'do_not_send' && !sentResultsIds.has(ev.id) && (
                    <button
                      onClick={() => onSendResults(ev.id)}
                      disabled={sendingResultsId === ev.id}
                      className="px-2 py-1 border border-emerald-300 dark:border-emerald-600 rounded text-[10px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50"
                    >
                      <span className="flex items-center gap-1">
                        {sendingResultsId === ev.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Mail className="w-3 h-3" />
                        )}
                        {sendingResultsId === ev.id ? 'Sending...' : 'Send'}
                      </span>
                    </button>
                  )}
                  {sentResultsIds.has(ev.id) && (
                    <span className="px-2 py-1 rounded text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Sent
                      </span>
                    </span>
                  )}
                  {sendErrorId === ev.id && !sentResultsIds.has(ev.id) && (
                    <span className="text-[10px] text-red-500">Send failed</span>
                  )}
                </div>
              )}
            </div>

            {/* Expanded step details */}
            {isExpanded && ev.step_details && Array.isArray(ev.step_details) && (
              <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <div className="space-y-1">
                  {[...ev.step_details]
                    .sort((a, b) => (a.sequence_number || 999) - (b.sequence_number || 999))
                    .map((detail) => {
                      const stepDef = sheet.steps.find(s => s.step_number === detail.step_number);
                      const stepMarkVal = rawMarks?.[String(detail.step_number)];
                      const stepMarkObj = typeof stepMarkVal === 'object' && stepMarkVal !== null
                        ? stepMarkVal as { sub_items?: boolean[]; sub_item_notes?: string }
                        : null;
                      const hasStepSubItems = stepDef?.sub_items && stepDef.sub_items.length > 0;
                      const subChecked = stepMarkObj?.sub_items?.filter(Boolean).length || 0;
                      const subTotal = stepDef?.sub_items?.length || 0;
                      const isStepPartial = hasStepSubItems && subChecked > 0 && subChecked < subTotal;
                      const isStepComplete = hasStepSubItems && subChecked === subTotal && subTotal > 0;
                      return (
                      <div key={detail.step_number}>
                        <div className="flex items-center gap-2 text-[10px]">
                        {detail.completed ? (
                          <span className="w-4 h-4 rounded-full bg-green-600 text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0">
                            {detail.sequence_number}
                          </span>
                        ) : (
                          <span className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                        )}
                        <span className={`flex-1 ${detail.completed ? 'text-gray-500 line-through' : 'text-gray-900 dark:text-white'} ${detail.is_critical ? 'font-medium' : ''}`}>
                          {detail.step_number}. {stepDef?.instruction || `Step ${detail.step_number}`}
                        </span>
                        {hasStepSubItems && subChecked > 0 && (
                          <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${
                            isStepComplete
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : isStepPartial
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {subChecked}/{subTotal} sub-items
                          </span>
                        )}
                        {detail.is_critical && (
                          <span className="px-1 rounded text-[8px] font-bold text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400">C</span>
                        )}
                        </div>
                        {stepMarkObj?.sub_item_notes && (
                          <p className="ml-6 mt-0.5 text-[9px] italic text-gray-500 dark:text-gray-400">
                            {stepMarkObj.sub_item_notes}
                          </p>
                        )}
                      </div>
                      );
                    })}
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
                    const rawVal = (ev.step_marks as Record<string, unknown>)?.[String(step.step_number)];
                    const isObjMark = typeof rawVal === 'object' && rawVal !== null;
                    const objMark = isObjMark ? rawVal as { completed?: boolean; sub_items?: boolean[]; points?: number; sub_item_notes?: string } : null;
                    const mark = typeof rawVal === 'string' ? rawVal : (objMark?.completed ? 'pass' : null);
                    const hasStepSubItems = step.sub_items && step.sub_items.length > 0;
                    const subChecked = objMark?.sub_items?.filter(Boolean).length || 0;
                    const subTotal = step.sub_items?.length || 0;
                    const isStepPartial = hasStepSubItems && subChecked > 0 && subChecked < subTotal;
                    const isStepComplete = hasStepSubItems && subChecked === subTotal && subTotal > 0;
                    return (
                      <div key={step.step_number}>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[8px] ${
                            mark === 'pass' || isStepComplete ? 'bg-green-500 text-white' :
                            mark === 'fail' ? 'bg-red-500 text-white' :
                            mark === 'caution' || isStepPartial ? 'bg-amber-500 text-white' :
                            'bg-gray-200 dark:bg-gray-700'
                          }`}>
                            {mark === 'pass' || isStepComplete ? '\u2713' : mark === 'fail' ? '\u2717' : mark === 'caution' || isStepPartial ? '!' : ''}
                          </span>
                          <span className={`flex-1 ${step.is_critical ? 'font-medium' : ''}`}>
                            {step.step_number}. {step.instruction.substring(0, 60)}{step.instruction.length > 60 ? '...' : ''}
                          </span>
                          {hasStepSubItems && subChecked > 0 && (
                            <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${
                              isStepComplete
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            }`}>
                              {subChecked}/{subTotal} sub-items
                            </span>
                          )}
                        </div>
                        {objMark?.sub_item_notes && (
                          <p className="ml-6 mt-0.5 text-[9px] italic text-gray-500 dark:text-gray-400">
                            {objMark.sub_item_notes}
                          </p>
                        )}
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
