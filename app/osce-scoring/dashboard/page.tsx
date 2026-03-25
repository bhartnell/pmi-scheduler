'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Assessment {
  id: string;
  student_name: string;
  scenario: string;
  slot_number: number;
  day_number: number;
  assessment_date: string;
  evaluator_score: {
    submitted_at: string | null;
    readiness: string | null;
  } | null;
}

interface Evaluator {
  name: string;
  role: string;
}

export default function EvaluatorDashboard() {
  const router = useRouter();
  const [evaluator, setEvaluator] = useState<Evaluator | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState<number>(1);

  useEffect(() => {
    const saved = localStorage.getItem('osce_evaluator');
    if (!saved) {
      router.push('/osce-scoring/enter');
      return;
    }
    const ev = JSON.parse(saved);
    setEvaluator(ev);

    // Determine which day based on date
    const today = new Date().toISOString().split('T')[0];
    if (today === '2026-03-31') setActiveDay(2);

    fetchAssessments(ev.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAssessments(evaluatorName: string) {
    try {
      const res = await fetch(`/api/osce/assessments?evaluator=${encodeURIComponent(evaluatorName)}`);
      const data = await res.json();
      if (data.success) {
        setAssessments(data.assessments);
      }
    } catch (err) {
      console.error('Failed to fetch assessments:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('osce_token');
    localStorage.removeItem('osce_evaluator');
    router.push('/osce-scoring/enter');
  }

  const dayAssessments = assessments.filter(a => a.day_number === activeDay);

  const scenarioColors: Record<string, string> = {
    A: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    B: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    C: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    D: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    E: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    F: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  };

  const readinessLabels: Record<string, { label: string; color: string }> = {
    ready: { label: 'Ready', color: 'text-green-600 dark:text-green-400' },
    ready_with_concerns: { label: 'Concerns', color: 'text-amber-600 dark:text-amber-400' },
    not_yet_ready: { label: 'Not Ready', color: 'text-red-600 dark:text-red-400' },
  };

  if (!evaluator) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">OSCE Evaluator Dashboard</h1>
            <p className="text-blue-200 text-sm">{evaluator.name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-blue-200 hover:text-white px-3 py-1 border border-blue-400 rounded-lg"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Day tabs */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-3xl mx-auto flex">
          {[1, 2].map(day => (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              className={`flex-1 py-3 text-center font-medium text-sm transition-colors ${
                activeDay === day
                  ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              Day {day} &mdash; March {day === 1 ? '30' : '31'}
            </button>
          ))}
        </div>
      </div>

      {/* Assessment list */}
      <div className="max-w-3xl mx-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading assessments...</div>
        ) : dayAssessments.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No assessments for Day {activeDay}</div>
        ) : (
          dayAssessments.map(a => {
            const isSubmitted = !!a.evaluator_score?.submitted_at;
            const readiness = a.evaluator_score?.readiness;
            const hasStarted = !!a.evaluator_score;

            return (
              <div
                key={a.id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${scenarioColors[a.scenario] || 'bg-slate-100'}`}>
                      {a.scenario}
                    </span>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white text-lg">{a.student_name}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Slot {a.slot_number}</p>
                    </div>
                  </div>
                  {isSubmitted && (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm font-medium">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Submitted
                    </span>
                  )}
                </div>

                {readiness && readinessLabels[readiness] && (
                  <p className={`text-sm mb-3 font-medium ${readinessLabels[readiness].color}`}>
                    Readiness: {readinessLabels[readiness].label}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => router.push(`/osce-scoring/${a.id}`)}
                    className={`flex-1 py-3 px-4 rounded-xl font-semibold text-center transition-colors ${
                      isSubmitted
                        ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        : hasStarted
                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isSubmitted ? 'View Score' : hasStarted ? 'Continue Scoring' : 'Score'}
                  </button>
                  <a
                    href={`/osce-scenario/${a.scenario}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 px-4 rounded-xl font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    Scenario
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
