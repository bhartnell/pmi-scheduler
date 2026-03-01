'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  BookOpen,
  Plus,
  Trash2,
  Save,
  Calendar,
  CheckSquare,
  Square,
  MessageSquare,
  Lock,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Archive,
} from 'lucide-react';
import { hasMinRole, type Role } from '@/lib/permissions';

// ============================================================
// Types
// ============================================================

interface Goal {
  id: string;
  text: string;
  target_date: string;
}

interface LearningPlan {
  id: string;
  student_id: string;
  goals: Goal[];
  accommodations: string[];
  custom_accommodations: string | null;
  status: 'active' | 'on_hold' | 'completed' | 'archived';
  review_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface PlanNote {
  id: string;
  plan_id: string;
  note: string;
  created_by: string;
  created_at: string;
}

interface StudentInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  cohort?: {
    id: string;
    cohort_number: number;
    program: { name: string; abbreviation: string };
  };
}

// ============================================================
// Constants
// ============================================================

const ACCOMMODATION_OPTIONS = [
  { id: 'extra_time', label: 'Extended time on assessments' },
  { id: 'preferential_seating', label: 'Preferential seating' },
  { id: 'modified_assignments', label: 'Modified assignments' },
  { id: 'assistive_technology', label: 'Assistive technology' },
  { id: 'breaks', label: 'Scheduled breaks' },
  { id: 'reduced_workload', label: 'Reduced workload' },
  { id: 'other', label: 'Other (see notes)' },
];

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; classes: string }> = {
  active: {
    label: 'Active',
    icon: <CheckCircle className="w-4 h-4" />,
    classes: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  on_hold: {
    label: 'On Hold',
    icon: <Clock className="w-4 h-4" />,
    classes: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  completed: {
    label: 'Completed',
    icon: <CheckCircle className="w-4 h-4" />,
    classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
  archived: {
    label: 'Archived',
    icon: <Archive className="w-4 h-4" />,
    classes: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  },
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Not set';
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ============================================================
// Page Component
// ============================================================

export default function LearningPlanPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;

  const [userRole, setUserRole] = useState<Role | null>(null);
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [notes, setNotes] = useState<PlanNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Edit form state
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accommodations, setAccommodations] = useState<string[]>([]);
  const [customAccommodations, setCustomAccommodations] = useState('');
  const [planStatus, setPlanStatus] = useState<'active' | 'on_hold' | 'completed' | 'archived'>('active');
  const [reviewDate, setReviewDate] = useState('');

  // Progress note form
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // Redirect if unauthenticated
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [authStatus, router]);

  // Fetch user role + student + plan on mount
  useEffect(() => {
    if (session && studentId) {
      fetchUserRole();
      fetchStudent();
      fetchPlan();
    }
  }, [session, studentId]);

  const fetchUserRole = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        setUserRole(data.user.role);
      }
    } catch (err) {
      console.error('Error fetching user role:', err);
    }
  };

  const fetchStudent = async () => {
    try {
      const res = await fetch(`/api/lab-management/students/${studentId}`);
      const data = await res.json();
      if (data.success && data.student) {
        setStudent(data.student);
      }
    } catch (err) {
      console.error('Error fetching student:', err);
    }
  };

  const fetchPlan = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lab-management/students/${studentId}/learning-plan`);
      const data = await res.json();
      if (data.success) {
        if (data.plan) {
          setPlan(data.plan);
          setGoals(Array.isArray(data.plan.goals) ? data.plan.goals : []);
          setAccommodations(Array.isArray(data.plan.accommodations) ? data.plan.accommodations : []);
          setCustomAccommodations(data.plan.custom_accommodations || '');
          setPlanStatus(data.plan.status);
          setReviewDate(data.plan.review_date || '');
        }
        setNotes(data.notes || []);
      }
    } catch (err) {
      console.error('Error fetching learning plan:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlan = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/lab-management/students/${studentId}/learning-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goals,
          accommodations,
          custom_accommodations: customAccommodations,
          status: planStatus,
          review_date: reviewDate || null,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setSaveError(data.error || 'Failed to save learning plan');
      } else {
        setPlan(data.plan);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      setSaveError('Network error - please try again');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    setNoteError(null);

    try {
      const res = await fetch(`/api/lab-management/students/${studentId}/learning-plan/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newNote }),
      });
      const data = await res.json();
      if (!data.success) {
        setNoteError(data.error || 'Failed to add note');
      } else {
        setNotes((prev) => [...prev, data.note]);
        setNewNote('');
      }
    } catch (err) {
      setNoteError('Network error - please try again');
    } finally {
      setAddingNote(false);
    }
  };

  const addGoal = () => {
    setGoals((prev) => [...prev, { id: generateId(), text: '', target_date: '' }]);
  };

  const updateGoal = (id: string, field: keyof Goal, value: string) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, [field]: value } : g))
    );
  };

  const removeGoal = (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  const toggleAccommodation = (id: string) => {
    setAccommodations((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  // ============================================================
  // Access control
  // ============================================================

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (userRole && !hasMinRole(userRole, 'lead_instructor')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 max-w-md text-center">
          <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Confidential</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Learning plans are restricted to lead instructors and above.
          </p>
          <Link
            href={`/lab-management/students/${studentId}`}
            className="mt-4 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Back to student profile
          </Link>
        </div>
      </div>
    );
  }

  const studentName = student
    ? `${student.first_name} ${student.last_name}`
    : 'Student';

  const statusConfig = STATUS_CONFIG[planStatus];

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">
              Lab Management
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/students" className="hover:text-blue-600 dark:hover:text-blue-400">
              Students
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link
              href={`/lab-management/students/${studentId}`}
              className="hover:text-blue-600 dark:hover:text-blue-400"
            >
              {studentName}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="dark:text-gray-300">Learning Plan</span>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Learning Plan
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {studentName}
                  {student?.cohort && (
                    <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">
                      {student.cohort.program.abbreviation} Cohort {student.cohort.cohort_number}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Confidential badge */}
            <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 px-3 py-1.5 rounded-full">
              <Lock className="w-3.5 h-3.5" />
              Confidential
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Status + Review Date row */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Plan Status</label>
              <select
                value={planStatus}
                onChange={(e) => setPlanStatus(e.target.value as typeof planStatus)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                <Calendar className="w-4 h-4 inline mr-1" />
                Next Review Date
              </label>
              <input
                type="date"
                value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Status</div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${statusConfig?.classes}`}>
                {statusConfig?.icon}
                {statusConfig?.label}
              </span>
            </div>
          </div>

          {plan && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-4">
              <span>Created by: <span className="font-medium">{plan.created_by || 'Unknown'}</span></span>
              <span>Created: <span className="font-medium">{formatDateTime(plan.created_at)}</span></span>
              <span>Last updated: <span className="font-medium">{formatDateTime(plan.updated_at)}</span></span>
              {plan.review_date && (
                <span>Review due: <span className="font-medium">{formatDate(plan.review_date)}</span></span>
              )}
            </div>
          )}
        </div>

        {/* Goals Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-indigo-500" />
              Learning Goals
            </h2>
            <button
              onClick={addGoal}
              className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Goal
            </button>
          </div>

          {goals.length === 0 ? (
            <div className="text-center py-8 text-gray-400 dark:text-gray-500">
              <CheckSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No goals yet. Click &quot;Add Goal&quot; to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {goals.map((goal, idx) => (
                <div
                  key={goal.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-2.5 w-5 text-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={goal.text}
                        onChange={(e) => updateGoal(goal.id, 'text', e.target.value)}
                        placeholder="Describe the learning goal..."
                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <input
                        type="date"
                        value={goal.target_date}
                        onChange={(e) => updateGoal(goal.id, 'target_date', e.target.value)}
                        title="Target date"
                        className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => removeGoal(goal.id)}
                    className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 mt-2 flex-shrink-0 transition-colors"
                    title="Remove goal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Accommodations Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <CheckSquare className="w-5 h-5 text-indigo-500" />
            Accommodations
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ACCOMMODATION_OPTIONS.map((opt) => {
              const checked = accommodations.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleAccommodation(opt.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm text-left transition-colors ${
                    checked
                      ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-600'
                  }`}
                >
                  {checked ? (
                    <CheckSquare className="w-4 h-4 flex-shrink-0 text-indigo-500" />
                  ) : (
                    <Square className="w-4 h-4 flex-shrink-0 text-gray-400" />
                  )}
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Additional / custom accommodations
            </label>
            <textarea
              value={customAccommodations}
              onChange={(e) => setCustomAccommodations(e.target.value)}
              rows={3}
              placeholder="Describe any additional accommodations or specific details..."
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSavePlan}
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {plan ? 'Save Changes' : 'Create Learning Plan'}
          </button>

          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="w-4 h-4" />
              Saved successfully
            </span>
          )}

          {saveError && (
            <span className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
              <XCircle className="w-4 h-4" />
              {saveError}
            </span>
          )}
        </div>

        {/* Progress Notes Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-1">
            <MessageSquare className="w-5 h-5 text-indigo-500" />
            Progress Notes
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" />
            Notes are append-only and cannot be edited or deleted (audit trail).
          </p>

          {/* Add note form */}
          {plan ? (
            <div className="mb-6">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
                placeholder="Add a progress note..."
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {noteError && (
                <p className="mt-1 text-xs text-red-500">{noteError}</p>
              )}
              <div className="mt-2 flex justify-end">
                <button
                  onClick={handleAddNote}
                  disabled={addingNote || !newNote.trim()}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  {addingNote ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Add Note
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-6 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Save the learning plan before adding progress notes.
            </div>
          )}

          {/* Notes list */}
          {notes.length === 0 ? (
            <div className="text-center py-6 text-gray-400 dark:text-gray-500">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No progress notes yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-l-4 border-indigo-300 dark:border-indigo-600"
                >
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {note.created_by}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {formatDateTime(note.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{note.note}</p>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
