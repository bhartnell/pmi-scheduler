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
  Briefcase,
  Plus,
  X,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  Loader2
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

interface Template {
  id: string;
  name: string;
  description: string | null;
  instructor_type: string;
}

interface Instructor {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface AdminAssignment {
  id: string;
  instructor_email: string;
  instructorName: string | null;
  mentor_email: string | null;
  mentorName: string | null;
  instructor_type: string;
  status: string;
  start_date: string;
  target_completion_date: string | null;
  summary: {
    total_tasks: number;
    completed_tasks: number;
    progress_pct: number;
  };
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

  // Admin state
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [adminAssignments, setAdminAssignments] = useState<AdminAssignment[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);

  // Assignment form state
  const [formInstructorEmail, setFormInstructorEmail] = useState('');
  const [formTemplateId, setFormTemplateId] = useState('');
  const [formMentorEmail, setFormMentorEmail] = useState('');
  const [formInstructorType, setFormInstructorType] = useState('new_hire');
  const [formTargetDate, setFormTargetDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      loadUserRole();
      loadDashboardData();
    }
  }, [session]);

  const loadUserRole = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const result = await res.json();
      if (result.success && result.user) {
        setUserRole(result.user.role);
        const adminRole = result.user.role === 'admin' || result.user.role === 'superadmin';
        setIsAdmin(adminRole);
        if (adminRole) {
          loadAdminData();
        }
      }
    } catch (error) {
      console.error('Error loading user role:', error);
    }
  };

  const loadAdminData = async () => {
    setLoadingAdmin(true);
    try {
      const [assignmentsRes, templatesRes, instructorsRes] = await Promise.all([
        fetch('/api/onboarding/assignments'),
        fetch('/api/onboarding/templates'),
        fetch('/api/lab-management/instructors'),
      ]);

      const assignmentsData = await assignmentsRes.json();
      const templatesData = await templatesRes.json();
      const instructorsData = await instructorsRes.json();

      if (assignmentsData.success) {
        setAdminAssignments(assignmentsData.assignments || []);
      }
      if (templatesData.success) {
        setTemplates(templatesData.templates || []);
      }
      if (instructorsData.success) {
        setInstructors(instructorsData.instructors || []);
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
    setLoadingAdmin(false);
  };

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

  const openAssignModal = () => {
    setFormInstructorEmail('');
    setFormTemplateId(templates[0]?.id || '');
    setFormMentorEmail('');
    setFormInstructorType('new_hire');
    setFormTargetDate('');
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowAssignModal(true);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        instructor_email: formInstructorEmail,
        template_id: formTemplateId,
        mentor_email: formMentorEmail || null,
        instructor_type: formInstructorType,
        target_completion_date: formTargetDate || null,
      };

      const res = await fetch('/api/onboarding/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (result.success) {
        setSuccessMessage('Instructor assigned successfully!');
        setShowAssignModal(false);
        loadAdminData(); // Refresh assignments list
      } else {
        setErrorMessage(result.error || 'Failed to assign instructor');
      }
    } catch (error) {
      console.error('Error assigning instructor:', error);
      setErrorMessage('An error occurred while assigning the instructor');
    }

    setSubmitting(false);
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
          {isAdmin && (
            <div className="mb-6">
              <button
                onClick={() => setShowAdminPanel(!showAdminPanel)}
                className="w-full flex items-center justify-between bg-blue-600 dark:bg-blue-700 text-white px-4 py-3 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition"
              >
                <span className="font-semibold">Admin: Manage Assignments</span>
                <ChevronDown className={`w-5 h-5 transition-transform ${showAdminPanel ? 'rotate-180' : ''}`} />
              </button>
              {showAdminPanel && (
                <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Onboarding Assignments</h3>
                    <button
                      onClick={openAssignModal}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <UserPlus className="w-4 h-4" />
                      Assign New Instructor
                    </button>
                  </div>
                  {loadingAdmin ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {adminAssignments.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-4">No assignments found</p>
                      ) : (
                        adminAssignments.map((assignment) => (
                          <div key={assignment.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-gray-900 dark:text-white">
                                    {assignment.instructorName || assignment.instructor_email}
                                  </h4>
                                  <span className={`px-2 py-1 text-xs rounded-full ${
                                    assignment.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                    assignment.status === 'completed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                    'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'
                                  }`}>
                                    {assignment.status}
                                  </span>
                                  <span className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300">
                                    {assignment.instructor_type}
                                  </span>
                                </div>
                                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                  {assignment.mentorName && (
                                    <p className="flex items-center gap-1">
                                      <User className="w-3 h-3" />
                                      Mentor: {assignment.mentorName}
                                    </p>
                                  )}
                                  <p className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Started: {new Date(assignment.start_date).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                  {assignment.summary.progress_pct}%
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {assignment.summary.completed_tasks}/{assignment.summary.total_tasks} tasks
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
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
        {/* Admin Panel */}
        {isAdmin && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
            <button
              onClick={() => setShowAdminPanel(!showAdminPanel)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition"
            >
              <span className="font-semibold text-blue-900 dark:text-blue-100">Admin: Manage Assignments</span>
              <ChevronDown className={`w-5 h-5 text-blue-700 dark:text-blue-300 transition-transform ${showAdminPanel ? 'rotate-180' : ''}`} />
            </button>
            {showAdminPanel && (
              <div className="px-4 pb-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Onboarding Assignments</h3>
                    <button
                      onClick={openAssignModal}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <UserPlus className="w-4 h-4" />
                      Assign New Instructor
                    </button>
                  </div>
                  {loadingAdmin ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {adminAssignments.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-4">No assignments found</p>
                      ) : (
                        adminAssignments.map((assignment) => (
                          <div key={assignment.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-medium text-gray-900 dark:text-white">
                                    {assignment.instructorName || assignment.instructor_email}
                                  </h4>
                                  <span className={`px-2 py-1 text-xs rounded-full ${
                                    assignment.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                    assignment.status === 'completed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                    'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'
                                  }`}>
                                    {assignment.status}
                                  </span>
                                  <span className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300">
                                    {assignment.instructor_type}
                                  </span>
                                </div>
                                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                  {assignment.mentorName && (
                                    <p className="flex items-center gap-1">
                                      <User className="w-3 h-3" />
                                      Mentor: {assignment.mentorName}
                                    </p>
                                  )}
                                  <p className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Started: {new Date(assignment.start_date).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                  {assignment.summary.progress_pct}%
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {assignment.summary.completed_tasks}/{assignment.summary.total_tasks} tasks
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

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

      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Assign New Instructor</h2>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="p-6 space-y-4">
              {errorMessage && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
                </div>
              )}

              {successMessage && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-700 dark:text-green-300">{successMessage}</p>
                </div>
              )}

              {/* Instructor Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Instructor Email <span className="text-red-500">*</span>
                </label>
                <select
                  value={formInstructorEmail}
                  onChange={(e) => setFormInstructorEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select instructor...</option>
                  {instructors
                    .filter((i) => i.is_active)
                    .map((instructor) => (
                      <option key={instructor.id} value={instructor.email}>
                        {instructor.name} ({instructor.email})
                      </option>
                    ))}
                </select>
              </div>

              {/* Template */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Onboarding Template <span className="text-red-500">*</span>
                </label>
                <select
                  value={formTemplateId}
                  onChange={(e) => setFormTemplateId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  {templates.length === 0 ? (
                    <option value="">No templates available</option>
                  ) : (
                    templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                        {template.instructor_type !== 'all' && ` (${template.instructor_type})`}
                      </option>
                    ))
                  )}
                </select>
                {templates.length === 0 && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    No active templates found. Please create a template first.
                  </p>
                )}
              </div>

              {/* Mentor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mentor (Optional)
                </label>
                <select
                  value={formMentorEmail}
                  onChange={(e) => setFormMentorEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">No mentor</option>
                  {instructors
                    .filter((i) => i.is_active && i.email !== formInstructorEmail)
                    .map((instructor) => (
                      <option key={instructor.id} value={instructor.email}>
                        {instructor.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Instructor Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Instructor Type <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="new_hire"
                      checked={formInstructorType === 'new_hire'}
                      onChange={(e) => setFormInstructorType(e.target.value)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">New Hire (Full onboarding)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="adjunct"
                      checked={formInstructorType === 'adjunct'}
                      onChange={(e) => setFormInstructorType(e.target.value)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Adjunct (Abbreviated)</span>
                  </label>
                </div>
              </div>

              {/* Target Completion Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Target Completion Date (Optional)
                </label>
                <input
                  type="date"
                  value={formTargetDate}
                  onChange={(e) => setFormTargetDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || templates.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    'Assign Instructor'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
