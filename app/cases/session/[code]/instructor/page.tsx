'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  Loader2,
  Monitor,
  Pause,
  Play,
  SkipForward,
  Square,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import type {
  CaseStudy,
  CasePhase,
  CaseQuestion,
  PhaseVitals,
} from '@/types/case-studies';
import { getSupabase } from '@/lib/supabase';
import Breadcrumbs from '@/components/Breadcrumbs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JoinedStudent {
  student_session_id: string;
  student_id: string | null;
  student_email: string | null;
  student_name: string;
  initials: string;
  joined_at: string;
}

interface SessionSettings {
  show_leaderboard?: boolean;
  show_results_live?: boolean;
  anonymous?: boolean;
  time_limit?: number | null;
  allow_hints?: boolean;
  speed_bonus?: boolean;
  answer_revealed?: boolean;
  current_display?: string;
  joined_students?: JoinedStudent[];
}

interface SessionState {
  id: string;
  session_code: string;
  status: 'waiting' | 'active' | 'paused' | 'completed' | 'cancelled';
  current_phase: number;
  current_question: number;
  instructor_email: string;
  cohort_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  settings: SessionSettings;
}

interface ResponseRecord {
  id: string;
  session_id: string;
  student_id: string | null;
  student_email: string | null;
  student_name: string | null;
  student_initials: string | null;
  phase_id: string;
  question_id: string;
  response: { value: unknown } | null;
  is_correct: boolean | null;
  points_earned: number;
  submitted_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatElapsed(startedAt: string | null): string {
  if (!startedAt) return '0:00';
  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getOptionLabel(index: number): string {
  return String.fromCharCode(65 + index); // A, B, C, D...
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InstructorControlPanel() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { data: authSession, status: authStatus } = useSession();

  // Core state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [caseStudy, setCaseStudy] = useState<CaseStudy | null>(null);
  const [joinedStudents, setJoinedStudents] = useState<JoinedStudent[]>([]);
  const [responses, setResponses] = useState<ResponseRecord[]>([]);
  const [scoresByStudent, setScoresByStudent] = useState<Record<string, number>>({});

  // UI state
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [codeCopied, setCodeCopied] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('0:00');
  const [answerRevealed, setAnswerRevealed] = useState(false);

  // Refs
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeRef = useRef<ReturnType<typeof getSupabase.prototype.channel> | null>(null);

  // =========================================================================
  // Data fetching
  // =========================================================================

  const fetchData = useCallback(async () => {
    if (!code) return;

    try {
      const res = await fetch(`/api/case-sessions/${code}/instructor`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch session data');
      }
      const data = await res.json();

      setSessionState(data.session);
      setCaseStudy(data.case_study);
      setJoinedStudents(data.joined_students || []);
      setResponses(data.phase_breakdowns
        ? data.phase_breakdowns.flatMap((pb: { questions: Array<{ responses: ResponseRecord[] }> }) =>
            pb.questions.flatMap((q: { responses: ResponseRecord[] }) => q.responses)
          )
        : []);
      setScoresByStudent(data.scores_by_student || {});
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [code]);

  // Initial fetch
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    if (authStatus === 'authenticated') {
      fetchData();
    }
  }, [authStatus, fetchData, router]);

  // Elapsed timer
  useEffect(() => {
    if (sessionState?.status === 'active' && sessionState.started_at) {
      const update = () => setElapsedTime(formatElapsed(sessionState.started_at));
      update();
      timerRef.current = setInterval(update, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    return undefined;
  }, [sessionState?.status, sessionState?.started_at]);

  // Track answer_revealed from settings
  useEffect(() => {
    if (sessionState?.settings?.answer_revealed !== undefined) {
      setAnswerRevealed(!!sessionState.settings.answer_revealed);
    }
  }, [sessionState?.settings?.answer_revealed]);

  // =========================================================================
  // Realtime subscription
  // =========================================================================

  useEffect(() => {
    if (!code) return;

    const supabase = getSupabase();
    const channel = supabase.channel(`session:${code}`);

    channel.on('broadcast', { event: 'session_update' }, (payload) => {
      const data = payload.payload as Record<string, unknown>;
      const event = data.event as string;

      if (event === 'student_joined') {
        setJoinedStudents((prev) => {
          const existing = prev.find(
            (s) => s.student_session_id === data.student_session_id
          );
          if (existing) return prev;
          return [
            ...prev,
            {
              student_session_id: data.student_session_id as string,
              student_id: null,
              student_email: null,
              student_name: data.student_name as string,
              initials: data.initials as string,
              joined_at: new Date().toISOString(),
            },
          ];
        });
      }

      if (event === 'response_submitted' || event === 'response_count') {
        // Refetch full data to get accurate response counts
        fetchData();
      }
    });

    channel.subscribe();
    realtimeRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code, fetchData]);

  // Poll as fallback every 10 seconds
  useEffect(() => {
    if (!code || loading) return;
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [code, loading, fetchData]);

  // =========================================================================
  // Actions
  // =========================================================================

  const sendAction = useCallback(
    async (action: string) => {
      if (!code || actionLoading) return;
      setActionLoading(action);

      try {
        const res = await fetch(`/api/case-sessions/${code}/instructor`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Failed to ${action}`);
        }

        // Track local state for reveal
        if (action === 'reveal_answer') {
          setAnswerRevealed(true);
        } else if (action === 'next_question' || action === 'next_phase' || action === 'start_session') {
          setAnswerRevealed(false);
        }

        // Refetch data to sync state
        await fetchData();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Action failed');
      } finally {
        setActionLoading(null);
      }
    },
    [code, actionLoading, fetchData]
  );

  const copyCode = useCallback(() => {
    if (!sessionState?.session_code) return;
    navigator.clipboard.writeText(sessionState.session_code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }, [sessionState?.session_code]);

  const openTvDisplay = useCallback(() => {
    if (!code) return;
    window.open(`/cases/session/${code}/tv`, '_blank');
  }, [code]);

  // =========================================================================
  // Derived state
  // =========================================================================

  const phases = (caseStudy?.phases || []) as CasePhase[];
  const currentPhaseIdx = sessionState?.current_phase ?? 0;
  const currentQuestionIdx = sessionState?.current_question ?? 0;
  const currentPhase = phases[currentPhaseIdx] as CasePhase | undefined;
  const currentQuestions = currentPhase?.questions || [];
  const currentQuestion = currentQuestions[currentQuestionIdx] as CaseQuestion | undefined;

  const totalPhases = phases.length;
  const totalQuestionsInPhase = currentQuestions.length;
  const isLastQuestion = currentQuestionIdx >= totalQuestionsInPhase - 1;
  const isLastPhase = currentPhaseIdx >= totalPhases - 1;

  // Count responses for current question
  const currentQuestionResponses = responses.filter(
    (r) =>
      r.phase_id === currentPhase?.id &&
      r.question_id === currentQuestion?.id
  );
  const responseCount = currentQuestionResponses.length;
  const studentCount = joinedStudents.length;

  // Response distribution
  const responseDistribution: Record<string, number> = {};
  if (currentQuestion?.options) {
    for (const opt of currentQuestion.options) {
      responseDistribution[opt.id] = 0;
    }
  }
  for (const r of currentQuestionResponses) {
    const value = r.response?.value;
    if (typeof value === 'string') {
      responseDistribution[value] = (responseDistribution[value] || 0) + 1;
    }
  }
  const maxDistribution = Math.max(1, ...Object.values(responseDistribution));

  // Student submission status for current question
  const respondedStudentIds = new Set(
    currentQuestionResponses.map(
      (r) => r.student_initials || r.student_name || r.student_email || ''
    )
  );

  // Progress percentage
  const totalQuestions = phases.reduce(
    (sum, p) => sum + (p.questions?.length || 0),
    0
  );
  const questionsCompleted =
    phases.slice(0, currentPhaseIdx).reduce(
      (sum, p) => sum + (p.questions?.length || 0),
      0
    ) + currentQuestionIdx;
  const progressPct =
    totalQuestions > 0 ? Math.round((questionsCompleted / totalQuestions) * 100) : 0;

  // =========================================================================
  // Loading / Error states
  // =========================================================================

  if (authStatus === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Loading session...
          </p>
        </div>
      </div>
    );
  }

  if (error && !sessionState) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Unable to Load Session
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {error}
          </p>
          <button
            onClick={() => router.push('/cases')}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Return to Cases
          </button>
        </div>
      </div>
    );
  }

  if (!sessionState || !caseStudy) return null;

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Breadcrumb */}
      <div className="max-w-full mx-auto px-4 pt-3">
        <Breadcrumbs
          customSegments={{ [code]: `Session ${code}`, 'instructor': 'Instructor' }}
          className="mb-0"
        />
      </div>
      {/* ===== Header Bar (sticky) ===== */}
      <div className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Left: Session code + student count */}
          <div className="flex items-center gap-4">
            <button
              onClick={copyCode}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title="Copy session code"
            >
              <span className="text-lg font-mono font-bold tracking-widest text-gray-900 dark:text-white">
                {sessionState.session_code}
              </span>
              {codeCopied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 text-gray-400" />
              )}
            </button>

            <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
              <Users className="h-4 w-4" />
              <span className="font-medium">{studentCount}</span>
              <span>joined</span>
            </div>

            {sessionState.status === 'active' && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                <Clock className="h-4 w-4" />
                <span className="font-mono">{elapsedTime}</span>
              </div>
            )}
          </div>

          {/* Center: Case title */}
          <div className="hidden md:block text-center flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {caseStudy.title}
            </h1>
          </div>

          {/* Right: TV display + sidebar toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={openTvDisplay}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              <Monitor className="h-4 w-4" />
              TV Display
            </button>
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors md:hidden"
              title="Toggle student sidebar"
            >
              <Users className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Progress Indicator */}
        {sessionState.status !== 'waiting' && (
          <div className="px-4 pb-2">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>
                Phase {currentPhaseIdx + 1} of {totalPhases}
                {currentPhase && ` - ${currentPhase.title}`}
                {' | '}
                Question {currentQuestionIdx + 1} of {totalQuestionsInPhase}
              </span>
              <span>{progressPct}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ===== Error Banner ===== */}
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ===== Main Content ===== */}
      <div className="flex-1 flex">
        {/* Main Area */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {/* ----- Waiting State: Pre-start ----- */}
          {sessionState.status === 'waiting' && (
            <div className="max-w-lg mx-auto text-center py-12">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Waiting for Students
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Share the code below with your students to join
                </p>

                <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-6 mb-6">
                  <p className="text-5xl font-mono font-bold tracking-[0.3em] text-gray-900 dark:text-white">
                    {sessionState.session_code}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    pmiparamedic.tools/cases/session/{sessionState.session_code}/join
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2 text-lg font-medium text-gray-700 dark:text-gray-300 mb-8">
                  <Users className="h-5 w-5" />
                  <span>
                    {studentCount} student{studentCount !== 1 ? 's' : ''} joined
                  </span>
                </div>

                <button
                  onClick={() => sendAction('start_session')}
                  disabled={!!actionLoading || studentCount === 0}
                  className="w-full h-14 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {actionLoading === 'start_session' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                  Start Session
                </button>
                {studentCount === 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    Waiting for at least 1 student to join
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ----- Active / Paused State ----- */}
          {(sessionState.status === 'active' || sessionState.status === 'paused') &&
            currentQuestion && (
              <div className="max-w-3xl mx-auto">
                {/* Phase presentation text (first question of phase) */}
                {currentQuestionIdx === 0 && currentPhase?.presentation_text && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-4">
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      {currentPhase.presentation_text}
                    </p>
                  </div>
                )}

                {/* Vitals display */}
                {currentPhase?.vitals && Object.keys(currentPhase.vitals).length > 0 && currentQuestionIdx === 0 && (
                  <VitalsGrid vitals={currentPhase.vitals} />
                )}

                {/* Current Question */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-4">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white pr-4">
                      {currentQuestion.text}
                    </h3>
                    <span className="flex-shrink-0 px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                      {currentQuestion.points || 10} pts
                    </span>
                  </div>

                  {/* Answer options */}
                  {currentQuestion.options && (
                    <div className="space-y-2 mb-4">
                      {currentQuestion.options.map((opt, idx) => {
                        const isCorrect =
                          answerRevealed &&
                          currentQuestion.correct_answer === opt.id;
                        const isWrong = answerRevealed && !isCorrect;

                        return (
                          <div
                            key={opt.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                              isCorrect
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                                : isWrong
                                ? 'opacity-40 border-gray-200 dark:border-gray-700'
                                : 'border-gray-200 dark:border-gray-700'
                            }`}
                          >
                            <span
                              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                isCorrect
                                  ? 'bg-green-600 text-white'
                                  : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {getOptionLabel(idx)}
                            </span>
                            <span
                              className={`text-sm ${
                                isCorrect
                                  ? 'text-green-800 dark:text-green-300 font-medium'
                                  : 'text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {opt.text}
                            </span>
                            {isCorrect && (
                              <Check className="h-5 w-5 text-green-600 ml-auto flex-shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Response count bar */}
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <BarChart3 className="h-4 w-4" />
                    <span className="font-medium">
                      {responseCount}/{studentCount} answered
                    </span>
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          responseCount >= studentCount
                            ? 'bg-green-500'
                            : 'bg-blue-500'
                        }`}
                        style={{
                          width: `${
                            studentCount > 0
                              ? Math.round((responseCount / studentCount) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Response distribution (show always during reveal, or when show_results_live) */}
                  {(answerRevealed || sessionState.settings?.show_results_live) &&
                    currentQuestion.options && (
                      <div className="space-y-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                          Response Distribution
                        </h4>
                        {currentQuestion.options.map((opt, idx) => {
                          const count = responseDistribution[opt.id] || 0;
                          const pct =
                            responseCount > 0
                              ? Math.round((count / responseCount) * 100)
                              : 0;
                          const isCorrect =
                            currentQuestion.correct_answer === opt.id;

                          return (
                            <div key={opt.id} className="flex items-center gap-2">
                              <span className="w-6 text-xs font-bold text-gray-500 dark:text-gray-400 text-right">
                                {getOptionLabel(idx)}
                              </span>
                              <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden relative">
                                <div
                                  className={`h-full rounded transition-all duration-700 ${
                                    answerRevealed && isCorrect
                                      ? 'bg-green-500'
                                      : answerRevealed
                                      ? 'bg-red-400 dark:bg-red-600'
                                      : 'bg-blue-500'
                                  }`}
                                  style={{
                                    width: `${
                                      maxDistribution > 0
                                        ? Math.round(
                                            (count / maxDistribution) * 100
                                          )
                                        : 0
                                    }%`,
                                  }}
                                />
                                <span className="absolute inset-0 flex items-center pl-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                                  {count} ({pct}%)
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                  {/* Explanation (after reveal) */}
                  {answerRevealed && currentQuestion.explanation && (
                    <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <h4 className="text-sm font-semibold text-green-800 dark:text-green-300 mb-1">
                        Explanation
                      </h4>
                      <p className="text-sm text-green-700 dark:text-green-400">
                        {currentQuestion.explanation}
                      </p>
                    </div>
                  )}
                </div>

                {/* ===== Action Buttons ===== */}
                <div className="flex flex-wrap gap-3 mt-6">
                  {/* During questions: Reveal -> Next */}
                  {!answerRevealed && (
                    <button
                      onClick={() => sendAction('reveal_answer')}
                      disabled={!!actionLoading}
                      className="flex-1 min-w-[140px] h-12 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      {actionLoading === 'reveal_answer' ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                      Reveal Answer
                    </button>
                  )}

                  {answerRevealed && !isLastQuestion && (
                    <button
                      onClick={() => sendAction('next_question')}
                      disabled={!!actionLoading}
                      className="flex-1 min-w-[140px] h-12 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      {actionLoading === 'next_question' ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                      Next Question
                    </button>
                  )}

                  {/* End of phase controls */}
                  {answerRevealed && isLastQuestion && (
                    <>
                      <button
                        onClick={() => sendAction('show_phase_review')}
                        disabled={!!actionLoading}
                        className="flex-1 min-w-[140px] h-12 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        {actionLoading === 'show_phase_review' ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <BarChart3 className="h-5 w-5" />
                        )}
                        Phase Review
                      </button>

                      {sessionState.settings?.show_leaderboard && (
                        <button
                          onClick={() => sendAction('show_leaderboard')}
                          disabled={!!actionLoading}
                          className="flex-1 min-w-[140px] h-12 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          {actionLoading === 'show_leaderboard' ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Trophy className="h-5 w-5" />
                          )}
                          Leaderboard
                        </button>
                      )}

                      {!isLastPhase ? (
                        <button
                          onClick={() => sendAction('next_phase')}
                          disabled={!!actionLoading}
                          className="flex-1 min-w-[140px] h-12 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          {actionLoading === 'next_phase' ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <ArrowRight className="h-5 w-5" />
                          )}
                          Next Phase
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowEndConfirm(true)}
                          disabled={!!actionLoading}
                          className="flex-1 min-w-[140px] h-12 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          <Square className="h-5 w-5" />
                          End Session
                        </button>
                      )}
                    </>
                  )}

                  {/* Pause / Resume */}
                  {sessionState.status === 'active' && (
                    <button
                      onClick={() => sendAction('pause_session')}
                      disabled={!!actionLoading}
                      className="h-12 px-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      {actionLoading === 'pause_session' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Pause className="h-4 w-4" />
                      )}
                      Pause
                    </button>
                  )}

                  {sessionState.status === 'paused' && (
                    <button
                      onClick={() => sendAction('resume_session')}
                      disabled={!!actionLoading}
                      className="h-12 px-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      {actionLoading === 'resume_session' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      Resume
                    </button>
                  )}

                  {/* End Session (always available) */}
                  {!isLastQuestion || !isLastPhase ? (
                    <button
                      onClick={() => setShowEndConfirm(true)}
                      disabled={!!actionLoading}
                      className="h-12 px-4 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 text-red-700 dark:text-red-400 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 border border-red-200 dark:border-red-800"
                    >
                      <Square className="h-4 w-4" />
                      End
                    </button>
                  ) : null}
                </div>
              </div>
            )}

          {/* ----- Completed State ----- */}
          {sessionState.status === 'completed' && (
            <div className="max-w-lg mx-auto text-center py-12">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
                <Trophy className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Session Complete
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  The session has ended. Results are available on the TV display.
                </p>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {studentCount}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Students
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {totalQuestions}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Questions
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/cases')}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Return to Cases
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ===== Student Sidebar ===== */}
        {showSidebar && (
          <div className="w-72 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto hidden md:block">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Students ({studentCount})
                </h3>
                <button
                  onClick={() => setShowSidebar(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {joinedStudents.map((student) => {
                const hasResponded = respondedStudentIds.has(student.initials);
                const studentKey =
                  student.student_id ||
                  student.student_email ||
                  student.student_name;
                const score = scoresByStudent[studentKey] || 0;

                return (
                  <div
                    key={student.student_session_id}
                    className="px-4 py-2.5 flex items-center gap-3"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300">
                      {student.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {student.student_name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>{score} pts</span>
                        {sessionState.status === 'active' && (
                          <span
                            className={`inline-flex items-center gap-0.5 ${
                              hasResponded
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-amber-500 dark:text-amber-400'
                            }`}
                          >
                            {hasResponded ? (
                              <>
                                <Check className="h-3 w-3" />
                                submitted
                              </>
                            ) : (
                              <>
                                <Clock className="h-3 w-3" />
                                waiting
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {joinedStudents.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                  No students have joined yet
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sidebar toggle (when hidden) */}
        {!showSidebar && (
          <button
            onClick={() => setShowSidebar(true)}
            className="hidden md:flex fixed right-4 top-20 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors z-20"
            title="Show student sidebar"
          >
            <Users className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* ===== End Session Confirmation Dialog ===== */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              End Session?
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              This will end the session for all students. This action cannot be
              undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowEndConfirm(false);
                  sendAction('end_session');
                }}
                disabled={!!actionLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading === 'end_session' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'End Session'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// VitalsGrid sub-component
// ---------------------------------------------------------------------------

function VitalsGrid({ vitals }: { vitals: PhaseVitals }) {
  const vitalEntries = [
    { key: 'bp', label: 'BP', unit: 'mmHg' },
    { key: 'hr', label: 'HR', unit: 'bpm' },
    { key: 'rr', label: 'RR', unit: '/min' },
    { key: 'spo2', label: 'SpO2', unit: '%' },
    { key: 'etco2', label: 'EtCO2', unit: 'mmHg' },
    { key: 'temp', label: 'Temp', unit: '' },
    { key: 'glucose', label: 'BGL', unit: 'mg/dL' },
    { key: 'gcs', label: 'GCS', unit: '' },
  ].filter((v) => vitals[v.key as keyof PhaseVitals]);

  if (vitalEntries.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
      {vitalEntries.map((v) => (
        <div
          key={v.key}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-center"
        >
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {v.label}
          </p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {vitals[v.key as keyof PhaseVitals]}
          </p>
          {v.unit && (
            <p className="text-xs text-gray-400 dark:text-gray-500">{v.unit}</p>
          )}
        </div>
      ))}
    </div>
  );
}
