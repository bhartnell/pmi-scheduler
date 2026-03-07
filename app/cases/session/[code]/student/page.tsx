'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Heart,
  Loader2,
  ThermometerSun,
  Trophy,
  WifiOff,
  X,
  XCircle,
} from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import type {
  CaseQuestion,
  PhaseVitals,
  QuestionOption,
} from '@/types/case-studies';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StudentScreen =
  | 'loading'
  | 'waiting_to_start'
  | 'question'
  | 'submitted'
  | 'waiting_for_next'
  | 'feedback'
  | 'phase_review'
  | 'leaderboard'
  | 'session_end';

interface SessionInfo {
  session_code: string;
  status: string;
  case_title?: string;
  current_phase_idx?: number;
  current_question_idx?: number;
  phase_title?: string;
  student_count?: number;
}

interface QuestionData {
  id: string;
  type: CaseQuestion['type'];
  text: string;
  options?: QuestionOption[];
  items?: string[];
  points?: number;
  time_limit?: number | null;
}

interface FeedbackData {
  is_correct: boolean;
  points_earned: number;
  correct_answer: unknown;
  explanation?: string | null;
  your_answer?: unknown;
}

interface PhaseReviewQuestion {
  question_text: string;
  your_answer: unknown;
  correct_answer: unknown;
  is_correct: boolean;
  points_earned: number;
  max_points: number;
  options?: QuestionOption[] | null;
}

interface PhaseReviewData {
  phase_title: string;
  phase_index: number;
  questions: PhaseReviewQuestion[];
  phase_points: number;
  phase_max_points: number;
  your_rank?: number;
}

interface LeaderboardEntry {
  initials: string;
  name?: string;
  score: number;
  rank: number;
}

interface SessionEndData {
  total_points: number;
  max_points: number;
  percentage: number;
  letter_grade: string;
  final_rank?: number;
  total_students?: number;
  phase_summaries: Array<{
    title: string;
    points: number;
    max_points: number;
  }>;
}

interface QueuedSubmission {
  question_id: string;
  response: unknown;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Helper: display answer value
// ---------------------------------------------------------------------------

function displayAnswer(
  answer: unknown,
  options?: QuestionOption[] | null
): string {
  if (answer === null || answer === undefined) return 'No answer';
  const val =
    typeof answer === 'object' && answer !== null && 'value' in answer
      ? (answer as Record<string, unknown>).value
      : answer;

  if (Array.isArray(val)) {
    if (options) {
      const optMap = new Map(options.map((o) => [o.id, o.text]));
      return val.map((v) => optMap.get(String(v)) || String(v)).join(', ');
    }
    return val.join(', ');
  }
  if (options) {
    const opt = options.find((o) => o.id === String(val));
    if (opt) return opt.text;
  }
  return String(val);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StudentSessionPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  // Session data from sessionStorage
  const [studentSessionId, setStudentSessionId] = useState<string | null>(null);
  const [initials, setInitials] = useState('');
  const [studentName, setStudentName] = useState('');

  // Screen state
  const [screen, setScreen] = useState<StudentScreen>('loading');
  const [error, setError] = useState<string | null>(null);

  // Session info
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [phaseTitle, setPhaseTitle] = useState('');

  // Score
  const [runningScore, setRunningScore] = useState(0);

  // Question state
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<unknown>(null);
  const [orderedItems, setOrderedItems] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Feedback state
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);

