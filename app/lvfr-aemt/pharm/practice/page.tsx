'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Pill, CheckCircle2, XCircle, ChevronRight,
  RotateCcw, Play, ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Medication {
  id: string;
  generic_name: string;
  brand_names: string[];
  drug_class: string | null;
  mechanism_of_action: string | null;
  indications: string[];
  contraindications: string[];
  dose_adult: string | null;
  dose_pediatric: string | null;
  route: string[];
  onset: string | null;
  duration: string | null;
  side_effects: string[];
  special_considerations: string | null;
  checkpoint_blanks: string[];
}

interface ScoringResult {
  totalScore: number;
  passed: boolean;
  blankedFields: string[];
  perMedication: Array<{
    medication_id: string;
    fields: Array<{
      field: string;
      studentAnswer: string | string[];
      correctAnswer?: string | string[];
      matched: boolean;
    }>;
    score: number;
  }>;
}

type PageState = 'setup' | 'quiz' | 'submitting' | 'results' | 'error';

const LEVELS = [
  { level: 1, label: 'Level 1 — Beginner', desc: '3 fields blanked per card', color: 'emerald' },
  { level: 2, label: 'Level 2 — Intermediate', desc: '5 fields blanked per card', color: 'amber' },
  { level: 3, label: 'Level 3 — Advanced', desc: '7+ fields blanked per card', color: 'red' },
] as const;

function getBlanksForLevel(blanks: string[], level: number): string[] {
  const counts: Record<number, number> = { 1: 3, 2: 5, 3: 7 };
  return blanks.slice(0, counts[level] || 3);
}

