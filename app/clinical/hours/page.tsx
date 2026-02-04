'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Clock,
  Users,
  Search,
  Loader2,
  Save
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

interface ClinicalHours {
  id: string;
  student_id: string;
  department: string;
  shifts: number;
  hours: number;
  notes: string | null;
}

// Department columns configuration
const DEPT_COLUMNS = [
  { key: 'orientation', label: 'Orient', fullName: 'Orientation' },
  { key: 'ed', label: 'ED', fullName: 'Emergency Department' },
  { key: 'icu', label: 'ICU', fullName: 'Intensive Care Unit' },
  { key: 'or', label: 'OR', fullName: 'Operating Room' },
  { key: 'ld', label: 'L&D', fullName: 'Labor & Delivery' },
  { key: 'peds_ed', label: 'Peds ED', fullName: 'Pediatric ED' },
  { key: 'peds_icu', label: 'Peds ICU', fullName: 'Pediatric ICU' },
  { key: 'psych', label: 'Psych', fullName: 'Psychiatry' },
  { key: 'ccl', label: 'CCL', fullName: 'Cardiac Cath Lab' },
  { key: 'ems', label: 'EMS', fullName: 'Emergency Medical Services' },
];

export default function ClinicalHoursTrackerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [hoursData, setHoursData] = useState<ClinicalHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<Role | null>(null);

  const [selectedCohort, setSelectedCohort] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState({ shifts: 0, hours: 0 });

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
      const [studentsRes, hoursRes] = await Promise.all([
        fetch(`/api/lab-management/students?cohortId=${selectedCohort}`),
        fetch(`/api/clinical/hours?cohortId=${selectedCohort}`),
      ]);

      const studentsData = await studentsRes.json();
      const hoursDataRes = await hoursRes.json();

      if (studentsData.success) setStudents(studentsData.students || []);
      if (hoursDataRes.success) setHoursData(hoursDataRes.hours || []);
    } catch (error) {
      console.error('Error fetching cohort data:', error);
    }
  };

  const getHours = (studentId: string, department: string): ClinicalHours | null => {
    return hoursData.find(h => h.student_id === studentId && h.department === department) || null;
  };

  const startEditing = (studentId: string, department: string) => {
    if (!userRole || !canEditClinical(userRole)) return;

    const existing = getHours(studentId, department);
    setEditingCell(`${studentId}-${department}`);
    setEditValue({
      shifts: existing?.shifts || 0,
      hours: existing?.hours || 0,
    });
  };

  const saveHours = async (studentId: string, department: string) => {
    const cellKey = `${studentId}-${department}`;
    setSaving(cellKey);

    try {
      const res = await fetch('/api/clinical/hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          department,
          shifts: editValue.shifts,
          hours: editValue.hours,
        }),
      });

      if (res.ok) {
        await fetchCohortData();
      }
    } catch (error) {
      console.error('Error saving hours:', error);
    }
    setSaving(null);
    setEditingCell(null);
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditValue({ shifts: 0, hours: 0 });
  };

  // Filter students
  const filteredStudents = students.filter(student => {
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      const name = `${student.first_name} ${student.last_name}`.toLowerCase();
      if (!name.includes(search)) return false;
    }
    return true;
  });

  // Calculate totals
  const getStudentTotal = (studentId: string) => {
    const studentHours = hoursData.filter(h => h.student_id === studentId);
    return {
      shifts: studentHours.reduce((sum, h) => sum + (h.shifts || 0), 0),
      hours: studentHours.reduce((sum, h) => sum + (h.hours || 0), 0),
    };
  };

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
            <span>Clinical Hours</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clinical Hours Tracker</h1>
              <p className="text-gray-600 dark:text-gray-400">Track shifts and hours by department</p>
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

            <div className="text-sm text-gray-500 dark:text-gray-400">
              Click any cell to edit shifts/hours
            </div>
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
                    {DEPT_COLUMNS.map(col => (
                      <th
                        key={col.key}
                        className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                        title={col.fullName}
                      >
                        {col.label}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-blue-50 dark:bg-blue-900/20">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={DEPT_COLUMNS.length + 2} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        No students found
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(student => {
                      const totals = getStudentTotal(student.id);

                      return (
                        <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 z-10">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {student.first_name} {student.last_name}
                            </div>
                          </td>
                          {DEPT_COLUMNS.map(col => {
                            const hours = getHours(student.id, col.key);
                            const cellKey = `${student.id}-${col.key}`;
                            const isEditing = editingCell === cellKey;
                            const isSaving = saving === cellKey;

                            return (
                              <td key={col.key} className="px-3 py-2 text-center">
                                {isEditing ? (
                                  <div className="flex flex-col gap-1 min-w-[80px]">
                                    <input
                                      type="number"
                                      value={editValue.shifts}
                                      onChange={(e) => setEditValue({ ...editValue, shifts: parseInt(e.target.value) || 0 })}
                                      className="w-full px-2 py-1 text-xs border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                                      placeholder="Shifts"
                                      min="0"
                                    />
                                    <input
                                      type="number"
                                      value={editValue.hours}
                                      onChange={(e) => setEditValue({ ...editValue, hours: parseFloat(e.target.value) || 0 })}
                                      className="w-full px-2 py-1 text-xs border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                                      placeholder="Hours"
                                      min="0"
                                      step="0.5"
                                    />
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => saveHours(student.id, col.key)}
                                        disabled={isSaving}
                                        className="flex-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                                      >
                                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : <Save className="w-3 h-3 mx-auto" />}
                                      </button>
                                      <button
                                        onClick={cancelEditing}
                                        className="flex-1 px-2 py-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                                      >
                                        X
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => startEditing(student.id, col.key)}
                                    disabled={!canEdit}
                                    className={`min-w-[60px] px-2 py-1 rounded text-xs transition-colors ${
                                      hours && (hours.shifts > 0 || hours.hours > 0)
                                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                                    } ${canEdit ? 'hover:bg-blue-200 dark:hover:bg-blue-900/50 cursor-pointer' : 'cursor-not-allowed'}`}
                                  >
                                    {hours && (hours.shifts > 0 || hours.hours > 0) ? (
                                      <div>
                                        <div className="font-medium">{hours.shifts}s</div>
                                        <div className="text-[10px]">{hours.hours}h</div>
                                      </div>
                                    ) : (
                                      '-'
                                    )}
                                  </button>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-center bg-blue-50 dark:bg-blue-900/20">
                            <div className="font-semibold text-blue-700 dark:text-blue-300">
                              {totals.shifts}s / {totals.hours}h
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
            <p className="text-gray-500 dark:text-gray-400">Select a cohort to view clinical hours</p>
          </div>
        )}
      </main>
    </div>
  );
}
