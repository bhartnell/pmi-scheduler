'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  Printer,
  FileText,
  Package,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Shield,
  Users,
  ClipboardCheck,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface AlternateSheet {
  id: string;
  skill_name: string;
  program: string;
  source: string;
  source_priority: number;
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
  alternate_sheets: AlternateSheet[];
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

interface LabDay {
  id: string;
  lab_date: string;
  title: string;
}

type DisplayMode = 'teaching' | 'formative' | 'final';
type StepMark = 'pass' | 'fail' | 'caution' | null;

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASE_ORDER = ['preparation', 'procedure', 'assessment', 'packaging'];

const PHASE_LABELS: Record<string, string> = {
  preparation: 'Preparation',
  procedure: 'Procedure',
  assessment: 'Assessment',
  packaging: 'Packaging',
};

const SOURCE_BADGE: Record<string, { label: string; bg: string; text: string; darkBg: string; darkText: string }> = {
  nremt: { label: 'NREMT', bg: 'bg-green-100', text: 'text-green-800', darkBg: 'dark:bg-green-900/40', darkText: 'dark:text-green-300' },
  platinum: { label: 'Platinum', bg: 'bg-purple-100', text: 'text-purple-800', darkBg: 'dark:bg-purple-900/40', darkText: 'dark:text-purple-300' },
  publisher: { label: 'Publisher', bg: 'bg-orange-100', text: 'text-orange-800', darkBg: 'dark:bg-orange-900/40', darkText: 'dark:text-orange-300' },
};

const PROGRAM_BADGE: Record<string, { label: string; bg: string; text: string; darkBg: string; darkText: string }> = {
  emt: { label: 'EMT', bg: 'bg-blue-100', text: 'text-blue-800', darkBg: 'dark:bg-blue-900/40', darkText: 'dark:text-blue-300' },
  aemt: { label: 'AEMT', bg: 'bg-teal-100', text: 'text-teal-800', darkBg: 'dark:bg-teal-900/40', darkText: 'dark:text-teal-300' },
  paramedic: { label: 'Paramedic', bg: 'bg-indigo-100', text: 'text-indigo-800', darkBg: 'dark:bg-indigo-900/40', darkText: 'dark:text-indigo-300' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupStepsByPhase(steps: Step[]): Record<string, Step[]> {
  const groups: Record<string, Step[]> = {};
  for (const step of steps) {
    const phase = step.phase || 'procedure';
    if (!groups[phase]) groups[phase] = [];
    groups[phase].push(step);
  }
  // Sort steps within each phase by step_number
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
  // Add any phases not in the predefined order
  for (const phase of Object.keys(groups)) {
    if (!ordered.includes(phase)) ordered.push(phase);
  }
  return ordered;
}

// ─── Inner Component ──────────────────────────────────────────────────────────

function SkillSheetDetailContent() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const sheetId = params.id as string;

  // Determine initial mode from query param
  const modeParam = searchParams.get('mode');
  const initialMode: DisplayMode =
    modeParam === 'formative' ? 'formative' :
    modeParam === 'final' ? 'final' :
    'teaching';

  const [sheet, setSheet] = useState<SkillSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<DisplayMode>(initialMode);

  // Collapsible phase sections (all expanded by default in teaching mode)
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());

  // Formative / Final state
  const [students, setStudents] = useState<Student[]>([]);
  const [labDays, setLabDays] = useState<LabDay[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedLabDayId, setSelectedLabDayId] = useState<string>('');
  const [stepMarks, setStepMarks] = useState<Record<number, StepMark>>({});
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<'pass' | 'fail' | 'remediation'>('pass');
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // ─── Data Fetching ────────────────────────────────────────────────────────

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [sessionStatus, router]);

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

  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch('/api/students?role=student');
      const data = await res.json();
      if (data.success && Array.isArray(data.students)) {
        setStudents(data.students);
      }
    } catch (err) {
      console.error('Failed to load students:', err);
    }
  }, []);

  const fetchLabDays = useCallback(async () => {
    try {
      const res = await fetch('/api/lab-management/lab-days?limit=20');
      const data = await res.json();
      if (data.success && Array.isArray(data.labDays)) {
        setLabDays(data.labDays);
      }
    } catch (err) {
      console.error('Failed to load lab days:', err);
    }
  }, []);

  useEffect(() => {
    if (session && sheetId) {
      fetchSheet();
    }
  }, [session, sheetId, fetchSheet]);

  useEffect(() => {
    if (session && (mode === 'formative' || mode === 'final')) {
      fetchStudents();
      fetchLabDays();
    }
  }, [session, mode, fetchStudents, fetchLabDays]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const togglePhase = (phase: string) => {
    setCollapsedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phase)) {
        next.delete(phase);
      } else {
        next.add(phase);
      }
      return next;
    });
  };

  const cycleStepMark = (stepNumber: number) => {
    if (mode === 'formative') {
      // Cycle: null -> pass -> fail -> caution -> null
      setStepMarks(prev => {
        const current = prev[stepNumber] || null;
        const nextMark: StepMark =
          current === null ? 'pass' :
          current === 'pass' ? 'fail' :
          current === 'fail' ? 'caution' :
          null;
        return { ...prev, [stepNumber]: nextMark };
      });
    } else if (mode === 'final') {
      // Toggle: null -> pass -> fail -> null
      setStepMarks(prev => {
        const current = prev[stepNumber] || null;
        const nextMark: StepMark =
          current === null ? 'pass' :
          current === 'pass' ? 'fail' :
          null;
        return { ...prev, [stepNumber]: nextMark };
      });
    }
  };

  const setStepMarkDirect = (stepNumber: number, mark: StepMark) => {
    setStepMarks(prev => ({
      ...prev,
      [stepNumber]: prev[stepNumber] === mark ? null : mark,
    }));
  };

  const toggleNoteExpand = (stepNumber: number) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(stepNumber)) {
        next.delete(stepNumber);
      } else {
        next.add(stepNumber);
      }
      return next;
    });
  };

  const resetForm = () => {
    setStepMarks({});
    setNotes('');
    setResult('pass');
    setSelectedStudentId('');
    setSelectedLabDayId('');
    setExpandedNotes(new Set());
  };

  const handleSave = async () => {
    if (!selectedStudentId) {
      showToast('Please select a student first', 'error');
      return;
    }

    if (mode === 'final' && result !== 'pass' && !notes.trim()) {
      showToast('Remediation plan is required for non-pass results', 'error');
      return;
    }

    // Build flagged items
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
          student_id: selectedStudentId,
          lab_day_id: selectedLabDayId || null,
          evaluation_type: evaluationType,
          result: evaluationResult,
          notes: notes.trim() || null,
          flagged_items: flaggedItems,
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
        // Reset for next student
        setStepMarks({});
        setNotes('');
        setResult('pass');
        setSelectedStudentId('');
        setExpandedNotes(new Set());
      } else {
        showToast(data.error || 'Failed to save evaluation', 'error');
      }
    } catch (err) {
      console.error('Failed to save evaluation:', err);
      showToast('Failed to save evaluation', 'error');
    }
    setSaving(false);
    setShowConfirmDialog(false);
  };

  const handleFinalSubmit = () => {
    if (!selectedStudentId) {
      showToast('Please select a student first', 'error');
      return;
    }
    if (result !== 'pass' && !notes.trim()) {
      showToast('Remediation plan is required for non-pass results', 'error');
      return;
    }
    // Show confirmation for fail with critical failures
    if (result === 'fail' && sheet?.critical_failures && sheet.critical_failures.length > 0) {
      setShowConfirmDialog(true);
      return;
    }
    handleSave();
  };

  const handleModeChange = (newMode: DisplayMode) => {
    setMode(newMode);
    // Update URL without full navigation
    const url = new URL(window.location.href);
    if (newMode === 'teaching') {
      url.searchParams.delete('mode');
    } else {
      url.searchParams.set('mode', newMode === 'final' ? 'final' : 'formative');
    }
    window.history.replaceState({}, '', url.toString());
  };

  // ─── Render States ────────────────────────────────────────────────────────

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 dark:text-blue-400" />
          <p className="text-gray-600 dark:text-gray-400 text-sm">Loading skill sheet...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Error Loading Skill Sheet</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchSheet}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!session || !sheet) return null;

  const stepsByPhase = groupStepsByPhase(sheet.steps);
  const orderedPhases = getOrderedPhases(stepsByPhase);
  const sourceBadge = SOURCE_BADGE[sheet.source] || SOURCE_BADGE.publisher;
  const programBadge = PROGRAM_BADGE[sheet.program] || PROGRAM_BADGE.emt;
  const showGapWarning = sheet.source === 'publisher' && (sheet.program === 'paramedic' || sheet.program === 'aemt');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transition-all ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Confirm Fail Result</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This skill has critical failure criteria. Are you sure you want to record a Fail?
              This will be permanently recorded in the student&apos;s competency record.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Fail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          body { background: white !important; }
          .min-h-screen { min-height: auto !important; background: white !important; }
        }
      `}</style>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm no-print">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3.5 h-3.5" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/skill-sheets" className="hover:text-blue-600 dark:hover:text-blue-400">
              Skill Sheets
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white font-medium truncate max-w-[200px]">
              {sheet.skill_name}
            </span>
          </nav>

          {/* Title & Badges */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {sheet.skill_name}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${sourceBadge.bg} ${sourceBadge.text} ${sourceBadge.darkBg} ${sourceBadge.darkText}`}>
                  <Shield className="w-3 h-3" />
                  {sourceBadge.label}
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${programBadge.bg} ${programBadge.text} ${programBadge.darkBg} ${programBadge.darkText}`}>
                  {programBadge.label}
                </span>
                {sheet.platinum_skill_type && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">
                    {sheet.platinum_skill_type}
                  </span>
                )}
              </div>
            </div>

            {/* Print button */}
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors self-start"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>

          {/* Canonical skill info */}
          {sheet.canonical_skill && sheet.canonical_skill.scope_notes && (
            <div className="mt-3 flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <p>{sheet.canonical_skill.scope_notes}</p>
                {sheet.canonical_skill.programs && sheet.canonical_skill.programs.length > 1 && (
                  <p className="mt-1 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    Applies to: {sheet.canonical_skill.programs.map(p => (PROGRAM_BADGE[p]?.label || p.toUpperCase())).join(', ')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Gap warning */}
          {showGapWarning && (
            <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Internal sheet recommended &mdash; Platinum sheet not available
              </p>
            </div>
          )}

          {/* Source toggle for alternate sheets */}
          {sheet.alternate_sheets && sheet.alternate_sheets.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Source:</span>
              <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                {/* Current sheet */}
                <button
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white"
                  disabled
                >
                  {SOURCE_BADGE[sheet.source]?.label || sheet.source.toUpperCase()}
                </button>
                {/* Alternates */}
                {sheet.alternate_sheets.map(alt => {
                  const altBadge = SOURCE_BADGE[alt.source] || SOURCE_BADGE.publisher;
                  return (
                    <Link
                      key={alt.id}
                      href={`/skill-sheets/${alt.id}${mode !== 'teaching' ? `?mode=${mode === 'final' ? 'final' : 'formative'}` : ''}`}
                      className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border-l border-gray-300 dark:border-gray-600 transition-colors"
                    >
                      {altBadge.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Mode Toggle */}
          <div className="mt-4 inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
            {([
              { key: 'teaching' as const, label: 'Teaching', icon: FileText },
              { key: 'formative' as const, label: 'Formative', icon: ClipboardCheck },
              { key: 'final' as const, label: 'Final Competency', icon: Shield },
            ]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => handleModeChange(key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                  mode === key
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                } ${key !== 'teaching' ? 'border-l border-gray-300 dark:border-gray-600' : ''}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Student / Lab Day selectors for formative & final modes */}
        {(mode === 'formative' || mode === 'final') && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 no-print">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Student <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedStudentId}
                  onChange={e => setSelectedStudentId(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a student...</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.last_name}, {s.first_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Lab Day <span className="text-gray-400">(optional)</span>
                </label>
                <select
                  value={selectedLabDayId}
                  onChange={e => setSelectedLabDayId(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">No lab day selected</option>
                  {labDays.map(ld => (
                    <option key={ld.id} value={ld.id}>
                      {ld.title} ({new Date(ld.lab_date + 'T00:00:00').toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Critical Failures box - shown FIRST in Final mode */}
        {mode === 'final' && sheet.critical_failures && sheet.critical_failures.length > 0 && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 shadow-sm p-4">
            <h3 className="flex items-center gap-2 text-base font-semibold text-red-800 dark:text-red-300 mb-3">
              <XCircle className="w-5 h-5" />
              Critical Failure Criteria
            </h3>
            <ul className="space-y-2">
              {sheet.critical_failures.map((cf, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                  {cf}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Overview (teaching mode only) */}
        {mode === 'teaching' && sheet.overview && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">{sheet.overview}</p>
          </div>
        )}

        {/* Equipment list (teaching mode) */}
        {mode === 'teaching' && sheet.equipment && sheet.equipment.length > 0 && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
            <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white mb-3">
              <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Equipment Required
            </h3>
            <div className="flex flex-wrap gap-2">
              {sheet.equipment.map((item, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Steps by Phase */}
        <div className="space-y-4">
          {orderedPhases.map(phase => {
            const phaseSteps = stepsByPhase[phase];
            const isCollapsed = collapsedPhases.has(phase);
            const phaseLabel = PHASE_LABELS[phase] || phase.charAt(0).toUpperCase() + phase.slice(1);

            return (
              <div
                key={phase}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
              >
                {/* Phase Header */}
                <button
                  onClick={() => togglePhase(phase)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-750 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors no-print"
                >
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                    {phaseLabel}
                    <span className="ml-2 text-gray-400 dark:text-gray-500 font-normal normal-case tracking-normal">
                      ({phaseSteps.length} step{phaseSteps.length !== 1 ? 's' : ''})
                    </span>
                  </h3>
                  {isCollapsed ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {/* Print: always show phase header */}
                <div className="hidden print:block px-4 py-2 bg-gray-50 border-b">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                    {phaseLabel}
                  </h3>
                </div>

                {/* Steps */}
                {!isCollapsed && (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {phaseSteps.map(step => (
                      <StepRow
                        key={step.id}
                        step={step}
                        mode={mode}
                        mark={stepMarks[step.step_number] || null}
                        onCycleMark={() => cycleStepMark(step.step_number)}
                        onSetMark={(mark) => setStepMarkDirect(step.step_number, mark)}
                        noteExpanded={expandedNotes.has(step.step_number)}
                        onToggleNote={() => toggleNoteExpand(step.step_number)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Critical Criteria (teaching mode) */}
        {mode === 'teaching' && sheet.critical_criteria && sheet.critical_criteria.length > 0 && (
          <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 shadow-sm p-4">
            <h3 className="flex items-center gap-2 text-base font-semibold text-amber-800 dark:text-amber-300 mb-3">
              <AlertTriangle className="w-5 h-5" />
              Critical Criteria
            </h3>
            <ul className="space-y-2">
              {sheet.critical_criteria.map((cc, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                  {cc}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Critical Failures (teaching mode) */}
        {mode === 'teaching' && sheet.critical_failures && sheet.critical_failures.length > 0 && (
          <div className="mt-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 shadow-sm p-4">
            <h3 className="flex items-center gap-2 text-base font-semibold text-red-800 dark:text-red-300 mb-3">
              <XCircle className="w-5 h-5" />
              Critical Failures
            </h3>
            <ul className="space-y-2">
              {sheet.critical_failures.map((cf, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                  {cf}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Notes (teaching mode) */}
        {mode === 'teaching' && sheet.notes && (
          <div className="mt-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
            <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white mb-2">
              <FileText className="w-5 h-5 text-gray-500" />
              Notes
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{sheet.notes}</p>
          </div>
        )}

        {/* Bottom Action Area -- Formative */}
        {mode === 'formative' && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 no-print">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Quick Notes</h3>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add observation notes for this formative evaluation..."
              rows={3}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={resetForm}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !selectedStudentId}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Formative
              </button>
            </div>
          </div>
        )}

        {/* Bottom Action Area -- Final Competency */}
        {mode === 'final' && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 no-print">
            {/* Result Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Result
              </label>
              <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                {([
                  { key: 'pass' as const, label: 'Pass', color: 'bg-green-600' },
                  { key: 'fail' as const, label: 'Fail', color: 'bg-red-600' },
                  { key: 'remediation' as const, label: 'Remediation', color: 'bg-amber-600' },
                ]).map(({ key, label, color }) => (
                  <button
                    key={key}
                    onClick={() => setResult(key)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
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

            {/* Notes / Remediation Plan */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {result !== 'pass' ? (
                  <>Remediation Plan <span className="text-red-500">* Required</span></>
                ) : (
                  'Notes'
                )}
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={result !== 'pass' ? 'Describe the remediation plan...' : 'Add notes about this competency evaluation...'}
                rows={3}
                required={result !== 'pass'}
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
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              <button
                onClick={handleFinalSubmit}
                disabled={saving || !selectedStudentId}
                className={`flex items-center gap-2 px-6 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium ${
                  result === 'fail'
                    ? 'bg-red-600 hover:bg-red-700'
                    : result === 'remediation'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                Submit Competency
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step Row Component ───────────────────────────────────────────────────────

interface StepRowProps {
  step: Step;
  mode: DisplayMode;
  mark: StepMark;
  onCycleMark: () => void;
  onSetMark: (mark: StepMark) => void;
  noteExpanded: boolean;
  onToggleNote: () => void;
}

function StepRow({ step, mode, mark, onCycleMark, onSetMark, noteExpanded, onToggleNote }: StepRowProps) {
  const isCritical = step.is_critical;

  // Teaching mode
  if (mode === 'teaching') {
    return (
      <div className={`px-4 py-3 ${isCritical ? 'border-l-4 border-red-500' : ''}`}>
        <div className="flex items-start gap-3">
          <span className="text-sm font-mono text-gray-400 dark:text-gray-500 mt-0.5 w-6 text-right flex-shrink-0">
            {step.step_number}.
          </span>
          <div className="flex-1">
            <div className="flex items-start gap-2">
              <p className="text-sm text-gray-900 dark:text-white">{step.instruction}</p>
              {isCritical && (
                <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30">
                  CRITICAL
                </span>
              )}
            </div>
            {step.detail_notes && (
              <p className="mt-1 text-xs italic text-gray-500 dark:text-gray-400">{step.detail_notes}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Formative mode
  if (mode === 'formative') {
    return (
      <div className={`px-4 py-3 ${isCritical ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
        <div className="flex items-start gap-3">
          <span className="text-sm font-mono text-gray-400 dark:text-gray-500 mt-0.5 w-6 text-right flex-shrink-0">
            {step.step_number}.
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <p className="text-sm text-gray-900 dark:text-white">{step.instruction}</p>
                  {isCritical && (
                    <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30">
                      CRITICAL
                    </span>
                  )}
                </div>
                {step.detail_notes && (
                  <button
                    onClick={onToggleNote}
                    className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {noteExpanded ? 'Hide notes' : 'Show notes'}
                  </button>
                )}
                {step.detail_notes && noteExpanded && (
                  <p className="mt-1 text-xs italic text-gray-500 dark:text-gray-400">{step.detail_notes}</p>
                )}
              </div>
              {/* Three-state buttons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onSetMark('pass')}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    mark === 'pass'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-green-100 dark:hover:bg-green-900/30'
                  }`}
                  title="Pass"
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onSetMark('fail')}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    mark === 'fail'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-red-100 dark:hover:bg-red-900/30'
                  }`}
                  title="Fail"
                >
                  <XCircle className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onSetMark('caution')}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    mark === 'caution'
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                  }`}
                  title="Caution"
                >
                  <AlertTriangle className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Final competency mode
  return (
    <div className={`px-4 py-3 ${isCritical ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="text-sm font-mono text-gray-400 dark:text-gray-500 mt-0.5 w-6 text-right flex-shrink-0">
          {step.step_number}.
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <p className="text-sm text-gray-900 dark:text-white">{step.instruction}</p>
                {isCritical && (
                  <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30">
                    CRITICAL
                  </span>
                )}
              </div>
              {step.detail_notes && (
                <button
                  onClick={onToggleNote}
                  className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {noteExpanded ? 'Hide notes' : 'Show notes'}
                </button>
              )}
              {step.detail_notes && noteExpanded && (
                <p className="mt-1 text-xs italic text-gray-500 dark:text-gray-400">{step.detail_notes}</p>
              )}
            </div>
            {/* Pass / Fail toggle */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => onSetMark('pass')}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  mark === 'pass'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-green-100 dark:hover:bg-green-900/30'
                }`}
                title="Pass"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
              <button
                onClick={() => onSetMark('fail')}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  mark === 'fail'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-red-100 dark:hover:bg-red-900/30'
                }`}
                title="Fail"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page Export with Suspense ─────────────────────────────────────────────────

export default function SkillSheetDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 dark:text-blue-400" />
          <p className="text-gray-600 dark:text-gray-400 text-sm">Loading skill sheet...</p>
        </div>
      </div>
    }>
      <SkillSheetDetailContent />
    </Suspense>
  );
}
