'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle,
  Circle,
  Lock,
  ChevronDown,
  ChevronRight,
  Clock,
  Calendar,
  User,
  BookOpen,
  Home,
  ExternalLink,
  AlertCircle,
  FileText,
  Users,
  Briefcase
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

interface Task {
  progressId: string;
  taskId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'waived' | 'blocked';
  startedAt: string | null;
  completedAt: string | null;
  timeSpentMinutes: number | null;
  notes: string | null;
  isBlocked: boolean;
  blockedBy: string | null;
  gateType: string | null;
  title: string;
  description: string;
  task_type: string;
  resource_url: string | null;
  sort_order: number;
  is_required: boolean;
  estimated_minutes: number | null;
  requires_sign_off: boolean;
  sign_off_role: string | null;
  lane: 'institutional' | 'operational' | 'mentorship';
  requires_evidence: boolean;
}

interface Phase {
  id: string;
  name: string;
  description: string;
  sort_order: number;
  target_days_start: number;
  target_days_end: number;
  tasks: Task[];
  completedCount: number;
  totalCount: number;
  progressPercent: number;
}

interface LaneProgress {
  lane: string;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  progress_pct: number;
}

interface Assignment {
  id: string;
  template_id: string;
  instructor_email: string;
  instructor_type: string;
  mentor_email: string | null;
  mentorName: string | null;
  assigned_by: string | null;
  assignedByName: string | null;
  start_date: string;
  target_completion_date: string | null;
  status: string;
}

interface NextTask extends Task {
  phaseName: string;
}

interface DashboardData {
  hasActiveAssignment: boolean;
  assignment: Assignment | null;
  summary: {
    totalTasks: number;
    completedTasks: number;
    progressPercent: number;
  } | null;
  phases: Phase[];
  nextTask: NextTask | null;
  laneProgress: LaneProgress[];
}

