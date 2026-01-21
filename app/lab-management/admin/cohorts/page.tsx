'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
  Users,
  Calendar,
  Check,
  X,
  AlertCircle
} from 'lucide-react';
import { canManageCohorts, type Role } from '@/lib/permissions';

interface Program {
  id: string;
  name: string;
  abbreviation: string;
}

interface Cohort {
  id: string;
  cohort_number: number;
  start_date: string | null;
  expected_end_date: string | null;
  is_active: boolean;
  student_count: number;
  program: Program;
  current_semester: number | null;
}

// Semester options for PM cohorts (integer values 1-4)
const PM_SEMESTERS = [
  { value: 1, label: '1 - Didactic/Lab' },
  { value: 2, label: '2 - Clinical Prep' },
  { value: 3, label: '3 - Clinicals' },
  { value: 4, label: '4 - Internship' },
];

export default function CohortManagementPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createProgramId, setCreateProgramId] = useState('');
  const [createCohortNumber, setCreateCohortNumber] = useState('');
  const [createStartDate, setCreateStartDate] = useState('');
  const [createEndDate, setCreateEndDate] = useState('');
  const [createSemester, setCreateSemester] = useState<number | ''>('');
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editSemester, setEditSemester] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<Role | null>(null);

  // Helper to check if program is PM
  const isPMProgram = (programId: string) => {
    const program = programs.find(p => p.id === programId);
    return program?.abbreviation === 'PM' || program?.abbreviation === 'PMD';
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchData();
      fetchCurrentUser();
    }
  }, [session, showInactive]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        setUserRole(data.user.role);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch programs
      const programsRes = await fetch('/api/lab-management/programs');
      const programsData = await programsRes.json();
      if (programsData.success) {
        setPrograms(programsData.programs);
        if (programsData.programs.length > 0 && !createProgramId) {
          setCreateProgramId(programsData.programs[0].id);
        }
      }

      // Fetch cohorts
      const cohortsRes = await fetch(`/api/lab-management/cohorts?activeOnly=${!showInactive}`);
      const cohortsData = await cohortsRes.json();
      if (cohortsData.success) {
        setCohorts(cohortsData.cohorts);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createProgramId || !createCohortNumber) {
      alert('Program and cohort number are required');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/lab-management/cohorts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: createProgramId,
          cohort_number: parseInt(createCohortNumber),
          start_date: createStartDate || null,
          expected_end_date: createEndDate || null,
          current_semester: isPMProgram(createProgramId) && createSemester !== '' ? createSemester : null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCohorts([data.cohort, ...cohorts]);
        setShowCreateForm(false);
        setCreateCohortNumber('');
        setCreateStartDate('');
        setCreateEndDate('');
        setCreateSemester('');
      } else {
        alert('Failed to create cohort: ' + data.error);
      }
    } catch (error) {
      console.error('Error creating cohort:', error);
      alert('Failed to create cohort');
    }
    setCreating(false);
  };

  const startEdit = (cohort: Cohort) => {
    setEditingId(cohort.id);
    setEditStartDate(cohort.start_date || '');
    setEditEndDate(cohort.expected_end_date || '');
    setEditSemester(cohort.current_semester ?? '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditStartDate('');
    setEditEndDate('');
    setEditSemester('');
  };

  const handleSaveEdit = async (cohortId: string) => {
    setSaving(true);
    try {
      const cohort = cohorts.find(c => c.id === cohortId);
      const isPM = cohort && (cohort.program.abbreviation === 'PM' || cohort.program.abbreviation === 'PMD');

      const res = await fetch(`/api/lab-management/cohorts/${cohortId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: editStartDate || null,
          expected_end_date: editEndDate || null,
          current_semester: isPM && editSemester !== '' ? editSemester : null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCohorts(cohorts.map(c => c.id === cohortId ? { ...c, ...data.cohort } : c));
        setEditingId(null);
      } else {
        alert('Failed to update: ' + data.error);
      }
    } catch (error) {
      console.error('Error updating:', error);
      alert('Failed to update');
    }
    setSaving(false);
  };

  const handleToggleActive = async (cohort: Cohort) => {
    const action = cohort.is_active ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} ${cohort.program.abbreviation} Group ${cohort.cohort_number}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/lab-management/cohorts/${cohort.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !cohort.is_active }),
      });

      const data = await res.json();
      if (data.success) {
        if (showInactive) {
          setCohorts(cohorts.map(c => c.id === cohort.id ? { ...c, is_active: !cohort.is_active } : c));
        } else {
          setCohorts(cohorts.filter(c => c.id !== cohort.id));
        }
      }
    } catch (error) {
      console.error('Error toggling active:', error);
    }
  };

  const handleDelete = async (cohort: Cohort) => {
    if (cohort.student_count > 0) {
      alert(`Cannot delete ${cohort.program.abbreviation} Group ${cohort.cohort_number} because it has ${cohort.student_count} students. Remove students first or mark as inactive.`);
      return;
    }

    if (!confirm(`Are you sure you want to delete ${cohort.program.abbreviation} Group ${cohort.cohort_number}? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/lab-management/cohorts/${cohort.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        setCohorts(cohorts.filter(c => c.id !== cohort.id));
      } else {
        alert('Failed to delete: ' + data.error);
      }
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Failed to delete');
    }
  };

  // Group cohorts by program
  const cohortsByProgram = programs.map(program => ({
    program,
    cohorts: cohorts.filter(c => c.program.id === program.id),
  }));

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/admin" className="hover:text-blue-600 dark:hover:text-blue-400">Admin</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="dark:text-gray-300">Cohorts</span>
          </div>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Cohorts</h1>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              New Cohort
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create New Cohort</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Program</label>
                  <select
                    value={createProgramId}
                    onChange={(e) => {
                      setCreateProgramId(e.target.value);
                      if (!isPMProgram(e.target.value)) setCreateSemester('');
                    }}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  >
                    {programs.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Group Number</label>
                  <input
                    type="number"
                    min="1"
                    value={createCohortNumber}
                    onChange={(e) => setCreateCohortNumber(e.target.value)}
                    placeholder="e.g., 14"
                    required
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester</label>
                  {isPMProgram(createProgramId) ? (
                    <select
                      value={createSemester}
                      onChange={(e) => setCreateSemester(e.target.value ? parseInt(e.target.value) : '')}
                      className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    >
                      <option value="">Select...</option>
                      {PM_SEMESTERS.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400">
                      N/A
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={createStartDate}
                    onChange={(e) => setCreateStartDate(e.target.value)}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                  <input
                    type="date"
                    value={createEndDate}
                    onChange={(e) => setCreateEndDate(e.target.value)}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {creating ? 'Creating...' : 'Create Cohort'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filter */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            Show inactive cohorts
          </label>
        </div>

        {/* Cohorts by Program */}
        {cohortsByProgram.map(({ program, cohorts: programCohorts }) => (
          <div key={program.id} className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">{program.name}</h2>
            </div>

            {programCohorts.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No {showInactive ? '' : 'active '}cohorts for {program.name}
              </div>
            ) : (
              <div className="divide-y dark:divide-gray-700">
                {programCohorts.map(cohort => (
                  <div key={cohort.id} className={`p-4 ${!cohort.is_active ? 'bg-gray-50 dark:bg-gray-700/50 opacity-75' : ''}`}>
                    {editingId === cohort.id ? (
                      // Edit mode
                      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                        <div className="font-medium text-gray-900 dark:text-white min-w-[120px]">
                          {program.abbreviation} Group {cohort.cohort_number}
                        </div>
                        <div className="flex flex-wrap gap-2 flex-1 items-center">
                          {(program.abbreviation === 'PM' || program.abbreviation === 'PMD') ? (
                            <select
                              value={editSemester}
                              onChange={(e) => setEditSemester(e.target.value ? parseInt(e.target.value) : '')}
                              className="px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                            >
                              <option value="">No Semester</option>
                              {PM_SEMESTERS.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="px-2 py-1 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-600 rounded">
                              N/A
                            </span>
                          )}
                          <input
                            type="date"
                            value={editStartDate}
                            onChange={(e) => setEditStartDate(e.target.value)}
                            className="px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                            placeholder="Start date"
                          />
                          <span className="text-gray-500 dark:text-gray-400">to</span>
                          <input
                            type="date"
                            value={editEndDate}
                            onChange={(e) => setEditEndDate(e.target.value)}
                            className="px-2 py-1 border dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                            placeholder="End date"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveEdit(cohort.id)}
                            disabled={saving}
                            className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                              {program.abbreviation} Group {cohort.cohort_number}
                              {(program.abbreviation === 'PM' || program.abbreviation === 'PMD') && cohort.current_semester && (
                                <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs rounded font-semibold">
                                  S{cohort.current_semester}
                                </span>
                              )}
                              {(program.abbreviation !== 'PM' && program.abbreviation !== 'PMD') && (
                                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded">
                                  N/A
                                </span>
                              )}
                              {!cohort.is_active && (
                                <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs rounded">
                                  Inactive
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {cohort.student_count} students
                              </span>
                              {(cohort.start_date || cohort.expected_end_date) && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {cohort.start_date ? new Date(cohort.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '?'}
                                  {' - '}
                                  {cohort.expected_end_date ? new Date(cohort.expected_end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '?'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/lab-management/cohorts/${cohort.id}`}
                            className="px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                          >
                            Open Hub
                          </Link>
                          <button
                            onClick={() => startEdit(cohort)}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            title="Edit dates"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleActive(cohort)}
                            className={`p-2 rounded ${cohort.is_active ? 'text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/30' : 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30'}`}
                            title={cohort.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {cohort.is_active ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                          </button>
                          {userRole && canManageCohorts(userRole) && (
                            <button
                              onClick={() => handleDelete(cohort)}
                              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
