'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Pill,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Trophy,
  RotateCcw,
  Play,
} from 'lucide-react';

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
  snhd_formulary: boolean;
  checkpoint_blanks: string[];
}

interface Checkpoint {
  id: string;
  difficulty_level: number;
  score_percent: number;
  passed: boolean;
  checkpoint_date: string;
  medications_tested: string[];
}

interface ScoringResult {
  totalScore: number;
  passed: boolean;
  perMedication: Array<{
    medication_id: string;
    fields: Array<{
      field: string;
      studentAnswer: string | string[];
      correctAnswer: string | string[] | undefined;
      matched: boolean;
    }>;
    score: number;
  }>;
  blankedFields: string[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type PageState = 'menu' | 'taking' | 'results';

export default function LVFRPharmPage() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageState, setPageState] = useState<PageState>('menu');
  const [difficulty, setDifficulty] = useState(1);
  const [currentMedIndex, setCurrentMedIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>({});
  const [results, setResults] = useState<ScoringResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [medRes, ckRes] = await Promise.all([
        fetch('/api/lvfr-aemt/medications'),
        fetch('/api/lvfr-aemt/pharm/checkpoints'),
      ]);
      if (medRes.ok) {
        const data = await medRes.json();
        setMedications(data.medications || []);
      }
      if (ckRes.ok) {
        const data = await ckRes.json();
        setCheckpoints(data.checkpoints || []);
      }
    } catch (err) {
      console.error('Error fetching pharm data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const blankedFields = medications.length > 0
    ? getBlankedFieldsForLevel(medications[0].checkpoint_blanks || [], difficulty)
    : [];

  const startCheckpoint = (level: number) => {
    setDifficulty(level);
    setCurrentMedIndex(0);
    setAnswers({});
    setResults(null);
    setPageState('taking');
  };

  const submitCheckpoint = async () => {
    setSubmitting(true);
    try {
      const responses = medications.map(med => ({
        medication_id: med.id,
        answers: answers[med.id] || {},
      }));

      const res = await fetch('/api/lvfr-aemt/pharm/checkpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty_level: difficulty, responses }),
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data.scoring);
        setPageState('results');
        fetchData(); // Refresh history
      }
    } catch (err) {
      console.error('Error submitting checkpoint:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/lvfr-aemt"
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
                <Pill className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Pharmacology Checkpoints
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {medications.length} medications — Fill-in-the-blank practice
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6">
        {pageState === 'menu' && (
          <MenuView
            checkpoints={checkpoints}
            onStart={startCheckpoint}
          />
        )}

        {pageState === 'taking' && medications.length > 0 && (
          <TakeCheckpointView
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
            onNext={() => {
              if (currentMedIndex < medications.length - 1) {
                setCurrentMedIndex(i => i + 1);
              }
            }}
            onPrev={() => {
              if (currentMedIndex > 0) {
                setCurrentMedIndex(i => i - 1);
              }
            }}
            onSubmit={submitCheckpoint}
            submitting={submitting}
            isLast={currentMedIndex === medications.length - 1}
          />
        )}

        {pageState === 'results' && results && (
          <ResultsView
            results={results}
            medications={medications}
            difficulty={difficulty}
            onTryAgain={() => startCheckpoint(difficulty)}
            onBack={() => setPageState('menu')}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Menu View
// ---------------------------------------------------------------------------

function MenuView({
  checkpoints,
  onStart,
}: {
  checkpoints: Checkpoint[];
  onStart: (level: number) => void;
}) {
  const levels = [
    { level: 1, label: 'Level 1 — Beginner', desc: '3 blanked fields per card', color: 'green' },
    { level: 2, label: 'Level 2 — Intermediate', desc: '5 blanked fields per card', color: 'yellow' },
    { level: 3, label: 'Level 3 — Advanced', desc: '7+ blanked fields per card', color: 'red' },
  ];

  return (
    <div className="space-y-6">
      {/* Start Checkpoint */}
      <div className="grid gap-4 md:grid-cols-3">
        {levels.map(({ level, label, desc, color }) => {
          const past = checkpoints.filter(c => c.difficulty_level === level);
          const bestScore = past.length > 0 ? Math.max(...past.map(c => c.score_percent)) : null;

          return (
            <button
              key={level}
              onClick={() => onStart(level)}
              className="rounded-xl border border-gray-200 bg-white p-6 text-left transition-all hover:shadow-lg dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex items-center justify-between">
                <Play className={`h-8 w-8 text-${color}-500`} />
                {bestScore !== null && bestScore >= 80 && (
                  <Trophy className="h-5 w-5 text-yellow-500" />
                )}
              </div>
              <h3 className="mt-3 font-semibold text-gray-900 dark:text-white">{label}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{desc}</p>
              {bestScore !== null && (
                <p className={`mt-2 text-sm font-medium ${bestScore >= 80 ? 'text-green-600' : 'text-red-600'}`}>
                  Best: {bestScore}% ({past.length} attempt{past.length !== 1 ? 's' : ''})
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* History */}
      {checkpoints.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">History</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {checkpoints.slice(0, 10).map((ck) => (
              <div key={ck.id} className="flex items-center gap-3 px-4 py-3">
                {ck.passed ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Level {ck.difficulty_level}
                  </span>
                  <span className="ml-2 text-sm text-gray-500">
                    {new Date(ck.checkpoint_date).toLocaleDateString()}
                  </span>
                </div>
                <span className={`text-sm font-bold ${ck.passed ? 'text-green-600' : 'text-red-600'}`}>
                  {ck.score_percent}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Take Checkpoint View
// ---------------------------------------------------------------------------

function TakeCheckpointView({
  medication,
  medIndex,
  totalMeds,
  blankedFields,
  answers,
  onAnswer,
  onNext,
  onPrev,
  onSubmit,
  submitting,
  isLast,
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
  submitting: boolean;
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
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Card {medIndex + 1} of {totalMeds}
        </span>
        <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${((medIndex + 1) / totalMeds) * 100}%` }}
          />
        </div>
      </div>

      {/* Medication Card */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {medication.generic_name}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Brand: {medication.brand_names?.join(', ') || '—'}
          </p>
        </div>

        <div className="divide-y divide-gray-100 px-6 dark:divide-gray-700">
          {allFields.map(({ key, label, value }) => {
            const isBlanked = blankedFields.includes(key);

            return (
              <div key={key} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="w-40 flex-shrink-0 text-sm font-medium text-gray-500 dark:text-gray-400">
                  {label}
                </div>
                <div className="flex-1">
                  {isBlanked ? (
                    <input
                      type="text"
                      value={answers[key] || ''}
                      onChange={(e) => onAnswer(key, e.target.value)}
                      className="w-full rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-gray-900 placeholder-emerald-400 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-white"
                      placeholder={`Enter ${label.toLowerCase()}...`}
                    />
                  ) : (
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      {Array.isArray(value) ? value.join(', ') : String(value || '—')}
                    </div>
                  )}
                </div>
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
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          Previous Card
        </button>
        {isLast ? (
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? 'Scoring...' : 'Submit for Scoring'}
          </button>
        ) : (
          <button
            onClick={onNext}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Next Card <ChevronRight className="h-4 w-4" />
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
  results,
  medications,
  difficulty,
  onTryAgain,
  onBack,
}: {
  results: ScoringResult;
  medications: Medication[];
  difficulty: number;
  onTryAgain: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Score Banner */}
      <div className={`rounded-xl p-6 text-center ${
        results.passed
          ? 'bg-green-50 dark:bg-green-900/20'
          : 'bg-red-50 dark:bg-red-900/20'
      }`}>
        <div className={`text-5xl font-bold ${results.passed ? 'text-green-600' : 'text-red-600'}`}>
          {results.totalScore}%
        </div>
        <div className={`mt-2 text-lg font-semibold ${results.passed ? 'text-green-700' : 'text-red-700'}`}>
          {results.passed ? 'PASSED' : 'NEEDS REVIEW'}
        </div>
        <p className="mt-1 text-sm text-gray-500">Level {difficulty} — 80% required to pass</p>
      </div>

      {/* Per-Medication Breakdown */}
      {results.perMedication.map((medResult) => {
        const med = medications.find(m => m.id === medResult.medication_id);
        if (!med) return null;

        return (
          <div key={medResult.medication_id} className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {med.generic_name}
              </h3>
              <span className={`text-sm font-bold ${medResult.score >= 0.8 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.round(medResult.score * 100)}%
              </span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {medResult.fields
                .filter(f => f.correctAnswer !== undefined)
                .map((field) => (
                  <div key={field.field} className="flex items-start gap-3 px-4 py-2">
                    {field.matched ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {formatFieldName(field.field)}
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        Your answer: {formatAnswer(field.studentAnswer)}
                      </div>
                      {!field.matched && (
                        <div className="text-sm text-green-600 dark:text-green-400">
                          Correct: {formatAnswer(field.correctAnswer)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        );
      })}

      {/* Actions */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={onTryAgain}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <RotateCcw className="h-4 w-4" /> Try Again
        </button>
        <button
          onClick={onBack}
          className="rounded-lg px-6 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          Back to Menu
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBlankedFieldsForLevel(blanks: string[], level: number): string[] {
  const counts: Record<number, number> = { 1: 3, 2: 5, 3: 7 };
  return blanks.slice(0, counts[level] || 3);
}

function formatFieldName(field: string): string {
  return field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatAnswer(answer: unknown): string {
  if (!answer) return '(empty)';
  if (Array.isArray(answer)) return answer.join(', ');
  return String(answer);
}
