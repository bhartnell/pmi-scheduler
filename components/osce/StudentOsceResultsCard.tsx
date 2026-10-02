'use client';

import { useEffect, useState, useCallback } from 'react';
import { ClipboardCheck, Loader2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface EvaluatorResult {
  evaluator_name: string;
  evaluator_role: string | null;
  submitted_at: string | null;
  readiness: string | null;
  concerns_notes: string | null;
  general_notes: string | null;
  s_count: number;
  u_count: number;
  phase1_pass: boolean;
  snhd_grade: number | null;
  factors: Record<string, { rating: string | null; notes: string | null }>;
  oral: Record<string, string | null>;
}

interface AssessmentResult {
  id: string;
  student_name: string;
  scenario: string;
  slot_number: number | null;
  day_number: number | null;
  assessment_date: string;
  evaluators: EvaluatorResult[];
  evaluator_count: number;
  submitted_count: number;
  match_confidence: 'exact' | 'surname_unique' | 'surname_ambiguous' | null;
}

const FACTOR_LABELS: Record<string, string> = {
  scene_safety: 'Scene Safety',
  initial_assessment: 'Initial Assessment',
  history_cc: 'History/CC',
  physical_exam_vs: 'Physical Exam/VS',
  protocol_treatment: 'Protocol/Treatment',
  affective_domain: 'Affective Domain',
  communication: 'Communication',
  skills_overall: 'Skills/Overall',
};

const ORAL_LABELS: Record<string, string> = {
  prioritization: 'Prioritization',
  differential: 'Differential',
  decision_defense: 'Decision Defense',
  reassessment: 'Reassessment',
  transport_handoff: 'Transport/Handoff',
};

function RatingBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-gray-300 dark:text-gray-600">--</span>;
  const colors: Record<string, string> = {
    S: 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/40',
    N: 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40',
    U: 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/40',
  };
  return <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${colors[value] || ''}`}>{value}</span>;
}

function ReadinessLabel({ value }: { value: string | null }) {
  if (!value) return <span className="text-gray-400">--</span>;
  const map: Record<string, { label: string; color: string }> = {
    ready: { label: 'Ready', color: 'text-green-600 dark:text-green-400' },
    ready_with_concerns: { label: 'Concerns', color: 'text-amber-600 dark:text-amber-400' },
    not_yet_ready: { label: 'Not Ready', color: 'text-red-600 dark:text-red-400' },
  };
  const entry = map[value];
  return <span className={`font-medium ${entry?.color || ''}`}>{entry?.label || value}</span>;
}

/**
 * Surfaces this student's OSCE assessment results (all evaluators, never
 * averaged) outside the OSCE module. Matching osce_assessments.student_name
 * to this student is done live/read-only (see lib/osce-student-match.ts) —
 * nothing here writes a confirmed link back to the database.
 */
export default function StudentOsceResultsCard({ studentId }: { studentId: string }) {
  const [results, setResults] = useState<AssessmentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch(`/api/osce/student-results?student_id=${studentId}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [studentId]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (results.length === 0) return null;

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
        <ClipboardCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        OSCE Results
      </h2>
      <div className="space-y-3">
        {results.map(r => (
          <div key={r.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => toggle(r.id)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded font-bold text-xs shrink-0">
                  Scenario {r.scenario}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                  Day {r.day_number ?? '?'} &middot; {r.assessment_date}
                </span>
                {r.match_confidence === 'surname_ambiguous' && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Unconfirmed match &mdash; verify identity
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {r.submitted_count}/{r.evaluator_count} evaluator{r.evaluator_count !== 1 ? 's' : ''} submitted
                </span>
                {expanded.has(r.id) ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </button>

            {expanded.has(r.id) && (
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 space-y-4">
                {r.evaluators.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No evaluator scores yet.</p>
                ) : (
                  r.evaluators.map((ev, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 dark:text-white">{ev.evaluator_name}</span>
                          {ev.evaluator_role && (
                            <span className="text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded">
                              {ev.evaluator_role}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className={`font-medium ${ev.phase1_pass ? 'text-green-600' : 'text-red-600'}`}>
                            Phase 1: {ev.phase1_pass ? 'PASS' : 'FAIL'}
                          </span>
                          {ev.snhd_grade !== null && <span className="text-gray-500">Grade: {ev.snhd_grade.toFixed(1)}%</span>}
                          <ReadinessLabel value={ev.readiness} />
                        </div>
                      </div>

                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-3">
                        {Object.entries(FACTOR_LABELS).map(([key, label]) => (
                          <div key={key} className="text-center">
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1 truncate" title={label}>{label}</p>
                            <RatingBadge value={ev.factors[key]?.rating ?? null} />
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-5 gap-2 mb-3">
                        {Object.entries(ORAL_LABELS).map(([key, label]) => (
                          <div key={key} className="text-center">
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1 truncate" title={label}>{label}</p>
                            <RatingBadge value={ev.oral[key] ?? null} />
                          </div>
                        ))}
                      </div>

                      {(ev.concerns_notes || ev.general_notes) && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                          {ev.concerns_notes && <p><strong>Concerns:</strong> {ev.concerns_notes}</p>}
                          {ev.general_notes && <p><strong>Notes:</strong> {ev.general_notes}</p>}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
