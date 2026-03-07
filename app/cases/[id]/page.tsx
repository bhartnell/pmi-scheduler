'use client';

import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock,
  Users,
  Star,
  Play,
  Edit,
  Copy,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Target,
  Loader2,
  ShieldAlert,
  BarChart3,
  Trophy,
  RefreshCw,
} from 'lucide-react';
import {
  CaseStudy,
  CasePhase,
  CATEGORY_COLORS,
  DIFFICULTY_COLORS,
} from '@/types/case-studies';
import { hasMinRole } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PracticeHistory {
  attempts: number;
  bestScore: number;
  maxPoints: number;
  latestStatus: 'in_progress' | 'completed' | 'abandoned' | null;
  latestAttempt: number;
}

// ---------------------------------------------------------------------------
// Case Detail Page
// ---------------------------------------------------------------------------

export default function CaseDetailPage() {
  const { data: session, status: authStatus } = useSession();
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const [caseData, setCaseData] = useState<CaseStudy | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [practiceHistory, setPracticeHistory] = useState<PracticeHistory | null>(null);
  const [duplicating, setDuplicating] = useState(false);

  // Redirect to login
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [authStatus, router]);

  // Fetch case data
  useEffect(() => {
    if (!caseId || authStatus !== 'authenticated') return;

    async function fetchCase() {
      try {
        const res = await fetch(`/api/cases/${caseId}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Failed to load case');
          setLoading(false);
          return;
        }
        const data = await res.json();
        setCaseData(data.case);
        setUserRole(data.userRole || '');
        setIsOwner(data.isOwner || false);
      } catch {
        setError('Failed to load case study');
      } finally {
        setLoading(false);
      }
    }

    fetchCase();
  }, [caseId, authStatus]);

  // Fetch practice history (for students)
  useEffect(() => {
    if (!caseId || authStatus !== 'authenticated') return;

    async function fetchHistory() {
      try {
        const res = await fetch(`/api/cases/${caseId}/practice/history`);
        if (res.ok) {
          const data = await res.json();
          setPracticeHistory(data);
        }
        // 404 is expected if student has never practiced
      } catch {
        // Ignore — history endpoint may not exist yet
      }
    }

    fetchHistory();
  }, [caseId, authStatus]);

  // Duplicate handler
  async function handleDuplicate() {
    if (!caseData || duplicating) return;
    setDuplicating(true);
    try {
      const { id, created_at, updated_at, created_by, author, usage_count, community_rating, flag_count, is_verified, ...rest } = caseData;
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rest,
          title: `${rest.title} (Copy)`,
          is_published: false,
          visibility: 'private',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/cases/${data.case.id}/edit`);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to duplicate');
      }
    } catch {
      alert('Failed to duplicate case');
    } finally {
      setDuplicating(false);
    }
  }

  // -----------------------------------------------------------------------
  // Rendering helpers
  // -----------------------------------------------------------------------

  const isStudent = userRole === 'student';
  const isInstructor = hasMinRole(userRole, 'instructor');

  function getPracticeButtonProps() {
    if (!practiceHistory) {
      return { label: 'Start Practice', icon: Play, href: `/cases/${caseId}/practice` };
    }
    if (practiceHistory.latestStatus === 'in_progress') {
      return { label: 'Continue', icon: Play, href: `/cases/${caseId}/practice` };
    }
    return { label: 'Try Again', icon: RefreshCw, href: `/cases/${caseId}/practice` };
  }

  const practiceBtn = getPracticeButtonProps();
  const PracticeBtnIcon = practiceBtn.icon;

  // -----------------------------------------------------------------------
  // Loading / Error states
  // -----------------------------------------------------------------------

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {error || 'Case not found'}
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              The case study you are looking for may have been removed or you do not have access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const phases: CasePhase[] = Array.isArray(caseData.phases) ? caseData.phases : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Back link */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-6 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Cases
        </button>

        {/* Header card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                {caseData.title}
              </h1>
              <div className="flex flex-wrap gap-2 mb-3">
                {/* Category badge */}
                {caseData.category && (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[caseData.category] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                    {caseData.category}
                  </span>
                )}
                {/* Difficulty badge */}
                {caseData.difficulty && (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${DIFFICULTY_COLORS[caseData.difficulty] || 'bg-gray-100 text-gray-800'}`}>
                    {caseData.difficulty.charAt(0).toUpperCase() + caseData.difficulty.slice(1)}
                  </span>
                )}
                {/* Programs */}
                {caseData.applicable_programs?.map((prog) => (
                  <span
                    key={prog}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                  >
                    {prog}
                  </span>
                ))}
                {/* Published status */}
                {!caseData.is_published && isInstructor && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                    Draft
                  </span>
                )}
              </div>
              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                {caseData.estimated_duration_minutes && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {caseData.estimated_duration_minutes} min
                  </span>
                )}
                {caseData.author && (
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {caseData.author}
                  </span>
                )}
                {phases.length > 0 && (
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    {phases.length} phase{phases.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 sm:items-end">
              <Link
                href={practiceBtn.href}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
              >
                <PracticeBtnIcon className="h-4 w-4" />
                {practiceBtn.label}
              </Link>
              {isInstructor && (
                <div className="flex gap-2">
                  {(isOwner || hasMinRole(userRole, 'admin')) && (
                    <Link
                      href={`/cases/${caseId}/edit`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Edit
                    </Link>
                  )}
                  <button
                    onClick={handleDuplicate}
                    disabled={duplicating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    {duplicating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                    Duplicate
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats cards (student: score + attempts; all: usage + rating) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={BarChart3}
            label="Times Used"
            value={caseData.usage_count?.toString() || '0'}
          />
          <StatCard
            icon={Star}
            label="Rating"
            value={
              caseData.community_rating
                ? Number(caseData.community_rating).toFixed(1)
                : '--'
            }
          />
          {isStudent && practiceHistory && (
            <>
              <StatCard
                icon={Trophy}
                label="Best Score"
                value={
                  practiceHistory.maxPoints > 0
                    ? `${Math.round((practiceHistory.bestScore / practiceHistory.maxPoints) * 100)}%`
                    : '--'
                }
              />
              <StatCard
                icon={RefreshCw}
                label="Attempts"
                value={practiceHistory.attempts.toString()}
              />
            </>
          )}
          {!isStudent && (
            <>
              <StatCard icon={Target} label="Phases" value={phases.length.toString()} />
              <StatCard
                icon={BookOpen}
                label="Questions"
                value={phases
                  .reduce((sum, p) => sum + (p.questions?.length || 0), 0)
                  .toString()}
              />
            </>
          )}
        </div>

        {/* Description / Chief Complaint */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          {caseData.chief_complaint && (
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Chief Complaint
              </h2>
              <p className="text-gray-900 dark:text-white text-lg font-medium">
                {caseData.chief_complaint}
              </p>
            </div>
          )}
          {caseData.description && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Scenario Description
              </h2>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {caseData.description}
              </p>
            </div>
          )}
        </div>

        {/* Learning Objectives */}
        {caseData.learning_objectives && caseData.learning_objectives.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-3">
              <Target className="h-5 w-5 text-blue-600" />
              Learning Objectives
            </h2>
            <ul className="space-y-2">
              {caseData.learning_objectives.map((obj, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{obj}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Critical Actions — hidden from students */}
        {!isStudent &&
          caseData.critical_actions &&
          caseData.critical_actions.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-3">
                <ShieldAlert className="h-5 w-5 text-red-500" />
                Critical Actions
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                  Instructor Only
                </span>
              </h2>
              <ul className="space-y-2">
                {caseData.critical_actions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        {/* Equipment Needed */}
        {caseData.equipment_needed && caseData.equipment_needed.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Equipment Needed
            </h2>
            <div className="flex flex-wrap gap-2">
              {caseData.equipment_needed.map((item, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Phase overview */}
        {phases.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-4">
              <BookOpen className="h-5 w-5 text-indigo-500" />
              Phase Overview
            </h2>
            <div className="space-y-2">
              {phases.map((phase, i) => (
                <div
                  key={phase.id || i}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-750 rounded-lg border border-gray-100 dark:border-gray-700"
                >
                  <span className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-sm font-semibold">
                    {i + 1}
                  </span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {phase.title || `Phase ${i + 1}`}
                  </span>
                  {phase.questions && phase.questions.length > 0 && (
                    <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                      {phase.questions.length} question{phase.questions.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Card component
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
