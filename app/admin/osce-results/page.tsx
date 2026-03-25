'use client';

import { useState, useEffect } from 'react';

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
  oral: {
    prioritization: string | null;
    differential: string | null;
    decision_defense: string | null;
    reassessment: string | null;
    transport_handoff: string | null;
    notes: string | null;
  };
}

interface AssessmentResult {
  id: string;
  student_name: string;
  scenario: string;
  slot_number: number;
  day_number: number;
  assessment_date: string;
  evaluators: EvaluatorResult[];
  evaluator_count: number;
  submitted_count: number;
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
  const colors = {
    S: 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/40',
    N: 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40',
    U: 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/40',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${colors[value as keyof typeof colors] || ''}`}>
      {value}
    </span>
  );
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

export default function OsceResultsPage() {
  const [results, setResults] = useState<AssessmentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dayFilter, setDayFilter] = useState<number | null>(null);

  useEffect(() => { fetchResults(); }, []);

  async function fetchResults() {
    try {
      const res = await fetch('/api/osce/results');
      const data = await res.json();
      if (data.success) setResults(data.results);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = dayFilter ? results.filter(r => r.day_number === dayFilter) : results;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">OSCE Results</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Student assessment results and evaluator scores
          </p>
        </div>
        <a
          href="/api/osce/results?format=csv"
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
        >
          Export CSV
        </a>
      </div>

      {/* Day filter */}
      <div className="flex gap-2">
        {[null, 1, 2].map(d => (
          <button
            key={d ?? 'all'}
            onClick={() => setDayFilter(d)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              dayFilter === d
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            {d === null ? 'All Days' : `Day ${d}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading results...</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Student</th>
                  <th className="px-3 py-3 text-center font-semibold text-gray-900 dark:text-white">Scenario</th>
                  <th className="px-3 py-3 text-center font-semibold text-gray-900 dark:text-white">Day</th>
                  <th className="px-3 py-3 text-center font-semibold text-gray-900 dark:text-white">Slot</th>
                  <th className="px-3 py-3 text-center font-semibold text-gray-900 dark:text-white">Evaluators</th>
                  <th className="px-3 py-3 text-center font-semibold text-gray-900 dark:text-white">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <>
                    <tr
                      key={r.id}
                      onClick={() => toggleExpand(r.id)}
                      className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{r.student_name}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded font-bold text-xs">
                          {r.scenario}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-400">{r.day_number}</td>
                      <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-400">{r.slot_number}</td>
                      <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-400">{r.evaluator_count}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={r.submitted_count === r.evaluator_count && r.evaluator_count > 0 ? 'text-green-600' : 'text-gray-400'}>
                          {r.submitted_count}/{r.evaluator_count}
                        </span>
                      </td>
                    </tr>
                    {expanded.has(r.id) && (
                      <tr key={`${r.id}-detail`}>
                        <td colSpan={6} className="px-4 py-4 bg-gray-50 dark:bg-gray-900/50">
                          {r.evaluators.length === 0 ? (
                            <p className="text-gray-500 text-sm">No evaluator scores yet</p>
                          ) : (
                            <div className="space-y-4">
                              {r.evaluators.map((ev, i) => (
                                <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                                  <div className="flex items-center justify-between mb-3">
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
                                      <span className="text-gray-500">S: {ev.s_count}/8</span>
                                      {ev.snhd_grade !== null && (
                                        <span className="text-gray-500">Grade: {ev.snhd_grade.toFixed(1)}%</span>
                                      )}
                                      <ReadinessLabel value={ev.readiness} />
                                      {ev.submitted_at && (
                                        <span className="text-green-500 text-xs">
                                          Submitted {new Date(ev.submitted_at).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* SNHD Factors */}
                                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-3">
                                    {Object.entries(FACTOR_LABELS).map(([key, label]) => (
                                      <div key={key} className="text-center">
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1 truncate" title={label}>{label}</p>
                                        <RatingBadge value={ev.factors[key]?.rating ?? null} />
                                      </div>
                                    ))}
                                  </div>

                                  {/* Oral Board */}
                                  <div className="grid grid-cols-5 gap-2 mb-3">
                                    {Object.entries(ORAL_LABELS).map(([key, label]) => (
                                      <div key={key} className="text-center">
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1 truncate" title={label}>{label}</p>
                                        <RatingBadge value={ev.oral[key as keyof typeof ev.oral] ?? null} />
                                      </div>
                                    ))}
                                  </div>

                                  {/* Notes */}
                                  {(ev.concerns_notes || ev.general_notes) && (
                                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                                      {ev.concerns_notes && <p><strong>Concerns:</strong> {ev.concerns_notes}</p>}
                                      {ev.general_notes && <p><strong>Notes:</strong> {ev.general_notes}</p>}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