const LANE_COLORS = {
  institutional: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', bar: 'bg-blue-500' },
  operational: { bg: 'bg-slate-100 dark:bg-slate-900/30', text: 'text-slate-700 dark:text-slate-300', bar: 'bg-slate-500' },
  mentorship: { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300', bar: 'bg-violet-500' }
};

const LANE_LABELS = {
  institutional: 'Faculty Fundamentals',
  operational: 'Program Readiness',
  mentorship: 'Mentorship & Observation'
};

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      loadDashboardData();
    }
  }, [session]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/dashboard');
      const result = await res.json();
      if (result.success) {
        setData(result);

        // Auto-expand the current phase (first incomplete phase)
        if (result.phases) {
          const currentPhase = result.phases.find((p: Phase) => p.progressPercent < 100);
          if (currentPhase) {
            setExpandedPhases(new Set([currentPhase.id]));
          }
        }
      }
    } catch (error) {
      console.error('Error loading onboarding data:', error);
    }
    setLoading(false);
  };

  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  };

  const toggleTaskStatus = async (task: Task) => {
    if (task.isBlocked || task.requires_sign_off) return;

    setUpdatingTask(task.progressId);

    // Cycle through statuses: pending -> in_progress -> completed -> pending
    let newStatus: string;
    if (task.status === 'pending') {
      newStatus = 'in_progress';
    } else if (task.status === 'in_progress') {
      newStatus = 'completed';
    } else {
      newStatus = 'pending';
    }

    try {
      const res = await fetch(`/api/onboarding/tasks/${task.progressId}/progress`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      const result = await res.json();

      if (!result.success) {
        // Show error to user
        alert(result.error || 'Failed to update task');
      } else {
        // Reload data
        await loadDashboardData();
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }

    setUpdatingTask(null);
  };

  const getTaskIcon = (task: Task) => {
    if (task.isBlocked) {
      return <Lock className="w-5 h-5 text-gray-400" />;
    }
    if (task.status === 'completed' || task.status === 'waived') {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    if (task.status === 'in_progress') {
      return <Circle className="w-5 h-5 text-blue-500 fill-blue-200" />;
    }
    return <Circle className="w-5 h-5 text-gray-300" />;
  };

  const getPhaseStatus = (phase: Phase) => {
    if (phase.progressPercent === 100) {
      return { icon: <CheckCircle className="w-5 h-5 text-green-500" />, label: 'Complete' };
    }
    if (phase.completedCount > 0) {
      return { icon: <Circle className="w-5 h-5 text-blue-500 fill-blue-200" />, label: 'In Progress' };
    }
    return { icon: <Circle className="w-5 h-5 text-gray-300" />, label: 'Not Started' };
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  // No active assignment
  if (!data?.hasActiveAssignment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                  <Home className="w-5 h-5" />
                </Link>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Onboarding</h1>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
        <main className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <BookOpen className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Active Onboarding Assignment
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You don&apos;t have an active onboarding program assigned. If you&apos;re a new instructor,
              please contact your program director or mentor to get started.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Home className="w-4 h-4" /> Return Home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const { assignment, summary, phases, nextTask, laneProgress } = data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                <Home className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">My Onboarding</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {summary?.completedTasks || 0} of {summary?.totalTasks || 0} tasks complete
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Progress Overview */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Overall Progress</h2>
              {assignment?.start_date && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Started {new Date(assignment.start_date).toLocaleDateString()}
                  {assignment.target_completion_date && (
                    <> &bull; Target: {new Date(assignment.target_completion_date).toLocaleDateString()}</>
                  )}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {summary?.progressPercent || 0}%
              </p>
            </div>
          </div>

          {/* Main progress bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mb-6">
            <div
              className="bg-blue-600 h-4 rounded-full transition-all duration-500"
              style={{ width: `${summary?.progressPercent || 0}%` }}
            />
          </div>

          {/* Lane Progress Bars */}
          {laneProgress && laneProgress.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Progress by Track</h3>
              {laneProgress.map(lane => (
                <div key={lane.lane} className="flex items-center gap-3">
                  <span className={`text-xs font-medium w-28 ${LANE_COLORS[lane.lane as keyof typeof LANE_COLORS]?.text || 'text-gray-600'}`}>
                    {LANE_LABELS[lane.lane as keyof typeof LANE_LABELS] || lane.lane}
                  </span>
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${LANE_COLORS[lane.lane as keyof typeof LANE_COLORS]?.bar || 'bg-gray-500'}`}
                      style={{ width: `${lane.progress_pct || 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right">
                    {lane.completed_tasks}/{lane.total_tasks}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Mentor Info */}
          {assignment?.mentorName && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <User className="w-4 h-4" />
              <span>Mentor: <strong className="text-gray-900 dark:text-white">{assignment.mentorName}</strong></span>
            </div>
          )}
        </div>

        {/* Next Task Card */}
        {nextTask && (
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-lg shadow p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-blue-100 text-sm mb-1">Next Up • {nextTask.phaseName}</p>
                <h3 className="text-lg font-semibold mb-2">{nextTask.title}</h3>
                <p className="text-blue-100 text-sm line-clamp-2">{nextTask.description}</p>
                <div className="flex items-center gap-4 mt-3 text-sm">
                  {nextTask.estimated_minutes && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" /> ~{nextTask.estimated_minutes} min
                    </span>
                  )}
                  {nextTask.requires_sign_off && (
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" /> Requires sign-off
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => toggleTaskStatus(nextTask)}
                disabled={nextTask.requires_sign_off || updatingTask === nextTask.progressId}
                className="px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {nextTask.status === 'pending' ? 'Start' : 'Complete'}
              </button>
            </div>
          </div>
        )}

        {/* Phases */}
        <div className="space-y-4">
          {phases.map((phase, index) => {
            const isExpanded = expandedPhases.has(phase.id);
            const phaseStatus = getPhaseStatus(phase);
            const isCurrentPhase = index === phases.findIndex(p => p.progressPercent < 100);

            return (
              <div
                key={phase.id}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden ${
                  isCurrentPhase ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                {/* Phase Header */}
                <button
                  onClick={() => togglePhase(phase.id)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                >
                  <div className="flex items-center gap-4">
                    {phaseStatus.icon}
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{phase.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {phase.completedCount} of {phase.totalCount} tasks complete
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:block w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${phase.progressPercent}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {phase.progressPercent}%
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Phase Tasks */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700">
                    {phase.description && (
                      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 text-sm text-gray-600 dark:text-gray-400">
                        {phase.description}
                      </div>
                    )}
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {phase.tasks.map(task => (
                        <div
                          key={task.progressId}
                          className={`px-6 py-4 flex items-start gap-4 ${
                            task.isBlocked ? 'opacity-50' : ''
                          } ${task.status === 'completed' || task.status === 'waived' ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}
                        >
                          {/* Status Toggle */}
                          <button
                            onClick={() => toggleTaskStatus(task)}
                            disabled={task.isBlocked || task.requires_sign_off || updatingTask === task.progressId}
                            className="mt-1 flex-shrink-0 disabled:cursor-not-allowed"
                          >
                            {updatingTask === task.progressId ? (
                              <div className="w-5 h-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                            ) : (
                              getTaskIcon(task)
                            )}
                          </button>

                          {/* Task Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className={`font-medium ${
                                  task.status === 'completed' || task.status === 'waived'
                                    ? 'text-gray-500 dark:text-gray-400 line-through'
                                    : 'text-gray-900 dark:text-white'
                                }`}>
                                  {task.title}
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                                  {task.description}
                                </p>
                              </div>

                              {/* Lane Badge */}
                              <span className={`flex-shrink-0 px-2 py-1 text-xs rounded-full ${LANE_COLORS[task.lane]?.bg} ${LANE_COLORS[task.lane]?.text}`}>
                                {task.lane === 'institutional' ? 'FF' : task.lane === 'operational' ? 'Ops' : 'Mentor'}
                              </span>
                            </div>

                            {/* Task Meta */}
                            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                              {task.estimated_minutes && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> {task.estimated_minutes} min
                                </span>
                              )}
                              {task.requires_sign_off && (
                                <span className="flex items-center gap-1 text-violet-600 dark:text-violet-400">
                                  <Users className="w-3 h-3" />
                                  {task.sign_off_role === 'mentor' ? 'Mentor sign-off' : 'PD sign-off'}
                                </span>
                              )}
                              {task.requires_evidence && (
                                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                  <FileText className="w-3 h-3" /> Evidence required
                                </span>
                              )}
                              {!task.is_required && (
                                <span className="text-gray-400">(Optional)</span>
                              )}
                              {task.resource_url && (
                                <a
                                  href={task.resource_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  <ExternalLink className="w-3 h-3" /> Resource
                                </a>
                              )}
                            </div>

                            {/* Blocked Warning */}
                            {task.isBlocked && (
                              <div className="mt-2 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                                <AlertCircle className="w-3 h-3" />
                                <span>Complete prerequisite tasks first</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
