'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Heart,
  HelpCircle,
  Lightbulb,
  Loader2,
  Lock,
  Radio,
  RotateCcw,
  Stethoscope,
  Target,
  ThermometerSun,
  Trophy,
  XCircle,
} from 'lucide-react';
import type {
  CaseStudy,
  CasePhase,
  CaseQuestion,
  CasePracticeProgress,
  PhaseVitals,
} from '@/types/case-studies';
import Breadcrumbs from '@/components/Breadcrumbs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PracticeScreen =
  | 'loading'
  | 'dispatch'
  | 'phase_presentation'
  | 'phase_vitals'
  | 'phase_questions'
  | 'phase_review'
  | 'phase_transition'
  | 'debrief';

interface ResponseFeedback {
  question_id: string;
  is_correct: boolean;
  points_earned: number;
  max_points: number;
  explanation: string | null;
  correct_answer: unknown;
}

interface PhaseScore {
  phase_id: string;
  title: string;
  points: number;
  max_points: number;
  time_seconds: number;
  questions: Array<{
    question_id: string;
    question_text: string;
    question_type: string;
    student_response: unknown;
    is_correct: boolean | null;
    points_earned: number;
    max_points: number;
    correct_answer: unknown;
    explanation: string | null;
    options: Array<{ id: string; text: string }> | null;
    items: string[] | null;
    hints_used: number;
    time_taken: number | null;
  }>;
}

interface DebriefData {
  score: {
    total_points: number;
    max_points: number;
    percentage: number;
    letter_grade: string;
  };
  attempt_number: number;
  previous_score: number | null;
  total_time_seconds: number;
  phase_scores: PhaseScore[];
  critical_actions: string[];
  debrief_points: string[];
  achievements: Array<{ type: string; name: string }>;
}

// ---------------------------------------------------------------------------
// Helper: format seconds as "Xm Ys"
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// ---------------------------------------------------------------------------
// Helper: display answer value
// ---------------------------------------------------------------------------

