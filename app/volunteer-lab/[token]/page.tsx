'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Users,
  Shield,
  Save,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TokenInfo {
  id: string;
  volunteer_name: string;
  role: string;
  valid_until: string;
}

interface Station {
  id: string;
  station_number: number;
  station_type: string;
  skill_name: string | null;
  custom_title: string | null;
  room: string | null;
  notes: string | null;
  skill_sheet_url: string | null;
  metadata: Record<string, unknown> | null;
  skill_sheet: {
    id: string;
    skill_name: string;
    category: string | null;
    source: string | null;
    steps_json: StepData[] | null;
  } | null;
}

interface StepData {
  id?: string;
  step_number?: number;
  phase?: string;
  instruction?: string;
  is_critical?: boolean;
  detail_notes?: string | null;
  possible_points?: number | null;
  sub_items?: { label?: string; description?: string }[] | null;
  section_header?: string | null;
}

interface LabDay {
  id: string;
  date: string;
  title: string;
  cohort: { id: string; cohort_number: number } | null;
}

interface Student {
  id: string;
  name: string;
}

type StepMark = 'pass' | 'fail' | 'caution' | null;

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function VolunteerLabPage() {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [labDay, setLabDay] = useState<LabDay | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  // Grading state
  const [gradingStation, setGradingStation] = useState<Station | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [stepMarks, setStepMarks] = useState<Record<string, StepMark>>({});
  const [evalResult, setEvalResult] = useState<'pass' | 'fail' | 'remediation' | ''>('');
  const [evalNotes, setEvalNotes] = useState('');
  const [evalType, setEvalType] = useState<'formative' | 'final_competency'>('formative');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validateToken = useCallback(async () => {
    try {
      const res = await fetch(`/api/volunteer/lab-tokens/${token}`);
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Invalid access link');
        return;
      }

      setTokenInfo(data.token);
      setLabDay(data.lab_day);
      setStations(data.stations || []);
      setStudents(data.students || []);
    } catch {
      setError('Failed to validate access link. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) validateToken();
  }, [token, validateToken]);

  // ─── Grading Handlers ───────────────────────────────────────────────────

  const openGrading = (station: Station) => {
    setGradingStation(station);
    setSelectedStudent('');
    setStepMarks({});
    setEvalResult('');
    setEvalNotes('');
    setEvalType('formative');
    setSubmitSuccess(null);
    setSubmitError(null);
  };

  const closeGrading = () => {
    setGradingStation(null);
  };

  const toggleStepMark = (stepId: string) => {
    setStepMarks((prev) => {
      const current = prev[stepId];
      // Cycle: null -> pass -> fail -> caution -> null
      const next: StepMark =
        current === null || current === undefined
          ? 'pass'
          : current === 'pass'
            ? 'fail'
            : current === 'fail'
              ? 'caution'
              : null;
      return { ...prev, [stepId]: next };
    });
  };

  const submitEvaluation = async () => {
    if (!gradingStation?.skill_sheet || !selectedStudent || !evalResult) return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const res = await fetch(`/api/volunteer/lab-tokens/${token}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill_sheet_id: gradingStation.skill_sheet.id,
          student_id: selectedStudent,
          evaluation_type: evalType,
          result: evalResult,
          notes: evalNotes || undefined,
          station_id: gradingStation.id,
          step_marks: Object.keys(stepMarks).length > 0 ? stepMarks : undefined,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setSubmitError(data.error || 'Failed to save evaluation');
        return;
      }

      const studentName = students.find((s) => s.id === selectedStudent)?.name || 'Student';
      setSubmitSuccess(`Evaluation saved for ${studentName}`);

      // Reset form for next student
      setSelectedStudent('');
      setStepMarks({});
      setEvalResult('');
      setEvalNotes('');
    } catch {
      setSubmitError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-gray-600">Validating access link...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">
            If you believe this is an error, please contact the program administrator.
          </p>
        </div>
      </div>
    );
  }

  if (!tokenInfo || !labDay) return null;

  const timeRemaining = getTimeRemaining(tokenInfo.valid_until);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                {labDay.title || 'Lab Day'}
              </h1>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span>
                  {new Date(labDay.date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                {labDay.cohort && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Cohort {labDay.cohort.cohort_number}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-700">
                {tokenInfo.volunteer_name}
              </p>
              <p className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                <Clock className="h-3 w-3" />
                {timeRemaining}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Grading Panel */}
        {gradingStation ? (
          <GradingPanel
            station={gradingStation}
            students={students}
            selectedStudent={selectedStudent}
            setSelectedStudent={setSelectedStudent}
            stepMarks={stepMarks}
            toggleStepMark={toggleStepMark}
            evalType={evalType}
            setEvalType={setEvalType}
            evalResult={evalResult}
            setEvalResult={setEvalResult}
            evalNotes={evalNotes}
            setEvalNotes={setEvalNotes}
            submitting={submitting}
            submitSuccess={submitSuccess}
            submitError={submitError}
            onSubmit={submitEvaluation}
            onClose={closeGrading}
          />
        ) : (
          /* Station List */
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-blue-600" />
              Stations
            </h2>
            {stations.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
                No stations configured for this lab day.
              </div>
            ) : (
              stations
                .sort((a, b) => a.station_number - b.station_number)
                .map((station) => (
                  <div
                    key={station.id}
                    className="bg-white rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          Station {station.station_number}
                          {station.custom_title
                            ? `: ${station.custom_title}`
                            : station.skill_name
                              ? `: ${station.skill_name}`
                              : ''}
                        </h3>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                          {station.room && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {station.room}
                            </span>
                          )}
                          {station.station_type && (
                            <span className="capitalize">{station.station_type}</span>
                          )}
                        </div>
                      </div>
                      {station.skill_sheet && (
                        <button
                          onClick={() => openGrading(station)}
                          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                        >
                          <ClipboardCheck className="h-4 w-4" />
                          Grade Students
                        </button>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Grading Panel ──────────────────────────────────────────────────────────

interface GradingPanelProps {
  station: Station;
  students: Student[];
  selectedStudent: string;
  setSelectedStudent: (id: string) => void;
  stepMarks: Record<string, StepMark>;
  toggleStepMark: (stepId: string) => void;
  evalType: 'formative' | 'final_competency';
  setEvalType: (t: 'formative' | 'final_competency') => void;
  evalResult: 'pass' | 'fail' | 'remediation' | '';
  setEvalResult: (r: 'pass' | 'fail' | 'remediation' | '') => void;
  evalNotes: string;
  setEvalNotes: (n: string) => void;
  submitting: boolean;
  submitSuccess: string | null;
  submitError: string | null;
  onSubmit: () => void;
  onClose: () => void;
}

function GradingPanel({
  station,
  students,
  selectedStudent,
  setSelectedStudent,
  stepMarks,
  toggleStepMark,
  evalType,
  setEvalType,
  evalResult,
  setEvalResult,
  evalNotes,
  setEvalNotes,
  submitting,
  submitSuccess,
  submitError,
  onSubmit,
  onClose,
}: GradingPanelProps) {
  const sheet = station.skill_sheet;
  const steps: StepData[] = sheet?.steps_json || [];
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});

  // Group steps by phase
  const phaseGroups = groupStepsByPhase(steps);
  const orderedPhases = getOrderedPhases(phaseGroups);

  const togglePhase = (phase: string) => {
    setExpandedPhases((prev) => ({ ...prev, [phase]: !prev[phase] }));
  };

  // Auto-expand all phases on mount
  useEffect(() => {
    const expanded: Record<string, boolean> = {};
    for (const phase of orderedPhases) {
      expanded[phase] = true;
    }
    setExpandedPhases(expanded);
  }, [station.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute summary
  const totalSteps = steps.length;
  const markedPass = Object.values(stepMarks).filter((m) => m === 'pass').length;
  const markedFail = Object.values(stepMarks).filter((m) => m === 'fail').length;
  const markedCaution = Object.values(stepMarks).filter((m) => m === 'caution').length;
  const criticalFails = steps.filter(
    (s) => s.is_critical && stepMarks[s.id || `step-${s.step_number}`] === 'fail'
  ).length;

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onClose}
        className="text-sm text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-1"
      >
        &larr; Back to stations
      </button>

      {/* Station header */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <h2 className="text-lg font-bold text-gray-900">
          Station {station.station_number}: {station.skill_name || station.custom_title}
        </h2>
        {sheet && (
          <p className="text-sm text-gray-500 mt-1">
            Skill Sheet: {sheet.skill_name}
            {sheet.source && (
              <span className="ml-2 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                {sheet.source.toUpperCase()}
              </span>
            )}
          </p>
        )}
      </div>

      {/* Student selection */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Student
        </label>
        <select
          value={selectedStudent}
          onChange={(e) => setSelectedStudent(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Choose a student...</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Evaluation type */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Evaluation Type
        </label>
        <div className="flex gap-3">
          <button
            onClick={() => setEvalType('formative')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              evalType === 'formative'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Formative
          </button>
          <button
            onClick={() => setEvalType('final_competency')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              evalType === 'final_competency'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Final Competency
          </button>
        </div>
      </div>

      {/* Skill sheet steps */}
      {steps.length > 0 && selectedStudent && (
        <div className="bg-white rounded-lg border border-gray-200 mb-4">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Skill Steps</h3>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  {markedPass}
                </span>
                <span className="flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-500" />
                  {markedFail}
                </span>
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  {markedCaution}
                </span>
                <span>
                  {markedPass + markedFail + markedCaution}/{totalSteps}
                </span>
              </div>
            </div>
            {criticalFails > 0 && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <Shield className="h-3 w-3" />
                {criticalFails} critical failure(s)
              </p>
            )}
          </div>

          {orderedPhases.map((phase) => (
            <div key={phase}>
              <button
                onClick={() => togglePhase(phase)}
                className="w-full px-4 py-2 flex items-center justify-between bg-gray-50 text-sm font-medium text-gray-700 hover:bg-gray-100 border-b border-gray-200"
              >
                <span className="capitalize">{phase}</span>
                {expandedPhases[phase] ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {expandedPhases[phase] && (
                <div className="divide-y divide-gray-100">
                  {(phaseGroups[phase] || []).map((step) => {
                    const stepId = step.id || `step-${step.step_number}`;
                    const mark = stepMarks[stepId] || null;

                    return (
                      <button
                        key={stepId}
                        onClick={() => toggleStepMark(stepId)}
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 transition ${
                          mark === 'pass'
                            ? 'bg-green-50'
                            : mark === 'fail'
                              ? 'bg-red-50'
                              : mark === 'caution'
                                ? 'bg-amber-50'
                                : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {mark === 'pass' ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : mark === 'fail' ? (
                            <XCircle className="h-5 w-5 text-red-600" />
                          ) : mark === 'caution' ? (
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">
                            {step.is_critical && (
                              <Shield className="h-3 w-3 text-red-500 inline mr-1" />
                            )}
                            {step.instruction || `Step ${step.step_number}`}
                          </p>
                          {step.detail_notes && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {step.detail_notes}
                            </p>
                          )}
                          {step.possible_points != null && (
                            <span className="text-xs text-gray-400">
                              {step.possible_points} pt{step.possible_points !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Result + Notes */}
      {selectedStudent && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Result
            </label>
            <div className="flex gap-3">
              {(['pass', 'fail', 'remediation'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setEvalResult(r)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                    evalResult === r
                      ? r === 'pass'
                        ? 'bg-green-600 text-white'
                        : r === 'fail'
                          ? 'bg-red-600 text-white'
                          : 'bg-amber-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {r === 'pass' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : r === 'fail' ? (
                    <XCircle className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  <span className="capitalize">{r}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={evalNotes}
              onChange={(e) => setEvalNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Add any observations or notes..."
            />
          </div>

          {/* Submit */}
          {submitSuccess && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              <CheckCircle className="h-4 w-4" />
              {submitSuccess}
            </div>
          )}
          {submitError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              {submitError}
            </div>
          )}

          <button
            onClick={onSubmit}
            disabled={submitting || !selectedStudent || !evalResult}
            className="w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Evaluation
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function groupStepsByPhase(steps: StepData[]): Record<string, StepData[]> {
  const groups: Record<string, StepData[]> = {};
  for (const step of steps) {
    const phase = step.phase || 'procedure';
    if (!groups[phase]) groups[phase] = [];
    groups[phase].push(step);
  }
  for (const phase of Object.keys(groups)) {
    groups[phase].sort(
      (a, b) => (a.step_number || 0) - (b.step_number || 0)
    );
  }
  return groups;
}

const PHASE_ORDER = ['preparation', 'procedure', 'assessment', 'packaging'];

function getOrderedPhases(groups: Record<string, StepData[]>): string[] {
  const ordered: string[] = [];
  for (const phase of PHASE_ORDER) {
    if (groups[phase]) ordered.push(phase);
  }
  for (const phase of Object.keys(groups)) {
    if (!ordered.includes(phase)) ordered.push(phase);
  }
  return ordered;
}

function getTimeRemaining(validUntil: string): string {
  const diff = new Date(validUntil).getTime() - Date.now();
  if (diff <= 0) return 'Expired';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}