  // Phase review state
  const [phaseReview, setPhaseReview] = useState<PhaseReviewData | null>(null);

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Session end state
  const [sessionEnd, setSessionEnd] = useState<SessionEndData | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set());

  // Paused overlay
  const [isPaused, setIsPaused] = useState(false);

  // Realtime connection status
  const [isConnected, setIsConnected] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Offline submission queue
  const [submissionQueue, setSubmissionQueue] = useState<QueuedSubmission[]>([]);
  const [retrying, setRetrying] = useState(false);

  // Vitals panel
  const [showVitals, setShowVitals] = useState(false);
  const [currentVitals, setCurrentVitals] = useState<PhaseVitals | null>(null);
  const [physicalFindings, setPhysicalFindings] = useState<string[]>([]);

  // Student count
  const [studentCount, setStudentCount] = useState<number | undefined>();

  // =========================================================================
  // Initialize from sessionStorage
  // =========================================================================

  useEffect(() => {
    if (!code) return;
    const stored = sessionStorage.getItem(`session_${code.toUpperCase()}`);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setStudentSessionId(data.student_session_id || null);
        setInitials(data.initials || '');
        setStudentName(data.name || '');
      } catch {
        // Bad data, redirect to join
        router.push(`/cases/session/${code}/join`);
      }
    } else {
      // No session data, redirect to join
      router.push(`/cases/session/${code}/join`);
    }
  }, [code, router]);

  // =========================================================================
  // Fetch initial session state
  // =========================================================================

  const fetchSessionState = useCallback(async () => {
    if (!code) return;
    try {
      const res = await fetch(`/api/case-sessions/${code}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Session not found');
          return;
        }
        throw new Error('Failed to fetch session');
      }
      const data = await res.json();
      setSessionInfo(data);

      if (data.student_count !== undefined) {
        setStudentCount(data.student_count);
      }

      // Determine screen based on session status
      if (data.status === 'ended' || data.status === 'completed') {
        if (data.results) {
          setSessionEnd(data.results);
          setScreen('session_end');
        } else {
          setScreen('session_end');
        }
      } else if (data.status === 'paused') {
        setIsPaused(true);
        setScreen('waiting_to_start');
      } else if (data.status === 'waiting' || data.status === 'created') {
        setScreen('waiting_to_start');
      } else if (data.status === 'active' || data.status === 'in_progress') {
        // Session in progress: check if there's a current question
        if (data.current_question) {
          setCurrentQuestion(data.current_question);
          setPhaseTitle(data.phase_title || '');
          if (data.vitals) setCurrentVitals(data.vitals);
          if (data.physical_findings) setPhysicalFindings(data.physical_findings);
          setScreen('question');
        } else {
          setScreen('waiting_to_start');
        }
      } else {
        setScreen('waiting_to_start');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    }
  }, [code]);

  useEffect(() => {
    if (studentSessionId) {
      fetchSessionState();
    }
  }, [studentSessionId, fetchSessionState]);

  // =========================================================================
  // Realtime subscription
  // =========================================================================

  useEffect(() => {
    if (!code || !studentSessionId) return;

    const supabase = getSupabase();
    const channel = supabase
      .channel(`session:${code}`)
      .on('broadcast', { event: 'session_update' }, ({ payload }) => {
        if (!payload) return;

        switch (payload.event) {
          case 'session_start':
            setIsPaused(false);
            if (payload.question) {
              setCurrentQuestion(payload.question);
              setPhaseTitle(payload.phase_title || '');
              if (payload.vitals) setCurrentVitals(payload.vitals);
              if (payload.physical_findings) setPhysicalFindings(payload.physical_findings);
              resetAnswerState();
              setScreen('question');
            } else {
              setScreen('waiting_to_start');
            }
            break;

          case 'new_question':
            setCurrentQuestion(payload.question);
            setPhaseTitle(payload.phase_title || '');
            if (payload.vitals) setCurrentVitals(payload.vitals);
            if (payload.physical_findings) setPhysicalFindings(payload.physical_findings);
            resetAnswerState();
            setScreen('question');
            break;

          case 'reveal_answer':
            setFeedback({
              is_correct: payload.is_correct ?? false,
              points_earned: payload.points_earned ?? 0,
              correct_answer: payload.correct_answer,
              explanation: payload.explanation,
              your_answer: payload.your_answer,
            });
            if (payload.points_earned) {
              setRunningScore((prev) => prev + payload.points_earned);
            }
            setScreen('feedback');
            break;

          case 'phase_review':
            setPhaseReview(payload.review);
            setScreen('phase_review');
            break;

          case 'next_phase':
            setPhaseTitle(payload.phase_title || '');
            if (payload.question) {
              setCurrentQuestion(payload.question);
              if (payload.vitals) setCurrentVitals(payload.vitals);
              if (payload.physical_findings) setPhysicalFindings(payload.physical_findings);
              resetAnswerState();
              setScreen('question');
            } else {
              setScreen('waiting_for_next');
            }
            break;

          case 'show_leaderboard':
            setLeaderboard(payload.leaderboard || []);
            setScreen('leaderboard');
            break;

          case 'session_pause':
            setIsPaused(true);
            break;

          case 'session_resume':
            setIsPaused(false);
            break;

          case 'session_end':
            setIsPaused(false);
            if (payload.results) {
              setSessionEnd(payload.results);
            }
            setScreen('session_end');
            break;

          case 'student_joined':
            if (payload.student_count !== undefined) {
              setStudentCount(payload.student_count);
            }
            break;
        }
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code, studentSessionId]);

  // =========================================================================
  // Fallback polling when realtime is not connected
  // =========================================================================

  useEffect(() => {
    if (isConnected) {
      // Clear polling if connected
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    // Start polling every 5 seconds
    pollingRef.current = setInterval(() => {
      fetchSessionState();
    }, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isConnected, fetchSessionState]);

  // =========================================================================
  // Retry queued submissions
  // =========================================================================

  useEffect(() => {
    if (submissionQueue.length === 0 || retrying || !isConnected) return;

    const retryQueue = async () => {
      setRetrying(true);
      const remaining: QueuedSubmission[] = [];

      for (const item of submissionQueue) {
        try {
          const res = await fetch(`/api/case-sessions/${code}/respond`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              student_session_id: studentSessionId,
              question_id: item.question_id,
              response: item.response,
            }),
          });
          if (!res.ok) {
            remaining.push(item);
          }
        } catch {
          remaining.push(item);
        }
      }

      setSubmissionQueue(remaining);
      setRetrying(false);
    };

    retryQueue();
  }, [submissionQueue, retrying, isConnected, code, studentSessionId]);

  // =========================================================================
  // Answer helpers
  // =========================================================================

  const resetAnswerState = () => {
    setSelectedAnswer(null);
    setOrderedItems([]);
    setSubmitting(false);
    setSubmitted(false);
    setFeedback(null);
  };

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
  // Submit answer
  // =========================================================================

  const submitAnswer = async () => {
    if (!currentQuestion || submitting || submitted) return;

    let responseValue: unknown = selectedAnswer;
    if (currentQuestion.type === 'ordered_list') {
      responseValue = orderedItems;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/case-sessions/${code}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_session_id: studentSessionId,
          question_id: currentQuestion.id,
          response: responseValue,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to submit');
      }

      setSubmitted(true);
      setScreen('submitted');
    } catch {
      // Queue for retry
      setSubmissionQueue((prev) => [
        ...prev,
        {
          question_id: currentQuestion.id,
          response: responseValue,
          timestamp: Date.now(),
        },
      ]);
      setSubmitted(true);
      setScreen('submitted');
    } finally {
      setSubmitting(false);
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
              onClick={() => router.push(`/cases/session/${code}/join`)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200"
            >
              Back to Join
            </button>
          </div>
        ) : (
          <div className="text-center">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Connecting to session...
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-dvh max-w-lg mx-auto flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Reconnecting banner */}
      {!isConnected && (
        <div className="bg-amber-500 text-white text-xs font-medium px-3 py-1.5 flex items-center justify-center gap-1.5">
          <WifiOff className="h-3 w-3" />
          Reconnecting...
        </div>
      )}

      {/* Submission queue indicator */}
      {submissionQueue.length > 0 && (
        <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs font-medium px-3 py-1.5 flex items-center justify-center gap-1.5">
          {retrying ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Retrying submission...
            </>
          ) : (
            <>
              <AlertCircle className="h-3 w-3" />
              {submissionQueue.length} submission(s) pending
            </>
          )}
        </div>
      )}

      {/* Slim Header */}
      <header className="sticky top-0 z-20 h-12 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center px-3 shrink-0">
        <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
          {code?.toUpperCase()}
        </span>
        <span className="flex-1 text-center text-sm font-medium text-gray-700 dark:text-gray-300 truncate px-2">
          {phaseTitle}
        </span>
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
          {initials} — {runningScore} pts
        </span>
      </header>

      {/* Paused Overlay */}
      {isPaused && (
        <div className="fixed inset-0 z-50 bg-gray-900/80 flex items-center justify-center">
          <div className="text-center p-8">
            <div className="h-16 w-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">||</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Session Paused</h2>
            <p className="text-gray-400">
              Waiting for instructor to resume...
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* --- Waiting to Start --- */}
        {screen === 'waiting_to_start' && (
          <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-3rem)] p-6">
            <div className="relative mb-6">
              <span className="block h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/30" />
              <span className="absolute inset-0 h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/30 animate-ping opacity-40" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Waiting for instructor to start...
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
              {studentName || initials}
            </p>
            {studentCount !== undefined && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {studentCount} student{studentCount !== 1 ? 's' : ''} connected
              </p>
            )}
          </div>
        )}

        {/* --- Question --- */}
        {screen === 'question' && currentQuestion && (
          <div className="p-4 pb-24">
            {/* Question text */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 mb-4">
              <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {currentQuestion.text}
              </p>
              {currentQuestion.points !== undefined && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
                  {currentQuestion.points} points
                </p>
              )}
            </div>

            {/* Answer options */}
            <QuestionInput
              question={currentQuestion}
              selectedAnswer={selectedAnswer}
              onSelectAnswer={setSelectedAnswer}
              orderedItems={orderedItems}
              onToggleOrderedItem={toggleOrderedItem}
              getOrderPosition={getOrderPosition}
              onToggleMultiSelect={toggleMultiSelect}
            />

            {/* Submit button (fixed bottom) */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 z-10">
              <div className="max-w-lg mx-auto">
                <button
                  onClick={submitAnswer}
                  disabled={!canSubmit() || submitting || submitted}
                  className={`w-full h-14 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2 ${
                    submitted
                      ? 'bg-green-600 text-white'
                      : submitting
                        ? 'bg-blue-600 text-white'
                        : canSubmit()
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {submitted ? (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      Submitted
                    </>
                  ) : submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Answer'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- Submitted / Waiting for Reveal --- */}
        {screen === 'submitted' && (
          <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-3rem)] p-6">
            <div className="relative mb-6">
              <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Answer submitted!
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              Waiting for reveal...
            </p>
            <div className="bg-white dark:bg-gray-800 rounded-xl px-6 py-3 border border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">Running score: </span>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {runningScore} pts
              </span>
            </div>
            {/* Subtle gradient animation ring */}
            <div className="mt-8">
              <div className="h-2 w-32 rounded-full bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 animate-pulse" />
            </div>
          </div>
        )}

        {/* --- Waiting for Next Question --- */}
        {screen === 'waiting_for_next' && (
          <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-3rem)] p-6">
            <div className="relative mb-6">
              <span className="block h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30" />
              <span className="absolute inset-0 h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 animate-ping opacity-40" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Next question coming up...
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {runningScore} pts so far
            </p>
          </div>
        )}

        {/* --- Feedback --- */}
        {screen === 'feedback' && feedback && (
          <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-3rem)] p-6">
            {/* Large icon */}
            <div className={`h-24 w-24 rounded-full flex items-center justify-center mb-4 ${
              feedback.is_correct
                ? 'bg-green-100 dark:bg-green-900/30'
                : 'bg-red-100 dark:bg-red-900/30'
            }`}>
              {feedback.is_correct ? (
                <CheckCircle2 className="h-14 w-14 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="h-14 w-14 text-red-600 dark:text-red-400" />
              )}
            </div>

            {/* Result text */}
            <h2 className={`text-xl font-bold mb-1 ${
              feedback.is_correct
                ? 'text-green-700 dark:text-green-400'
                : 'text-red-700 dark:text-red-400'
            }`}>
              {feedback.is_correct
                ? `Correct! +${feedback.points_earned} pts`
                : 'Incorrect'}
            </h2>

            {/* Your answer if incorrect */}
            {!feedback.is_correct && feedback.your_answer !== undefined && (
              <div className="mt-4 w-full max-w-sm">
                <p className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wider mb-1">
                  Your answer
                </p>
                <p className="text-gray-700 dark:text-gray-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-sm">
                  {displayAnswer(feedback.your_answer, currentQuestion?.options)}
                </p>
              </div>
            )}

            {/* Correct answer */}
            {feedback.correct_answer !== undefined && feedback.correct_answer !== null && (
              <div className="mt-3 w-full max-w-sm">
                <p className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wider mb-1">
                  Correct answer
                </p>
                <p className="text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 text-sm font-medium">
                  {displayAnswer(feedback.correct_answer, currentQuestion?.options)}
                </p>
              </div>
            )}

            {/* Explanation */}
            {feedback.explanation && (
              <div className="mt-4 w-full max-w-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {feedback.explanation}
                </p>
              </div>
            )}

            {/* Points earned */}
            <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl px-6 py-3 border border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">Score: </span>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {runningScore} pts
              </span>
            </div>
          </div>
        )}

        {/* --- Phase Review --- */}
        {screen === 'phase_review' && phaseReview && (
          <div className="p-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
              Phase {phaseReview.phase_index + 1} Review
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              {phaseReview.phase_title}
            </p>

            {/* Phase score */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 mb-4 flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300 font-medium text-sm">
                Phase Score
              </span>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {phaseReview.phase_points} / {phaseReview.phase_max_points} pts
              </span>
            </div>

            {phaseReview.your_rank !== undefined && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Your rank: #{phaseReview.your_rank}
              </p>
            )}

            {/* Questions */}
            <div className="space-y-3">
              {phaseReview.questions.map((q, idx) => (
                <div
                  key={idx}
                  className={`bg-white dark:bg-gray-800 rounded-xl p-4 border ${
                    q.is_correct
                      ? 'border-green-200 dark:border-green-800'
                      : 'border-red-200 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    {q.is_correct ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {q.question_text}
                      </p>
                      <p className={`text-xs mt-1 ${
                        q.is_correct
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {q.points_earned} / {q.max_points} pts
                      </p>
                    </div>
                  </div>

                  {/* Your answer */}
                  <div className="ml-7 text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Your answer: {displayAnswer(q.your_answer, q.options)}
                  </div>

                  {/* Correct answer if wrong */}
                  {!q.is_correct && (
                    <div className="ml-7 text-xs text-green-700 dark:text-green-400">
                      Correct: {displayAnswer(q.correct_answer, q.options)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- Leaderboard --- */}
        {screen === 'leaderboard' && (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Leaderboard
              </h2>
            </div>

            <div className="space-y-2">
              {leaderboard.map((entry) => {
                const isYou = entry.initials === initials;
                const medal =
                  entry.rank === 1 ? '\u{1F947}' :
                  entry.rank === 2 ? '\u{1F948}' :
                  entry.rank === 3 ? '\u{1F949}' : null;

                return (
                  <div
                    key={`${entry.rank}-${entry.initials}`}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                      isYou
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <span className="w-8 text-center text-sm font-bold text-gray-500 dark:text-gray-400">
                      {medal || `#${entry.rank}`}
                    </span>
                    <span className={`flex-1 font-medium text-sm ${
                      isYou
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-gray-800 dark:text-gray-200'
                    }`}>
                      {entry.initials}
                      {isYou && ' (you)'}
                    </span>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                      {entry.score} pts
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- Session End --- */}
        {screen === 'session_end' && (
          <div className="p-4">
            {sessionEnd ? (
              <>
                {/* Score hero */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 text-center mb-6">
                  <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                    Attempt Complete
                  </h2>
                  <div className="mb-3">
                    <span
                      className={`inline-flex items-center justify-center h-20 w-20 rounded-full text-3xl font-bold ${
                        sessionEnd.percentage >= 90
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : sessionEnd.percentage >= 70
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}
                    >
                      {sessionEnd.letter_grade}
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                    {sessionEnd.percentage}%
                  </p>
                  <p className="text-gray-500 dark:text-gray-500 text-sm">
                    {sessionEnd.total_points} / {sessionEnd.max_points} points
                  </p>

                  {sessionEnd.final_rank !== undefined && (
                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-full text-sm font-medium">
                      <Trophy className="h-4 w-4" />
                      Rank #{sessionEnd.final_rank}
                      {sessionEnd.total_students && ` of ${sessionEnd.total_students}`}
                    </div>
                  )}
                </div>

                {/* Phase-by-phase summary */}
                {sessionEnd.phase_summaries.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Phase Summary
                    </h3>
                    <div className="space-y-2">
                      {sessionEnd.phase_summaries.map((ps, idx) => {
                        const expanded = expandedPhases.has(idx);
                        const pct = ps.max_points > 0
                          ? Math.round((ps.points / ps.max_points) * 100)
                          : 0;

                        return (
                          <div
                            key={idx}
                            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                          >
                            <button
                              onClick={() =>
                                setExpandedPhases((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(idx)) {
                                    next.delete(idx);
                                  } else {
                                    next.add(idx);
                                  }
                                  return next;
                                })
                              }
                              className="w-full p-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                {expanded ? (
                                  <ChevronDown className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-400" />
                                )}
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {ps.title}
                                </span>
                              </div>
                              <span
                                className={`text-sm font-semibold ${
                                  pct >= 80
                                    ? 'text-green-600 dark:text-green-400'
                                    : pct >= 60
                                      ? 'text-yellow-600 dark:text-yellow-400'
                                      : 'text-red-600 dark:text-red-400'
                                }`}
                              >
                                {ps.points}/{ps.max_points}
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Back to Library */}
                <button
                  onClick={() => router.push('/cases')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-colors"
                >
                  Back to Library
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-3rem)] p-6">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Session has ended
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                  Your score: {runningScore} pts
                </p>
                <button
                  onClick={() => router.push('/cases')}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
                >
                  Back to Library
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Collapsible Vitals Panel */}
      {currentVitals && (screen === 'question' || screen === 'submitted' || screen === 'feedback') && (
        <>
          {/* Trigger button */}
          <button
            onClick={() => setShowVitals(true)}
            className="fixed bottom-20 right-4 z-10 flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronUp className="h-4 w-4" />
            View Vitals
          </button>

          {/* Bottom sheet */}
          {showVitals && (
            <div
              className="fixed inset-0 z-50"
              onClick={() => setShowVitals(false)}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/40" />

              {/* Sheet */}
              <div
                className="absolute bottom-0 left-0 right-0 max-h-[70dvh] overflow-y-auto bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Handle */}
                <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 pt-3 pb-2 px-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
                  <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto" />
                  <button
                    onClick={() => setShowVitals(false)}
                    className="absolute right-3 top-3 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-4">
                  <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
                    Patient Vitals
                  </h3>
                  <VitalsGrid vitals={currentVitals} />

                  {physicalFindings.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">
                        Physical Findings
                      </h3>
                      <ul className="space-y-2">
                        {physicalFindings.map((finding, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                          >
                            <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-500" />
                            {finding}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ===========================================================================
// Sub-components
// ===========================================================================

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
      <div className="grid grid-cols-2 gap-2">
        {filteredItems.map((item) => (
          <div
            key={item.label}
            className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700 text-center"
          >
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">
              {item.label}
            </p>
            <p className="text-base font-bold text-gray-900 dark:text-gray-100">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {vitals.pupils && (
          <span className="inline-flex items-center px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-xs">
            Pupils: {vitals.pupils}
          </span>
        )}
        {vitals.skin && (
          <span className="inline-flex items-center px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-xs">
            Skin: {vitals.skin}
          </span>
        )}
        {vitals.ekg && (
          <span className="inline-flex items-center px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-xs">
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
  question: QuestionData;
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
      const listItems = question.items || question.options?.map((o) => o.text) || [];
      return (
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Tap items in the correct order
          </p>
          {listItems.map((item) => {
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
              Current order: {orderedItems.join(' \u2192 ')}
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
            className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:ring-0 outline-none resize-none text-base"
          />
        </div>
      );

    case 'numeric':
      return (
        <div>
          <input
            type="number"
            inputMode="decimal"
            value={selectedAnswer !== null && selectedAnswer !== undefined ? String(selectedAnswer) : ''}
            onChange={(e) => onSelectAnswer(e.target.value)}
            placeholder="Enter a number..."
            className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:ring-0 outline-none text-2xl font-mono"
          />
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