function formatFieldName(field: string): string {
  return field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatAnswer(val: unknown): string {
  if (!val) return '(empty)';
  if (Array.isArray(val)) return val.join(', ');
  return String(val);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function LVFRPharmPracticePage() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [pageState, setPageState] = useState<PageState>('setup');

  // Setup state
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [difficulty, setDifficulty] = useState(1);

  // Quiz state
  const [currentMedIndex, setCurrentMedIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({});

  // Results
  const [results, setResults] = useState<ScoringResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const loadMedications = useCallback(async () => {
    try {
      const res = await fetch('/api/lvfr-aemt/pharm/practice');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setMedications(data.medications || []);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    loadMedications();
  }, [loadMedications]);

  const blankedFields = medications.length > 0
    ? getBlanksForLevel(medications[0].checkpoint_blanks || [], difficulty)
    : [];

  const startQuiz = () => {
    if (!studentName.trim() || !studentId.trim()) return;
    setCurrentMedIndex(0);
    setAnswers({});
    setResults(null);
    setPageState('quiz');
  };

  const handleSubmit = async () => {
    setPageState('submitting');
    try {
      const responses = medications.map(med => ({
        medication_id: med.id,
        answers: answers[med.id] || {},
      }));

      const res = await fetch('/api/lvfr-aemt/pharm/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_name: studentName.trim(),
          student_identifier: studentId.trim(),
          difficulty_level: difficulty,
          responses,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setResults(data.scoring);
      setPageState('results');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Submission failed. Please try again.');
      setPageState('error');
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Could not load medication data. Please check your connection and try again.</p>
          <button onClick={loadMedications} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Pill className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">LVFR Pharm Practice</h1>
            <p className="text-xs text-gray-500">Unauthenticated — no login required</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Setup */}
        {pageState === 'setup' && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="font-semibold text-gray-900">Start a Practice Session</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  placeholder="First Last"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student ID / Identifier</label>
                <input
                  type="text"
                  value={studentId}
                  onChange={e => setStudentId(e.target.value)}
                  placeholder="e.g. 12345 or last 4 of your ID"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  autoComplete="off"
                />
                <p className="text-xs text-gray-500 mt-1">Used to record results — ask your instructor what to enter.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty Level</label>
                <div className="space-y-2">
                  {LEVELS.map(({ level, label, desc }) => (
                    <label key={level} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="difficulty"
                        value={level}
                        checked={difficulty === level}
                        onChange={() => setDifficulty(level)}
                        className="mt-0.5 text-emerald-600"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{label}</div>
                        <div className="text-xs text-gray-500">{desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={startQuiz}
                disabled={!studentName.trim() || !studentId.trim() || medications.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg font-semibold text-sm transition-colors"
              >
                <Play className="w-4 h-4" />
                Start Practice ({medications.length} medications)
              </button>
            </div>

            <p className="text-xs text-center text-gray-400">
              Your results will be recorded and shared with your instructor.
            </p>
          </div>
        )}

        {/* Quiz */}
        {pageState === 'quiz' && medications.length > 0 && (
          <QuizCard
            medication={medications[currentMedIndex]}
            medIndex={currentMedIndex}
            totalMeds={medications.length}
            blankedFields={blankedFields}
            answers={answers[medications[currentMedIndex].id] || {}}
            onAnswer={(field, value) => {
              setAnswers(prev => ({
                ...prev,
                [medications[currentMedIndex].id]: {
                  ...prev[medications[currentMedIndex].id],
                  [field]: value,
                },
              }));
            }}
            onNext={() => setCurrentMedIndex(i => i + 1)}
            onPrev={() => setCurrentMedIndex(i => i - 1)}
            onSubmit={handleSubmit}
            isLast={currentMedIndex === medications.length - 1}
          />
        )}

        {/* Submitting */}
        {pageState === 'submitting' && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-600">Scoring your answers...</p>
          </div>
        )}

        {/* Error */}
        {pageState === 'error' && (
          <div className="bg-white rounded-xl border border-red-200 p-6 text-center space-y-4">
            <p className="text-sm text-red-600">{errorMsg}</p>
            <button
              onClick={() => setPageState('quiz')}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium"
            >
              Go Back
            </button>
          </div>
        )}

        {/* Results */}
        {pageState === 'results' && results && (
          <ResultsView
            results={results}
            medications={medications}
            difficulty={difficulty}
            studentName={studentName}
            onTryAgain={() => {
              setCurrentMedIndex(0);
              setAnswers({});
              setResults(null);
              setPageState('quiz');
            }}
            onRestart={() => setPageState('setup')}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quiz Card
// ---------------------------------------------------------------------------
function QuizCard({
  medication, medIndex, totalMeds, blankedFields,
  answers, onAnswer, onNext, onPrev, onSubmit, isLast,
}: {
  medication: Medication;
  medIndex: number;
  totalMeds: number;
  blankedFields: string[];
  answers: Record<string, string>;
  onAnswer: (field: string, value: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onSubmit: () => void;
  isLast: boolean;
}) {
  const allFields: Array<{ key: string; label: string; value: unknown }> = [
    { key: 'drug_class', label: 'Drug Class', value: medication.drug_class },
    { key: 'mechanism_of_action', label: 'Mechanism of Action', value: medication.mechanism_of_action },
    { key: 'indications', label: 'Indications', value: medication.indications },
    { key: 'contraindications', label: 'Contraindications', value: medication.contraindications },
    { key: 'dose_adult', label: 'Adult Dose', value: medication.dose_adult },
    { key: 'dose_pediatric', label: 'Pediatric Dose', value: medication.dose_pediatric },
    { key: 'route', label: 'Route(s)', value: medication.route },
    { key: 'onset', label: 'Onset', value: medication.onset },
    { key: 'duration', label: 'Duration', value: medication.duration },
    { key: 'side_effects', label: 'Side Effects', value: medication.side_effects },
    { key: 'special_considerations', label: 'Special Considerations', value: medication.special_considerations },
  ];

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">Card {medIndex + 1} of {totalMeds}</span>
        <div className="flex-1 h-2 rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${((medIndex + 1) / totalMeds) * 100}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{medication.generic_name}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Brand: {medication.brand_names?.join(', ') || '—'}
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {allFields.map(({ key, label, value }) => {
            const isBlanked = blankedFields.includes(key);
            return (
              <div key={key} className="px-4 py-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</div>
                {isBlanked ? (
                  <input
                    type="text"
                    value={answers[key] || ''}
                    onChange={e => onAnswer(key, e.target.value)}
                    className="w-full rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-gray-900 placeholder-emerald-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder={`Enter ${label.toLowerCase()}...`}
                    autoComplete="off"
                  />
                ) : (
                  <p className="text-sm text-gray-700">
                    {Array.isArray(value) ? value.join(', ') : String(value || '—')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onPrev}
          disabled={medIndex === 0}
          className="flex items-center gap-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Prev
        </button>
        {isLast ? (
          <button
            onClick={onSubmit}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Submit for Scoring
          </button>
        ) : (
          <button
            onClick={onNext}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results View
// ---------------------------------------------------------------------------
function ResultsView({
  results, medications, difficulty, studentName, onTryAgain, onRestart,
}: {
  results: ScoringResult;
  medications: Medication[];
  difficulty: number;
  studentName: string;
  onTryAgain: () => void;
  onRestart: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Score Banner */}
      <div className={`rounded-xl p-6 text-center ${results.passed ? 'bg-green-50' : 'bg-red-50'}`}>
        <div className={`text-5xl font-bold ${results.passed ? 'text-green-600' : 'text-red-600'}`}>
          {results.totalScore}%
        </div>
        <div className={`mt-1 text-base font-semibold ${results.passed ? 'text-green-700' : 'text-red-700'}`}>
          {results.passed ? 'PASSED' : 'NEEDS REVIEW'}
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {studentName} — Level {difficulty} — 80% required to pass
        </p>
        <p className="text-xs text-gray-400 mt-2">Your results have been recorded.</p>
      </div>

      {/* Per-medication breakdown */}
      {results.perMedication.map(medResult => {
        const med = medications.find(m => m.id === medResult.medication_id);
        if (!med) return null;
        return (
          <div key={medResult.medication_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">{med.generic_name}</h3>
              <span className={`text-sm font-bold ${medResult.score >= 0.8 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.round(medResult.score * 100)}%
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {medResult.fields.filter(f => f.correctAnswer !== undefined).map(field => (
                <div key={field.field} className="flex items-start gap-3 px-4 py-2.5">
                  {field.matched
                    ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-500">{formatFieldName(field.field)}</div>
                    <div className="text-sm text-gray-700">You: {formatAnswer(field.studentAnswer)}</div>
                    {!field.matched && (
                      <div className="text-sm text-green-700">Correct: {formatAnswer(field.correctAnswer)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <button
          onClick={onTryAgain}
          className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-sm transition-colors"
        >
          <RotateCcw className="w-4 h-4" /> Try Again (same settings)
        </button>
        <button
          onClick={onRestart}
          className="w-full py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Change Settings / Start Over
        </button>
        <p className="text-xs text-center text-gray-400">
          Need to log in?{' '}
          <Link href="/lvfr-aemt/pharm" className="text-emerald-600 underline">Authenticated Pharm Page</Link>
        </p>
      </div>
    </div>
  );
}
