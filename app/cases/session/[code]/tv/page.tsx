'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  Award,
  BarChart3,
  Check,
  Clock,
  Heart,
  Loader2,
  Medal,
  Stethoscope,
  Trophy,
  Users,
} from 'lucide-react';
import type {
  CaseStudy,
  CasePhase,
  CaseQuestion,
  PhaseVitals,
} from '@/types/case-studies';
import { getSupabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TVDisplay =
  | 'join'
  | 'question'
  | 'reveal'
  | 'phase_review'
  | 'leaderboard'
  | 'session_end'
  | 'paused'
  | 'loading';

interface SessionInfo {
  id: string;
  session_code: string;
  status: 'waiting' | 'active' | 'paused' | 'completed' | 'cancelled';
  current_phase: number;
  current_question: number;
  student_count: number;
  started_at: string | null;
  settings: {
    show_leaderboard?: boolean;
    anonymous?: boolean;
    time_limit?: number | null;
    allow_hints?: boolean;
    speed_bonus?: boolean;
  };
}

interface CaseInfo {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  difficulty: string | null;
}

interface LeaderboardEntry {
  initials: string;
  name: string;
  total_points: number;
  rank: number;
}

interface ResponseDistribution {
  [optionId: string]: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getOptionLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

function formatElapsed(startedAt: string | null): string {
  if (!startedAt) return '0:00';
  const elapsed = Math.floor(
    (Date.now() - new Date(startedAt).getTime()) / 1000
  );
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TVDisplayPage() {
  const { code } = useParams<{ code: string }>();

  // Core state
  const [display, setDisplay] = useState<TVDisplay>('loading');
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [caseStudy, setCaseStudy] = useState<CaseStudy | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Question state
  const [currentPhaseIdx, setCurrentPhaseIdx] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [responseCount, setResponseCount] = useState(0);
  const [studentCount, setStudentCount] = useState(0);
  const [responseDistribution, setResponseDistribution] = useState<ResponseDistribution>({});

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Phase review state
  const [phaseReviewData, setPhaseReviewData] = useState<
    Array<{ question_text: string; correct_count: number; total_count: number }>
  >([]);

  // Timer
  const [elapsedTime, setElapsedTime] = useState('0:00');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulsing dots animation ref
  const [dotPhase, setDotPhase] = useState(0);

  // =========================================================================
  // Fetch session status (public endpoint, no auth)
  // =========================================================================

  const fetchStatus = useCallback(async () => {
    if (!code) return;

    try {
      const res = await fetch(`/api/case-sessions/${code}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Session not found');
      }
      const data = await res.json();

      setSessionInfo(data.session);
      setCaseInfo(data.case_info);
      setStudentCount(data.session.student_count || 0);

      // Set display mode based on status
      if (data.session.status === 'waiting') {
        setDisplay('join');
      } else if (data.session.status === 'completed') {
        setDisplay('session_end');
      } else if (data.session.status === 'paused') {
        setDisplay('paused');
      } else if (data.session.status === 'active') {
        setCurrentPhaseIdx(data.session.current_phase);
        setCurrentQuestionIdx(data.session.current_question);
        // Keep current display state if set by realtime; default to question
        setDisplay((prev) =>
          prev === 'loading' || prev === 'join' ? 'question' : prev
        );
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    }
  }, [code]);

  // Fetch full case data (needed for questions/options)
  const fetchCaseData = useCallback(async () => {
    if (!caseInfo?.id) return;

    try {
      const res = await fetch(`/api/cases/${caseInfo.id}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success || data.id) {
        setCaseStudy(data.success ? data.case : data);
      }
    } catch {
      // Non-critical — we can still show partial data
    }
  }, [caseInfo?.id]);

  // =========================================================================
  // Effects
  // =========================================================================

  // Initial load
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Fetch case data when caseInfo is available
  useEffect(() => {
    if (caseInfo?.id && !caseStudy) {
      fetchCaseData();
    }
  }, [caseInfo?.id, caseStudy, fetchCaseData]);

  // Poll every 10 seconds as fallback
  useEffect(() => {
    if (!code) return;
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [code, fetchStatus]);

  // Elapsed timer
  useEffect(() => {
    if (sessionInfo?.status === 'active' && sessionInfo.started_at) {
      const update = () => setElapsedTime(formatElapsed(sessionInfo.started_at));
      update();
      timerRef.current = setInterval(update, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    return undefined;
  }, [sessionInfo?.status, sessionInfo?.started_at]);

  // Pulsing dot animation for waiting screen
  useEffect(() => {
    if (display !== 'join') return;
    const interval = setInterval(() => {
      setDotPhase((p) => (p + 1) % 3);
    }, 600);
    return () => clearInterval(interval);
  }, [display]);

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

      switch (event) {
        case 'student_joined': {
          setStudentCount(
            (data.student_count as number) || ((prev: number) => prev + 1)
          );
          break;
        }

        case 'session_start':
        case 'start_session': {
          setCurrentPhaseIdx((data.current_phase as number) ?? 0);
          setCurrentQuestionIdx((data.current_question as number) ?? 0);
          setResponseCount(0);
          setResponseDistribution({});
          setDisplay('question');
          // Refetch to get full case data
          fetchStatus();
          break;
        }

        case 'new_question':
        case 'next_question': {
          setCurrentPhaseIdx(
            (data.current_phase as number) ?? currentPhaseIdx
          );
          setCurrentQuestionIdx(
            (data.current_question as number) ?? currentQuestionIdx + 1
          );
          setResponseCount(0);
          setResponseDistribution({});
          setDisplay('question');
          break;
        }

        case 'reveal_answer': {
          setDisplay('reveal');
          // Refetch to get response data
          fetchStatus();
          break;
        }

        case 'phase_review':
        case 'show_phase_review': {
          setDisplay('phase_review');
          fetchStatus();
          break;
        }

        case 'show_leaderboard': {
          if (data.leaderboard && Array.isArray(data.leaderboard)) {
            setLeaderboard(
              (data.leaderboard as LeaderboardEntry[]).map((entry, idx) => ({
                ...entry,
                name: entry.initials || `Student ${idx + 1}`,
                rank: idx + 1,
              }))
            );
          }
          setDisplay('leaderboard');
          break;
        }

        case 'next_phase': {
          setCurrentPhaseIdx((data.current_phase as number) ?? currentPhaseIdx + 1);
          setCurrentQuestionIdx((data.current_question as number) ?? 0);
          setResponseCount(0);
          setResponseDistribution({});
          setDisplay('question');
          break;
        }

        case 'session_paused':
        case 'pause_session': {
          setDisplay('paused');
          break;
        }

        case 'session_resumed':
        case 'resume_session': {
          setDisplay('question');
          break;
        }

        case 'session_end':
        case 'end_session': {
          setDisplay('session_end');
          fetchStatus();
          break;
        }

        case 'response_count':
        case 'response_submitted': {
          if (typeof data.count === 'number') {
            setResponseCount(data.count as number);
          } else {
            setResponseCount((prev) => prev + 1);
          }
          if (data.distribution) {
            setResponseDistribution(data.distribution as ResponseDistribution);
          }
          break;
        }
      }
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code, currentPhaseIdx, currentQuestionIdx, fetchStatus]);

  // =========================================================================
  // Derived state
  // =========================================================================

  const phases = (caseStudy?.phases || []) as CasePhase[];
  const currentPhase = phases[currentPhaseIdx] as CasePhase | undefined;
  const currentQuestions = currentPhase?.questions || [];
  const currentQuestion = currentQuestions[currentQuestionIdx] as CaseQuestion | undefined;

  const maxDistribution = Math.max(
    1,
    ...Object.values(responseDistribution)
  );

  // =========================================================================
  // Loading state
  // =========================================================================

  if (display === 'loading') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl text-red-400 mb-2">Unable to load session</p>
          <p className="text-lg text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Render — TV Display
  // =========================================================================

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-hidden">
      {/* ===== JOIN PHASE ===== */}
      {display === 'join' && (
        <div className="min-h-screen flex flex-col items-center justify-center p-8">
          {/* PMI Logo / Branding */}
          <div className="mb-8">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-blue-600 mb-4">
              <Stethoscope className="h-10 w-10 text-white" />
            </div>
          </div>

          {/* Session Code */}
          <div className="mb-6">
            <p className="text-xl text-gray-400 mb-4 text-center uppercase tracking-widest">
              Join Session
            </p>
            <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl px-12 py-8">
              <p className="text-7xl font-mono font-black tracking-[0.4em] text-white text-center">
                {sessionInfo?.session_code || code?.toUpperCase()}
              </p>
            </div>
          </div>

          {/* URL */}
          <p className="text-lg text-gray-500 mb-10 text-center">
            Go to{' '}
            <span className="text-blue-400 font-medium">
              pmiparamedic.tools/cases/session/
              {sessionInfo?.session_code || code?.toUpperCase()}/join
            </span>
          </p>

          {/* Student Count */}
          <div className="flex items-center gap-3 text-2xl text-gray-300">
            <Users className="h-7 w-7" />
            <span className="font-semibold">{studentCount}</span>
            <span className="text-gray-500">
              student{studentCount !== 1 ? 's' : ''} joined
            </span>
          </div>

          {/* Pulsing dots */}
          <div className="mt-8 flex gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-opacity duration-300 ${
                  dotPhase === i
                    ? 'bg-blue-500 opacity-100'
                    : 'bg-gray-700 opacity-50'
                }`}
              />
            ))}
          </div>

          {/* Case info at bottom */}
          {caseInfo && (
            <div className="absolute bottom-8 text-center">
              <p className="text-lg text-gray-600">{caseInfo.title}</p>
              {caseInfo.category && (
                <p className="text-sm text-gray-700 mt-1">{caseInfo.category}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== QUESTION DISPLAY ===== */}
      {display === 'question' && (
        <div className="min-h-screen flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between px-8 py-4 bg-gray-900/80 border-b border-gray-800">
            <div className="flex items-center gap-4">
              <span className="text-lg font-semibold text-blue-400">
                {caseInfo?.title || caseStudy?.title}
              </span>
              {currentPhase && (
                <span className="text-gray-500">|</span>
              )}
              {currentPhase && (
                <span className="text-lg text-gray-400">
                  {currentPhase.title}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-gray-400">
              <span className="text-lg">
                Q{currentQuestionIdx + 1}/{currentQuestions.length}
              </span>
              {sessionInfo?.started_at && (
                <span className="flex items-center gap-1 text-lg">
                  <Clock className="h-5 w-5" />
                  {elapsedTime}
                </span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col justify-center px-12 py-8">
            {/* Presentation text (first question of phase) */}
            {currentQuestionIdx === 0 && currentPhase?.presentation_text && (
              <div className="bg-blue-950/30 border border-blue-800/50 rounded-xl p-6 mb-6 max-w-4xl mx-auto w-full">
                <p className="text-xl text-blue-300 leading-relaxed">
                  {currentPhase.presentation_text}
                </p>
              </div>
            )}

            {/* Vitals */}
            {currentPhase?.vitals &&
              Object.keys(currentPhase.vitals).length > 0 &&
              currentQuestionIdx === 0 && (
                <TVVitalsGrid vitals={currentPhase.vitals} />
              )}

            {/* Question text */}
            {currentQuestion && (
              <div className="max-w-4xl mx-auto w-full">
                <h2 className="text-3xl font-bold text-white mb-8 leading-snug">
                  {currentQuestion.text}
                </h2>

                {/* Options */}
                {currentQuestion.options && (
                  <div className="space-y-3">
                    {currentQuestion.options.map((opt, idx) => (
                      <div
                        key={opt.id}
                        className="flex items-center gap-4 p-5 rounded-xl bg-gray-900/60 border border-gray-800"
                      >
                        <span className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-lg font-bold text-white">
                          {getOptionLabel(idx)}
                        </span>
                        <span className="text-xl text-gray-200">
                          {opt.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Response count bar */}
          <div className="px-8 py-4 bg-gray-900/80 border-t border-gray-800">
            <div className="flex items-center gap-4">
              <span className="text-lg text-gray-400">
                {responseCount}/{studentCount} answered
              </span>
              <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden">
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
          </div>
        </div>
      )}

      {/* ===== REVEAL ===== */}
      {display === 'reveal' && currentQuestion && (
        <div className="min-h-screen flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between px-8 py-4 bg-gray-900/80 border-b border-gray-800">
            <span className="text-lg font-semibold text-blue-400">
              {caseInfo?.title || caseStudy?.title}
            </span>
            <span className="text-lg text-gray-400">
              Q{currentQuestionIdx + 1}/{currentQuestions.length}
            </span>
          </div>

          <div className="flex-1 flex flex-col justify-center px-12 py-8">
            <div className="max-w-4xl mx-auto w-full">
              <h2 className="text-2xl font-bold text-white mb-6">
                {currentQuestion.text}
              </h2>

              {/* Options with correct/incorrect highlighting */}
              {currentQuestion.options && (
                <div className="space-y-3 mb-8">
                  {currentQuestion.options.map((opt, idx) => {
                    const isCorrect =
                      currentQuestion.correct_answer === opt.id;
                    const count = responseDistribution[opt.id] || 0;
                    const pct =
                      responseCount > 0
                        ? Math.round((count / responseCount) * 100)
                        : 0;

                    return (
                      <div
                        key={opt.id}
                        className={`flex items-center gap-4 p-5 rounded-xl border transition-all duration-500 ${
                          isCorrect
                            ? 'bg-green-900/30 border-green-600'
                            : 'opacity-40 bg-gray-900/60 border-gray-800'
                        }`}
                      >
                        <span
                          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                            isCorrect
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-700 text-gray-400'
                          }`}
                        >
                          {getOptionLabel(idx)}
                        </span>
                        <span
                          className={`text-xl flex-1 ${
                            isCorrect
                              ? 'text-green-300 font-semibold'
                              : 'text-gray-500'
                          }`}
                        >
                          {opt.text}
                        </span>
                        {isCorrect && (
                          <Check className="h-7 w-7 text-green-400 flex-shrink-0" />
                        )}
                        <span className="text-lg text-gray-500 font-mono w-20 text-right">
                          {count} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Distribution chart */}
              {currentQuestion.options && (
                <div className="space-y-2 mb-6">
                  <h3 className="text-sm uppercase tracking-wider text-gray-500 mb-3">
                    Response Distribution
                  </h3>
                  {currentQuestion.options.map((opt, idx) => {
                    const count = responseDistribution[opt.id] || 0;
                    const isCorrect =
                      currentQuestion.correct_answer === opt.id;

                    return (
                      <div
                        key={opt.id}
                        className="flex items-center gap-3"
                      >
                        <span className="w-8 text-lg font-bold text-gray-500 text-right">
                          {getOptionLabel(idx)}
                        </span>
                        <div className="flex-1 h-8 bg-gray-800 rounded overflow-hidden">
                          <div
                            className={`h-full rounded transition-all duration-1000 ease-out ${
                              isCorrect ? 'bg-green-600' : 'bg-red-700'
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
                        </div>
                        <span className="text-lg font-mono text-gray-400 w-12 text-right">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Explanation */}
              {currentQuestion.explanation && (
                <div className="bg-green-950/30 border border-green-800/50 rounded-xl p-6 mt-4">
                  <h3 className="text-lg font-semibold text-green-400 mb-2">
                    Explanation
                  </h3>
                  <p className="text-lg text-green-300 leading-relaxed">
                    {currentQuestion.explanation}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== PHASE REVIEW ===== */}
      {display === 'phase_review' && (
        <div className="min-h-screen flex flex-col items-center justify-center px-12 py-8">
          <h2 className="text-4xl font-bold text-white mb-2">
            Phase {currentPhaseIdx + 1} Review
          </h2>
          {currentPhase && (
            <p className="text-xl text-gray-400 mb-10">
              {currentPhase.title}
            </p>
          )}

          <div className="max-w-3xl w-full space-y-4">
            {currentQuestions.map((q, idx) => {
              // Approximate correct/incorrect from any available data
              return (
                <div
                  key={q.id}
                  className="flex items-center gap-4 p-5 rounded-xl bg-gray-900/60 border border-gray-800"
                >
                  <span className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center text-lg font-bold text-white">
                    {idx + 1}
                  </span>
                  <span className="text-lg text-gray-200 flex-1 truncate">
                    {q.text}
                  </span>
                  <span className="text-sm text-gray-500">
                    {q.points || 10} pts
                  </span>
                </div>
              );
            })}
          </div>

          {/* Top 5 leaderboard preview */}
          {sessionInfo?.settings?.show_leaderboard &&
            leaderboard.length > 0 && (
              <div className="mt-10 max-w-md w-full">
                <h3 className="text-lg text-gray-400 text-center mb-4 uppercase tracking-wider">
                  Top Performers
                </h3>
                {leaderboard.slice(0, 5).map((entry) => (
                  <div
                    key={entry.initials}
                    className="flex items-center gap-3 py-2"
                  >
                    <span className="w-8 text-lg font-bold text-gray-500 text-right">
                      #{entry.rank}
                    </span>
                    <span className="text-lg text-white flex-1">
                      {entry.name || entry.initials}
                    </span>
                    <span className="text-lg font-mono text-amber-400">
                      {entry.total_points} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {/* ===== LEADERBOARD ===== */}
      {display === 'leaderboard' && (
        <div className="min-h-screen flex flex-col items-center justify-center px-12 py-8">
          <div className="mb-8">
            <Trophy className="h-14 w-14 text-amber-500 mx-auto mb-4" />
            <h2 className="text-4xl font-bold text-white text-center">
              Leaderboard
            </h2>
          </div>

          <div className="max-w-xl w-full">
            {/* Top 3 with podium styling */}
            {leaderboard.slice(0, 3).map((entry, idx) => {
              const podiumColors = [
                'border-amber-500 bg-amber-900/20', // Gold
                'border-gray-400 bg-gray-800/50',   // Silver
                'border-amber-700 bg-amber-950/20', // Bronze
              ];
              const medalIcons = [
                <Trophy key="gold" className="h-8 w-8 text-amber-400" />,
                <Medal key="silver" className="h-8 w-8 text-gray-400" />,
                <Award key="bronze" className="h-8 w-8 text-amber-600" />,
              ];

              return (
                <div
                  key={entry.initials}
                  className={`flex items-center gap-5 p-5 rounded-xl border-2 mb-3 ${podiumColors[idx]}`}
                >
                  <div className="flex-shrink-0">
                    {medalIcons[idx]}
                  </div>
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-700 flex items-center justify-center text-xl font-bold text-white">
                    {entry.initials}
                  </div>
                  <span className="text-2xl font-semibold text-white flex-1">
                    {entry.name || entry.initials}
                  </span>
                  <span className="text-2xl font-mono font-bold text-amber-400">
                    {entry.total_points}
                  </span>
                </div>
              );
            })}

            {/* Remaining students */}
            {leaderboard.slice(3).map((entry) => (
              <div
                key={entry.initials}
                className="flex items-center gap-4 py-3 px-5 border-b border-gray-800"
              >
                <span className="w-8 text-lg font-bold text-gray-600 text-right">
                  #{entry.rank}
                </span>
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300">
                  {entry.initials}
                </div>
                <span className="text-lg text-gray-300 flex-1">
                  {entry.name || entry.initials}
                </span>
                <span className="text-lg font-mono text-gray-400">
                  {entry.total_points}
                </span>
              </div>
            ))}

            {leaderboard.length === 0 && (
              <div className="text-center py-12 text-gray-500 text-xl">
                No scores available yet
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== PAUSED ===== */}
      {display === 'paused' && (
        <div className="min-h-screen flex flex-col items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-6">
              <div className="flex gap-2">
                <div className="w-3 h-10 bg-gray-400 rounded" />
                <div className="w-3 h-10 bg-gray-400 rounded" />
              </div>
            </div>
            <h2 className="text-4xl font-bold text-gray-300 mb-2">
              Session Paused
            </h2>
            <p className="text-xl text-gray-600">
              Waiting for instructor to resume...
            </p>
          </div>
        </div>
      )}

      {/* ===== SESSION END ===== */}
      {display === 'session_end' && (
        <div className="min-h-screen flex flex-col items-center justify-center px-12 py-8">
          <Trophy className="h-16 w-16 text-amber-500 mb-6" />
          <h2 className="text-5xl font-bold text-white mb-4">
            Session Complete
          </h2>

          {/* Stats */}
          <div className="flex gap-8 mb-10 mt-4">
            <div className="text-center">
              <p className="text-4xl font-bold text-blue-400">
                {studentCount}
              </p>
              <p className="text-lg text-gray-500">Students</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-green-400">
                {phases.reduce((sum, p) => sum + (p.questions?.length || 0), 0)}
              </p>
              <p className="text-lg text-gray-500">Questions</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-purple-400">
                {phases.length}
              </p>
              <p className="text-lg text-gray-500">Phases</p>
            </div>
          </div>

          {/* Final leaderboard */}
          {leaderboard.length > 0 && (
            <div className="max-w-xl w-full">
              <h3 className="text-xl text-gray-400 text-center mb-4 uppercase tracking-wider">
                Final Rankings
              </h3>
              {leaderboard.slice(0, 10).map((entry, idx) => {
                const podiumColors = [
                  'text-amber-400',
                  'text-gray-400',
                  'text-amber-600',
                ];

                return (
                  <div
                    key={entry.initials}
                    className="flex items-center gap-4 py-3 px-4"
                  >
                    <span
                      className={`w-8 text-xl font-bold text-right ${
                        idx < 3 ? podiumColors[idx] : 'text-gray-600'
                      }`}
                    >
                      #{entry.rank}
                    </span>
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300">
                      {entry.initials}
                    </div>
                    <span className="text-xl text-white flex-1">
                      {entry.name || entry.initials}
                    </span>
                    <span className="text-xl font-mono font-bold text-amber-400">
                      {entry.total_points}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <p className="text-gray-700 text-lg mt-12">
            Pima Medical Institute - Paramedic Program
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TV Vitals Grid — Large, readable vitals display for projector
// ---------------------------------------------------------------------------

function TVVitalsGrid({ vitals }: { vitals: PhaseVitals }) {
  const vitalEntries = [
    { key: 'bp', label: 'BP', unit: 'mmHg', color: 'text-red-400' },
    { key: 'hr', label: 'HR', unit: 'bpm', color: 'text-green-400' },
    { key: 'rr', label: 'RR', unit: '/min', color: 'text-cyan-400' },
    { key: 'spo2', label: 'SpO2', unit: '%', color: 'text-blue-400' },
    { key: 'etco2', label: 'EtCO2', unit: 'mmHg', color: 'text-yellow-400' },
    { key: 'temp', label: 'Temp', unit: '', color: 'text-orange-400' },
    { key: 'glucose', label: 'BGL', unit: 'mg/dL', color: 'text-purple-400' },
    { key: 'gcs', label: 'GCS', unit: '', color: 'text-pink-400' },
  ].filter((v) => vitals[v.key as keyof PhaseVitals]);

  if (vitalEntries.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 max-w-4xl mx-auto w-full">
      {vitalEntries.map((v) => (
        <div
          key={v.key}
          className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 text-center"
        >
          <p className="text-sm uppercase tracking-wider text-gray-500 mb-1">
            {v.label}
          </p>
          <p className={`text-3xl font-bold ${v.color}`}>
            {vitals[v.key as keyof PhaseVitals]}
          </p>
          {v.unit && (
            <p className="text-xs text-gray-600 mt-0.5">{v.unit}</p>
          )}
        </div>
      ))}
    </div>
  );
}