function displayAnswer(
  answer: unknown,
  question: { options?: Array<{ id: string; text: string }> | null; items?: string[] | null }
): string {
  if (answer === null || answer === undefined) return 'No answer';
  const val =
    typeof answer === 'object' && answer !== null && 'value' in answer
      ? (answer as Record<string, unknown>).value
      : answer;

  if (Array.isArray(val)) {
    // For multi_select/ordered_list, map IDs to labels
    if (question.options) {
      const optMap = new Map(question.options.map((o) => [o.id, o.text]));
      return val.map((v) => optMap.get(String(v)) || String(v)).join(', ');
    }
    return val.join(', ');
  }
  // For single option, map ID to label
  if (question.options) {
    const opt = question.options.find((o) => o.id === String(val));
    if (opt) return opt.text;
  }
  return String(val);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PracticeModePage() {
  const { id: caseId } = useParams<{ id: string }>();
  const router = useRouter();

  // Core state
  const [screen, setScreen] = useState<PracticeScreen>('loading');
  const [caseStudy, setCaseStudy] = useState<CaseStudy | null>(null);
  const [, setProgress] = useState<CasePracticeProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Phase navigation
  const [currentPhaseIdx, setCurrentPhaseIdx] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);

  // Question answering
  const [selectedAnswer, setSelectedAnswer] = useState<unknown>(null);
  const [orderedItems, setOrderedItems] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hintsUsedThisQ, setHintsUsedThisQ] = useState(0);
  const questionStartTime = useRef<number>(Date.now());

  // Phase review data
  const [phaseResponses, setPhaseResponses] = useState<ResponseFeedback[]>([]);

  // Transition countdown
  const [transitionCountdown, setTransitionCountdown] = useState(3);

  // Debrief
  const [debriefData, setDebriefData] = useState<DebriefData | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  // Track all responses for the current attempt (for resume)
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set());

  // =========================================================================
  // Start / Resume practice
  // =========================================================================

  const startPractice = useCallback(async () => {
    try {
      setScreen('loading');
      const res = await fetch(`/api/cases/${caseId}/practice/start`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start practice');
      }
      const data = await res.json();
      setCaseStudy(data.caseStudy as CaseStudy);
      setProgress(data.progress as CasePracticeProgress);

      // Track already-answered questions for resume
      const answered = new Set<string>();
      if (data.responses && Array.isArray(data.responses)) {
        for (const r of data.responses) {
          answered.add(`${r.phase_id}:${r.question_id}`);
        }
      }
      setAnsweredQuestions(answered);

      if (data.resumed && data.progress) {
        // Resume: figure out where the student left off
        const p = data.progress as CasePracticeProgress;
        setCurrentPhaseIdx(p.current_phase || 0);
        setCurrentQuestionIdx(p.current_question || 0);

        const phases = (data.caseStudy as CaseStudy).phases || [];
        if (p.current_phase >= phases.length) {
          // All phases done — go to debrief
          await completePractice();
        } else {
          // Check if there are unanswered questions in the current phase
          const phase = phases[p.current_phase];
          const phaseQuestions = phase?.questions || [];
          if (p.current_question >= phaseQuestions.length) {
            // Phase questions completed — show transition or move forward
            if (p.current_phase + 1 < phases.length) {
              setCurrentPhaseIdx(p.current_phase + 1);
              setCurrentQuestionIdx(0);
              setScreen('phase_presentation');
            } else {
              await completePractice();
            }
          } else {
            setScreen('phase_questions');
          }
        }
      } else {
        setScreen('dispatch');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start practice');
      setScreen('loading');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  useEffect(() => {
    startPractice();
  }, [startPractice]);

  // =========================================================================
  // Submit answer
  // =========================================================================

  const submitAnswer = async () => {
    if (!caseStudy || submitting) return;
    const phase = caseStudy.phases[currentPhaseIdx];
    if (!phase?.questions) return;
    const question = phase.questions[currentQuestionIdx];
    if (!question) return;

    // Determine what to send as response
    let responseValue: unknown = selectedAnswer;
    if (question.type === 'ordered_list') {
      responseValue = orderedItems;
    }

    setSubmitting(true);
    const timeTaken = Math.round((Date.now() - questionStartTime.current) / 1000);

    try {
      const res = await fetch(`/api/cases/${caseId}/practice/respond`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase_id: phase.id,
          question_id: question.id,
          response: responseValue,
          time_taken_seconds: timeTaken,
          hints_used: hintsUsedThisQ,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit');
      }

      const feedback = await res.json();

      // Track this answer
      setAnsweredQuestions((prev) => {
        const next = new Set(prev);
        next.add(`${phase.id}:${question.id}`);
        return next;
      });

      // Add to phase responses for review screen
      setPhaseResponses((prev) => [
        ...prev,
        {
          question_id: question.id,
          is_correct: feedback.is_correct,
          points_earned: feedback.points_earned,
          max_points: feedback.max_points || question.points || 10,
          explanation: feedback.explanation,
          correct_answer: feedback.correct_answer,
        },
      ]);

      // Move to next question or phase review
      const totalQuestions = phase.questions.length;
      if (currentQuestionIdx + 1 < totalQuestions) {
        setCurrentQuestionIdx(currentQuestionIdx + 1);
        resetQuestionState();
      } else {
        // All questions in this phase answered — show phase review
        setScreen('phase_review');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================================
  // Complete practice
  // =========================================================================

  const completePractice = async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/practice/complete`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to complete');
      }
      const data = await res.json();
      setDebriefData(data as DebriefData);
      setScreen('debrief');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete');
    }
  };

  // =========================================================================
  // Helpers
  // =========================================================================

  const resetQuestionState = () => {
    setSelectedAnswer(null);
    setOrderedItems([]);
    setShowHint(false);
    setHintsUsedThisQ(0);
    questionStartTime.current = Date.now();
  };

  const advanceFromPhaseReview = () => {
    const phases = caseStudy?.phases || [];
    if (currentPhaseIdx + 1 < phases.length) {
      // Show transition text if available, otherwise go to next phase presentation
      const currentPhase = phases[currentPhaseIdx];
      if (currentPhase?.transition_text) {
        setTransitionCountdown(3);
        setScreen('phase_transition');
      } else {
        setCurrentPhaseIdx(currentPhaseIdx + 1);
        setCurrentQuestionIdx(0);
        setPhaseResponses([]);
        resetQuestionState();
        setScreen('phase_presentation');
      }
    } else {
      // All phases done
      completePractice();
    }
  };

  const advanceFromTransition = useCallback(() => {
    setCurrentPhaseIdx((prev) => prev + 1);
    setCurrentQuestionIdx(0);
    setPhaseResponses([]);
    resetQuestionState();
    setScreen('phase_presentation');
  }, []);

  // Transition countdown timer
  useEffect(() => {
    if (screen !== 'phase_transition') return;
    if (transitionCountdown <= 0) {
      advanceFromTransition();
      return;
    }
    const timer = setTimeout(() => {
      setTransitionCountdown((c) => c - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [screen, transitionCountdown, advanceFromTransition]);

  // =========================================================================
  // Compute progress for progress bars
  // =========================================================================

  const phases = caseStudy?.phases || [];
  const totalQuestions = phases.reduce(
    (sum, p) => sum + (p.questions?.length || 0),
    0
  );
  const answeredCount = answeredQuestions.size;
  const overallProgress =
    totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  // =========================================================================
  // Current phase/question helpers
  // =========================================================================

  const currentPhase: CasePhase | undefined = phases[currentPhaseIdx];
  const currentQuestion: CaseQuestion | undefined =
    currentPhase?.questions?.[currentQuestionIdx];
  const phaseQuestionCount = currentPhase?.questions?.length || 0;

  // =========================================================================
  // Ordered list interaction helper
  // =========================================================================

  const toggleOrderedItem = (item: string) => {
    setOrderedItems((prev) => {
      if (prev.includes(item)) {
        return prev.filter((i) => i !== item);
      }
      return [...prev, item];
    });
  };

  const getOrderPosition = (item: string): number => {
    const idx = orderedItems.indexOf(item);
    return idx >= 0 ? idx + 1 : 0;
  };

  // =========================================================================
  // Multi-select toggle
  // =========================================================================

  const toggleMultiSelect = (optionId: string) => {
    setSelectedAnswer((prev: unknown) => {
      const arr = Array.isArray(prev) ? [...prev] : [];
      const idx = arr.indexOf(optionId);
      if (idx >= 0) {
        arr.splice(idx, 1);
      } else {
        arr.push(optionId);
      }
      return arr;
    });
  };

  // =========================================================================
  // Can submit check
  // =========================================================================

  const canSubmit = (): boolean => {
    if (!currentQuestion) return false;
    switch (currentQuestion.type) {
      case 'multiple_choice':
        return selectedAnswer !== null && selectedAnswer !== '';
      case 'multi_select':
        return Array.isArray(selectedAnswer) && selectedAnswer.length > 0;
      case 'ordered_list':
        return orderedItems.length > 0;
      case 'free_text':
        return typeof selectedAnswer === 'string' && selectedAnswer.trim().length > 0;
      case 'numeric':
        return selectedAnswer !== null && selectedAnswer !== '' && !isNaN(Number(selectedAnswer));
      default:
        return false;
    }
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  // --- Loading ---
  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        {error ? (
          <div className="text-center p-8">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 dark:text-red-400 text-lg mb-4">{error}</p>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Go Back
            </button>
          </div>
        ) : (
          <div className="text-center">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Preparing your practice session...
            </p>
          </div>
        )}
      </div>
    );
  }

  // --- Dispatch ---
  if (screen === 'dispatch') {
    const dispatch = caseStudy?.dispatch_info;
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8 shadow-2xl">
            {/* Pulsing indicator */}
            <div className="flex items-center gap-3 mb-6">
              <span className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500" />
              </span>
              <span className="text-green-400 font-semibold text-sm uppercase tracking-wider">
                Incoming Call
              </span>
            </div>

            {/* Dispatch info */}
            <h1 className="text-2xl font-bold text-white mb-2">
              {caseStudy?.title || 'Case Study'}
            </h1>

            {dispatch?.call_type && (
              <div className="mt-4">
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">
                  Call Type
                </p>
                <p className="text-white text-lg">{dispatch.call_type}</p>
              </div>
            )}

            {dispatch?.location && (
              <div className="mt-4">
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">
                  Location
                </p>
                <p className="text-white text-lg">{dispatch.location}</p>
              </div>
            )}

            {dispatch?.additional_info && (
              <div className="mt-4">
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">
                  Additional Info
                </p>
                <p className="text-gray-300">{dispatch.additional_info}</p>
              </div>
            )}

            {caseStudy?.patient_age && (
              <div className="mt-4 flex gap-4">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">
                    Patient
                  </p>
                  <p className="text-white">
                    {caseStudy.patient_age} y/o {caseStudy.patient_sex || ''}
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                resetQuestionState();
                setScreen('phase_presentation');
              }}
              className="mt-8 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-xl text-lg transition-colors flex items-center justify-center gap-2"
            >
              <Radio className="h-5 w-5" />
              Respond to Call
            </button>
          </div>

          {/* Case metadata below */}
          <div className="mt-4 flex items-center justify-center gap-4 text-gray-500 text-sm">
            {caseStudy?.category && (
              <span className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                {caseStudy.category}
              </span>
            )}
            {caseStudy?.difficulty && (
              <span className="flex items-center gap-1">
                <Target className="h-4 w-4" />
                {caseStudy.difficulty}
              </span>
            )}
            {caseStudy?.estimated_duration_minutes && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                ~{caseStudy.estimated_duration_minutes} min
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Phase Presentation ---
  if (screen === 'phase_presentation' && currentPhase) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        {/* Overall progress bar */}
        <OverallProgressBar progress={overallProgress} />

        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* Phase indicator */}
          <div className="flex items-center gap-2 mb-6">
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-full">
              Phase {currentPhaseIdx + 1} of {phases.length}
            </span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            {currentPhase.title}
          </h2>

          {currentPhase.presentation_text && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 mb-6">
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                {currentPhase.presentation_text}
              </p>
            </div>
          )}

          <button
            onClick={() => setScreen('phase_vitals')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Stethoscope className="h-5 w-5" />
            View Vitals &amp; Findings
          </button>
        </div>
      </div>
    );
  }

  // --- Phase Vitals ---
  if (screen === 'phase_vitals' && currentPhase) {
    const vitals = currentPhase.vitals;
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <OverallProgressBar progress={overallProgress} />

        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-full">
              Phase {currentPhaseIdx + 1} — Vitals
            </span>
          </div>

          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            Patient Assessment
          </h2>

          {/* Vitals grid */}
          {vitals && <VitalsGrid vitals={vitals} />}

          {/* Physical findings */}
          {currentPhase.physical_findings &&
            currentPhase.physical_findings.length > 0 && (
              <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Physical Findings
                </h3>
                <ul className="space-y-2">
                  {currentPhase.physical_findings.map((finding, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-gray-700 dark:text-gray-300"
                    >
                      <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-500" />
                      {finding}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          <button
            onClick={() => {
              resetQuestionState();
              setScreen('phase_questions');
            }}
            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            Continue to Questions
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  // --- Phase Questions ---
  if (screen === 'phase_questions' && currentPhase && currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-28">
        {/* Overall progress bar */}
        <OverallProgressBar progress={overallProgress} />

        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Question progress */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Question {currentQuestionIdx + 1} of {phaseQuestionCount}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-500">
              Phase {currentPhaseIdx + 1}
            </span>
          </div>

          {/* Question progress bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-6">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${((currentQuestionIdx + 1) / phaseQuestionCount) * 100}%`,
              }}
            />
          </div>

          {/* Question text */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 mb-6">
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {currentQuestion.text}
            </p>
            {currentQuestion.points && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
                {currentQuestion.points} points
              </p>
            )}
          </div>

          {/* Answer input based on type */}
          <QuestionInput
            question={currentQuestion}
            selectedAnswer={selectedAnswer}
            onSelectAnswer={setSelectedAnswer}
            orderedItems={orderedItems}
            onToggleOrderedItem={toggleOrderedItem}
            getOrderPosition={getOrderPosition}
            onToggleMultiSelect={toggleMultiSelect}
          />

          {/* Hint button */}
          {currentQuestion.hint && (
            <div className="mt-4">
              {showHint ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      Hint
                    </span>
                  </div>
                  <p className="text-amber-800 dark:text-amber-300 text-sm">
                    {currentQuestion.hint}
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setShowHint(true);
                    setHintsUsedThisQ((h) => h + 1);
                  }}
                  className="flex items-center gap-2 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 text-sm font-medium"
                >
                  <HelpCircle className="h-4 w-4" />
                  Show Hint
                </button>
              )}
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Fixed bottom button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => {
                setError(null);
                submitAnswer();
              }}
              disabled={!canSubmit() || submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Lock className="h-5 w-5" />
                  Lock In Answer
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Phase Review ---
  if (screen === 'phase_review' && currentPhase) {
    const phasePointsEarned = phaseResponses.reduce(
      (sum, r) => sum + r.points_earned,
      0
    );
    const phasePointsMax = phaseResponses.reduce(
      (sum, r) => sum + r.max_points,
      0
    );

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <OverallProgressBar progress={overallProgress} />

        <div className="max-w-2xl mx-auto px-4 py-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Phase {currentPhaseIdx + 1} Review
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {currentPhase.title}
          </p>

          {/* Phase score */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 mb-6 flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300 font-medium">
              Phase Score
            </span>
            <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {phasePointsEarned} / {phasePointsMax} points
            </span>
          </div>

          {/* Questions review */}
          <div className="space-y-4">
            {(currentPhase.questions || []).map((q, qIdx) => {
              const fb = phaseResponses.find((r) => r.question_id === q.id);
              if (!fb) return null;
              return (
                <div
                  key={q.id}
                  className={`bg-white dark:bg-gray-800 rounded-xl p-5 border ${
                    fb.is_correct
                      ? 'border-green-200 dark:border-green-800'
                      : 'border-red-200 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    {fb.is_correct ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-gray-900 dark:text-gray-100 font-medium">
                        {qIdx + 1}. {q.text}
                      </p>
                      <p className="text-sm mt-1">
                        <span
                          className={
                            fb.is_correct
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }
                        >
                          {fb.points_earned} / {fb.max_points} pts
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Correct answer */}
                  {!fb.is_correct && fb.correct_answer !== null && (
                    <div className="ml-8 mb-2 text-sm">
                      <span className="text-gray-500 dark:text-gray-500">
                        Correct answer:{' '}
                      </span>
                      <span className="text-green-700 dark:text-green-400 font-medium">
                        {displayAnswer(fb.correct_answer, q)}
                      </span>
                    </div>
                  )}

                  {/* Explanation */}
                  {fb.explanation && (
                    <div className="ml-8 mt-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {fb.explanation}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={advanceFromPhaseReview}
            className="mt-8 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {currentPhaseIdx + 1 < phases.length ? (
              <>
                Continue
                <ArrowRight className="h-5 w-5" />
              </>
            ) : (
              <>
                View Results
                <Trophy className="h-5 w-5" />
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // --- Phase Transition ---
  if (screen === 'phase_transition' && currentPhase) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-lg w-full text-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700">
            <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed mb-6">
              {currentPhase.transition_text}
            </p>
            <div className="flex items-center justify-center gap-2 text-gray-400">
              <Clock className="h-4 w-4" />
              <span className="text-sm">
                Continuing in {transitionCountdown}...
              </span>
            </div>
            <button
              onClick={advanceFromTransition}
              className="mt-4 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Debrief ---
  if (screen === 'debrief' && debriefData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Breadcrumbs entityTitle={caseStudy?.title} className="mb-4" />
          {/* Score Hero */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 text-center mb-6">
            <div className="mb-4">
              <span
                className={`inline-flex items-center justify-center h-20 w-20 rounded-full text-3xl font-bold ${
                  debriefData.score.percentage >= 90
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : debriefData.score.percentage >= 70
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}
              >
                {debriefData.score.letter_grade}
              </span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
              {debriefData.score.percentage}%
            </h2>
            <p className="text-gray-500 dark:text-gray-500">
              {debriefData.score.total_points} / {debriefData.score.max_points}{' '}
              points
            </p>

            {/* Attempt / improvement info */}
            <div className="mt-4 flex items-center justify-center gap-4 text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Attempt {debriefData.attempt_number}
              </span>
              {debriefData.previous_score !== null && (
                <span
                  className={
                    debriefData.score.percentage > debriefData.previous_score
                      ? 'text-green-600 dark:text-green-400'
                      : debriefData.score.percentage < debriefData.previous_score
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-500'
                  }
                >
                  {debriefData.score.percentage > debriefData.previous_score
                    ? `Improved from ${debriefData.previous_score}%`
                    : debriefData.score.percentage < debriefData.previous_score
                      ? `Previously ${debriefData.previous_score}%`
                      : `Same as previous (${debriefData.previous_score}%)`}
                </span>
              )}
            </div>

            {/* Time */}
            <p className="mt-2 text-gray-500 dark:text-gray-500 text-sm">
              <Clock className="h-4 w-4 inline mr-1" />
              Total time: {formatTime(debriefData.total_time_seconds)}
            </p>
          </div>

          {/* Achievements */}
          {debriefData.achievements.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5 mb-6">
              <h3 className="text-amber-800 dark:text-amber-300 font-semibold mb-3 flex items-center gap-2">
                <Award className="h-5 w-5" />
                Achievements Unlocked
              </h3>
              <div className="flex flex-wrap gap-2">
                {debriefData.achievements.map((a, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 rounded-full text-sm font-medium"
                  >
                    <Trophy className="h-3.5 w-3.5" />
                    {a.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Critical Actions Checklist */}
          {debriefData.critical_actions.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Critical Actions
              </h3>
              <ul className="space-y-2">
                {debriefData.critical_actions.map((action, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-gray-700 dark:text-gray-300 text-sm"
                  >
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Phase-by-phase breakdown */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Phase Breakdown
            </h3>
            <div className="space-y-3">
              {debriefData.phase_scores.map((ps) => {
                const expanded = expandedPhases.has(ps.phase_id);
                const phasePct =
                  ps.max_points > 0
                    ? Math.round((ps.points / ps.max_points) * 100)
                    : 0;
                return (
                  <div
                    key={ps.phase_id}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                  >
                    <button
                      onClick={() =>
                        setExpandedPhases((prev) => {
                          const next = new Set(prev);
                          if (next.has(ps.phase_id)) {
                            next.delete(ps.phase_id);
                          } else {
                            next.add(ps.phase_id);
                          }
                          return next;
                        })
                      }
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {expanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {ps.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {formatTime(ps.time_seconds)}
                        </span>
                        <span
                          className={`text-sm font-semibold ${
                            phasePct >= 80
                              ? 'text-green-600 dark:text-green-400'
                              : phasePct >= 60
                                ? 'text-yellow-600 dark:text-yellow-400'
                                : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {ps.points}/{ps.max_points}
                        </span>
                      </div>
                    </button>

                    {expanded && (
                      <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-3">
                        {ps.questions.map((q, qi) => (
                          <div
                            key={q.question_id}
                            className="flex items-start gap-3 text-sm"
                          >
                            {q.is_correct ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-800 dark:text-gray-200">
                                {qi + 1}. {q.question_text}
                              </p>
                              {!q.is_correct && q.correct_answer !== null && (
                                <p className="text-green-700 dark:text-green-400 mt-1">
                                  Correct: {displayAnswer(q.correct_answer, q)}
                                </p>
                              )}
                              {q.explanation && (
                                <p className="text-gray-500 dark:text-gray-400 mt-1 italic">
                                  {q.explanation}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                                <span>
                                  {q.points_earned}/{q.max_points} pts
                                </span>
                                {q.time_taken !== null && (
                                  <span>{formatTime(q.time_taken)}</span>
                                )}
                                {q.hints_used > 0 && (
                                  <span className="text-amber-500">
                                    {q.hints_used} hint(s)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Debrief points */}
          {debriefData.debrief_points.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5 mb-6">
              <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Key Takeaways
              </h3>
              <ul className="space-y-2">
                {debriefData.debrief_points.map((point, i) => (
                  <li
                    key={i}
                    className="text-blue-700 dark:text-blue-300 text-sm flex items-start gap-2"
                  >
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-4 mt-8">
            <button
              onClick={() => {
                setScreen('loading');
                setDebriefData(null);
                setPhaseResponses([]);
                setAnsweredQuestions(new Set());
                setCurrentPhaseIdx(0);
                setCurrentQuestionIdx(0);
                setError(null);
                startPractice();
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-5 w-5" />
              Try Again
            </button>
            <button
              onClick={() => router.back()}
              className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold py-4 px-6 rounded-xl transition-colors"
            >
              Back to Library
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-center p-8">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

// ===========================================================================
// Sub-components
// ===========================================================================

function OverallProgressBar({ progress }: { progress: number }) {
  return (
    <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5">
        <div
          className="bg-blue-600 h-1.5 transition-all duration-500"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  );
}

function VitalsGrid({ vitals }: { vitals: PhaseVitals }) {
  const items: Array<{ label: string; value: string | undefined; icon: typeof Heart }> = [
    { label: 'BP', value: vitals.bp, icon: Heart },
    { label: 'HR', value: vitals.hr, icon: Heart },
    { label: 'RR', value: vitals.rr, icon: Heart },
    { label: 'SpO2', value: vitals.spo2, icon: Heart },
    { label: 'EtCO2', value: vitals.etco2, icon: Heart },
    { label: 'Temp', value: vitals.temp, icon: ThermometerSun },
    { label: 'Glucose', value: vitals.glucose, icon: Heart },
    { label: 'GCS', value: vitals.gcs, icon: Heart },
  ];

  const filteredItems = items.filter((i) => i.value);

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {filteredItems.map((item) => (
          <div
            key={item.label}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center"
          >
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              {item.label}
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Additional vitals shown as badges */}
      <div className="mt-3 flex flex-wrap gap-2">
        {vitals.pupils && (
          <span className="inline-flex items-center px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-sm">
            Pupils: {vitals.pupils}
          </span>
        )}
        {vitals.skin && (
          <span className="inline-flex items-center px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-sm">
            Skin: {vitals.skin}
          </span>
        )}
        {vitals.ekg && (
          <span className="inline-flex items-center px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-sm">
            EKG: {vitals.ekg}
          </span>
        )}
      </div>
    </div>
  );
}

function QuestionInput({
  question,
  selectedAnswer,
  onSelectAnswer,
  orderedItems,
  onToggleOrderedItem,
  getOrderPosition,
  onToggleMultiSelect,
}: {
  question: CaseQuestion;
  selectedAnswer: unknown;
  onSelectAnswer: (val: unknown) => void;
  orderedItems: string[];
  onToggleOrderedItem: (item: string) => void;
  getOrderPosition: (item: string) => number;
  onToggleMultiSelect: (optionId: string) => void;
}) {
  switch (question.type) {
    case 'multiple_choice':
      return (
        <div className="space-y-3">
          {(question.options || []).map((opt) => {
            const isSelected = selectedAnswer === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onSelectAnswer(opt.id)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all min-h-[56px] ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    {isSelected && (
                      <span className="h-2.5 w-2.5 rounded-full bg-white" />
                    )}
                  </span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {opt.text}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      );

    case 'multi_select':
      return (
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Select all that apply
          </p>
          {(question.options || []).map((opt) => {
            const isSelected =
              Array.isArray(selectedAnswer) && selectedAnswer.includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => onToggleMultiSelect(opt.id)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all min-h-[56px] ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex-shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                  </span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {opt.text}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      );

    case 'ordered_list': {
      const items = question.items || question.options?.map((o) => o.text) || [];
      return (
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Tap items in the correct order
          </p>
          {items.map((item) => {
            const pos = getOrderPosition(item);
            const isSelected = pos > 0;
            return (
              <button
                key={item}
                onClick={() => onToggleOrderedItem(item)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all min-h-[56px] ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-sm font-bold ${
                      isSelected
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {isSelected ? pos : '-'}
                  </span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {item}
                  </span>
                </div>
              </button>
            );
          })}
          {orderedItems.length > 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Current order: {orderedItems.join(' → ')}
            </p>
          )}
        </div>
      );
    }

    case 'free_text':
      return (
        <div>
          <textarea
            value={typeof selectedAnswer === 'string' ? selectedAnswer : ''}
            onChange={(e) => onSelectAnswer(e.target.value)}
            placeholder="Type your response here..."
            rows={4}
            className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:ring-0 outline-none resize-none"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Free text responses are self-assessed during debrief
          </p>
        </div>
      );

    case 'numeric':
      return (
        <div>
          <input
            type="number"
            value={selectedAnswer !== null && selectedAnswer !== undefined ? String(selectedAnswer) : ''}
            onChange={(e) => onSelectAnswer(e.target.value)}
            placeholder="Enter a number..."
            className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:ring-0 outline-none text-lg"
          />
          {question.tolerance !== undefined && question.tolerance > 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Tolerance: +/- {question.tolerance}
            </p>
          )}
        </div>
      );

    default:
      return (
        <p className="text-gray-500 dark:text-gray-400">
          Unknown question type: {question.type}
        </p>
      );
  }
}
