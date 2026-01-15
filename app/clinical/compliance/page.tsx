'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  FileCheck,
  Users,
  Search,
  Check,
  X,
  Loader2,
  AlertCircle
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

interface ComplianceDoc {
  id: string;
  student_id: string;
  doc_type: string;
  completed: boolean;
  completion_date: string | null;
  expiration_date: string | null;
  notes: string | null;
}

// Document columns configuration
const DOC_COLUMNS = [
  { key: 'mmr', label: 'MMR', fullName: 'MMR Vaccine' },
  { key: 'vzv', label: 'VZV', fullName: 'Varicella' },
  { key: 'hepb', label: 'HepB', fullName: 'Hepatitis B' },
  { key: 'tdap', label: 'Tdap', fullName: 'Tdap Vaccine' },
  { key: 'covid', label: 'COVID', fullName: 'COVID Vaccine' },
  { key: 'tb', label: 'TB', fullName: 'TB Test' },
  { key: 'physical', label: 'Physical', fullName: 'Physical Exam' },
  { key: 'insurance', label: 'Insurance', fullName: 'Health Insurance' },
  { key: 'bls', label: 'BLS', fullName: 'BLS Card' },
  { key: 'flu', label: 'Flu', fullName: 'Flu Vaccine' },
  { key: 'hospital_orient', label: 'Hosp Orient', fullName: 'Hospital Orientation' },
  { key: 'background', label: 'BG', fullName: 'Background Check' },
  { key: 'drug_test', label: 'DT', fullName: 'Drug Test' },
];

export default function ComplianceTrackerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [docs, setDocs] = useState<ComplianceDoc[]>([]);
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
      const [studentsRes, docsRes] = await Promise.all([
        fetch(`/api/lab-management/students?cohortId=${selectedCohort}`),
        fetch(`/api/clinical/compliance?cohortId=${selectedCohort}`),
      ]);

      const studentsData = await studentsRes.json();
      const docsData = await docsRes.json();

      if (studentsData.success) setStudents(studentsData.students || []);
      if (docsData.success) setDocs(docsData.docs || []);
    } catch (error) {
      console.error('Error fetching cohort data:', error);
    }
  };

  const getDocStatus = (studentId: string, docType: string): ComplianceDoc | null => {
    return docs.find(d => d.student_id === studentId && d.doc_type === docType) || null;
  };

  const toggleDoc = async (studentId: string, docType: string) => {
    if (!userRole || !canEditClinical(userRole)) return;

    const cellKey = `${studentId}-${docType}`;
    setSaving(cellKey);

    const existing = getDocStatus(studentId, docType);
    const newCompleted = !existing?.completed;

    try {
      const res = await fetch('/api/clinical/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          doc_type: docType,
          completed: newCompleted,
          completion_date: newCompleted ? new Date().toISOString().split('T')[0] : null,
        }),
      });

      if (res.ok) {
        await fetchCohortData();
      }
    } catch (error) {
      console.error('Error toggling doc:', error);
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
      const studentDocs = docs.filter(d => d.student_id === student.id && d.completed);
      if (studentDocs.length === DOC_COLUMNS.length) return false;
    }

    return true;
  });

  // Calculate stats
  const totalCells = students.length * DOC_COLUMNS.length;
  const completedCells = docs.filter(d => d.completed).length;
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
            <span>Compliance Docs</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <FileCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Compliance Docs Tracker</h1>
                <p className="text-gray-600 dark:text-gray-400">Track immunizations, clearances, and required documents</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{completionPercent}%</div>
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
                className="w-4 h-4 text-green-600 rounded"
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
                    {DOC_COLUMNS.map(col => (
                      <th
                        key={col.key}
                        className="px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                        title={col.fullName}
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
                      <td colSpan={DOC_COLUMNS.length + 2} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        No students found
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(student => {
                      const studentCompleted = docs.filter(d => d.student_id === student.id && d.completed).length;
                      const studentPercent = Math.round((studentCompleted / DOC_COLUMNS.length) * 100);

                      return (
                        <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 z-10">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {student.first_name} {student.last_name}
                            </div>
                          </td>
                          {DOC_COLUMNS.map(col => {
                            const doc = getDocStatus(student.id, col.key);
                            const isCompleted = doc?.completed;
                            const cellKey = `${student.id}-${col.key}`;
                            const isSaving = saving === cellKey;

                            return (
                              <td key={col.key} className="px-2 py-3 text-center">
                                <button
                                  onClick={() => toggleDoc(student.id, col.key)}
                                  disabled={!canEdit || isSaving}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                    isCompleted
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                                  } ${!canEdit ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                  title={`${col.fullName}: ${isCompleted ? 'Complete' : 'Incomplete'}`}
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
                                      ? 'bg-green-500'
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
            <p className="text-gray-500 dark:text-gray-400">Select a cohort to view compliance documents</p>
          </div>
        )}
      </main>
    </div>
  );
}
