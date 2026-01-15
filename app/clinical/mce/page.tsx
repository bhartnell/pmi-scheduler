'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  BookOpen,
  Users,
  Search,
  Check,
  X,
  Loader2
} from 'lucide-react';
import { canAccessClinical, canEditClinical, type Role } from '@/lib/permissions';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

interface CohortOption {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

interface MCEModule {
  id: string;
  student_id: string;
  module_name: string;
  completed: boolean;
  completion_date: string | null;
}

// mCE Module columns configuration
const MCE_COLUMNS = [
  { key: 'airway', label: 'Airway' },
  { key: 'respiratory', label: 'Resp' },
  { key: 'cardiovascular', label: 'Cardio' },
  { key: 'trauma', label: 'Trauma' },
  { key: 'medical', label: 'Medical' },
  { key: 'obstetrics', label: 'OB' },
  { key: 'pediatrics', label: 'Peds' },
  { key: 'geriatrics', label: 'Geri' },
  { key: 'behavioral', label: 'Behav' },
  { key: 'toxicology', label: 'Tox' },
  { key: 'neurology', label: 'Neuro' },
  { key: 'endocrine', label: 'Endo' },
  { key: 'immunology', label: 'Immuno' },
  { key: 'infectious', label: 'Infect' },
  { key: 'operations', label: 'Ops' },
];

export default function MCETrackerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [modules, setModules] = useState<MCEModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<Role | null>(null);

  const [selectedCohort, setSelectedCohort] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchInitialData();
    }
  }, [session]);

  useEffect(() => {
    if (selectedCohort) {
      fetchCohortData();
    }
  }, [selectedCohort]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const userRes = await fetch('/api/instructor/me');
      const userData = await userRes.json();
      if (userData.success && userData.user) {
        setUserRole(userData.user.role);
        if (!canAccessClinical(userData.user.role)) {
          router.push('/');
          return;
        }
      }

      const cohortsRes = await fetch('/api/lab-management/cohorts?activeOnly=true');
      const cohortsData = await cohortsRes.json();
      if (cohortsData.success) {
        setCohorts(cohortsData.cohorts || []);
        if (cohortsData.cohorts?.length > 0) {
          setSelectedCohort(cohortsData.cohorts[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const fetchCohortData = async () => {
    try {
      const [studentsRes, modulesRes] = await Promise.all([
        fetch(`/api/lab-management/students?cohortId=${selectedCohort}`),
        fetch(`/api/clinical/mce?cohortId=${selectedCohort}`),
      ]);

      const studentsData = await studentsRes.json();
      const modulesData = await modulesRes.json();

      if (studentsData.success) setStudents(studentsData.students || []);
      if (modulesData.success) setModules(modulesData.modules || []);
    } catch (error) {
      console.error('Error fetching cohort data:', error);
    }
  };

  const getModuleStatus = (studentId: string, moduleName: string): MCEModule | null => {
    return modules.find(m => m.student_id === studentId && m.module_name === moduleName) || null;
  };

  const toggleModule = async (studentId: string, moduleName: string) => {
    if (!userRole || !canEditClinical(userRole)) return;

    const cellKey = `${studentId}-${moduleName}`;
    setSaving(cellKey);

    const existing = getModuleStatus(studentId, moduleName);
    const newCompleted = !existing?.completed;

    try {
      const res = await fetch('/api/clinical/mce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          module_name: moduleName,
          completed: newCompleted,
          completion_date: newCompleted ? new Date().toISOString().split('T')[0] : null,
        }),
      });

      if (res.ok) {
        await fetchCohortData();
      }
    } catch (error) {
      console.error('Error toggling module:', error);
    }
    setSaving(null);
  };

  // Filter students
  const filteredStudents = students.filter(student => {
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      const name = `${student.first_name} ${student.last_name}`.toLowerCase();
      if (!name.includes(search)) return false;
    }

    if (showIncompleteOnly) {
      const studentModules = modules.filter(m => m.student_id === student.id && m.completed);
      if (studentModules.length === MCE_COLUMNS.length) return false;
    }

    return true;
  });

  // Calculate stats
  const totalCells = students.length * MCE_COLUMNS.length;
  const completedCells = modules.filter(m => m.completed).length;
  const completionPercent = totalCells > 0 ? Math.round((completedCells / totalCells) * 100) : 0;

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!session) return null;

  const canEdit = userRole && canEditClinical(userRole);

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-full mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/clinical" className="hover:text-teal-600 dark:hover:text-teal-400">Clinical</Link>
            <ChevronRight className="w-4 h-4" />
            <span>mCE Modules</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <BookOpen className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">mCE Module Tracker</h1>
                <p className="text-gray-600 dark:text-gray-400">Track continuing education module completion</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{completionPercent}%</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Complete</div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-full mx-auto px-4 py-6 space-y-4">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-400" />
              <select
                value={selectedCohort}
                onChange={(e) => setSelectedCohort(e.target.value)}
                className="px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 min-w-[200px]"
              >
                <option value="">Select Cohort</option>
                {cohorts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.program?.abbreviation || 'PMD'} Group {c.cohort_number}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showIncompleteOnly}
                onChange={(e) => setShowIncompleteOnly(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded"
              />
              Show incomplete only
            </label>
          </div>
        </div>

        {/* Grid Table */}
        {selectedCohort && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700 z-10">
                      Student
                    </th>
                    {MCE_COLUMNS.map(col => (
                      <th
                        key={col.key}
                        className="px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                      >
                        {col.label}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Progress
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={MCE_COLUMNS.length + 2} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        No students found
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(student => {
                      const studentCompleted = modules.filter(m => m.student_id === student.id && m.completed).length;
                      const studentPercent = Math.round((studentCompleted / MCE_COLUMNS.length) * 100);

                      return (
                        <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 z-10">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {student.first_name} {student.last_name}
                            </div>
                          </td>
                          {MCE_COLUMNS.map(col => {
                            const mod = getModuleStatus(student.id, col.key);
                            const isCompleted = mod?.completed;
                            const cellKey = `${student.id}-${col.key}`;
                            const isSaving = saving === cellKey;

                            return (
                              <td key={col.key} className="px-2 py-3 text-center">
                                <button
                                  onClick={() => toggleModule(student.id, col.key)}
                                  disabled={!canEdit || isSaving}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                    isCompleted
                                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50'
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                                  } ${!canEdit ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                  {isSaving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : isCompleted ? (
                                    <Check className="w-4 h-4" />
                                  ) : (
                                    <X className="w-4 h-4" />
                                  )}
                                </button>
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all ${
                                    studentPercent === 100
                                      ? 'bg-purple-500'
                                      : studentPercent >= 75
                                      ? 'bg-yellow-500'
                                      : 'bg-red-500'
                                  }`}
                                  style={{ width: `${studentPercent}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 dark:text-gray-400 w-8">
                                {studentPercent}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!selectedCohort && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Select a cohort to view mCE modules</p>
          </div>
        )}
      </main>
    </div>
  );
}
