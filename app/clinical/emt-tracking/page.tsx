'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  ClipboardCheck,
  Users,
  Search,
  Check,
  X,
  Loader2
} from 'lucide-react';
import { canAccessClinical, canEditClinical, type Role } from '@/lib/permissions';
import ExportDropdown from '@/components/ExportDropdown';
import type { ExportConfig } from '@/lib/export-utils';

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

interface TrackingRecord {
  id: string;
  student_id: string;
  mce_complete: boolean;
  vax_uploaded: boolean;
  ridealong_scanned: boolean;
  vitals_tracker_date: string | null;
  // Keep these for backwards compat with any new records
  vax_complete?: boolean;
  ride_along_complete?: boolean;
  vitals_complete?: boolean;
}

// EMT tracking columns - mapped to actual DB column names
// Note: MCE checkbox removed per Ryan's feedback — EMT students do NOT have mCE
const TRACKING_COLUMNS = [
  { key: 'vax_uploaded', label: 'Vax', fullName: 'Vaccinations' },
  { key: 'ridealong_scanned', label: 'Ride-Along', fullName: 'Ride-Along Complete' },
  { key: 'vitals_tracker_date', label: 'Vitals', fullName: 'Vitals Assessment', isDate: true },
];

export default function EMTTrackingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [tracking, setTracking] = useState<TrackingRecord[]>([]);
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

      // Fetch only EMT cohorts
      const cohortsRes = await fetch('/api/lab-management/cohorts?activeOnly=true');
      const cohortsData = await cohortsRes.json();
      if (cohortsData.success) {
        // Filter to EMT cohorts only
        const emtCohorts = (cohortsData.cohorts || []).filter(
          (c: CohortOption) => c.program?.abbreviation === 'EMT'
        );
        setCohorts(emtCohorts);
        if (emtCohorts.length > 0) {
          setSelectedCohort(emtCohorts[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const fetchCohortData = async () => {
    try {
      const [studentsRes, trackingRes] = await Promise.all([
        fetch(`/api/lab-management/students?cohortId=${selectedCohort}`),
        fetch(`/api/clinical/emt-tracking?cohortId=${selectedCohort}`),
      ]);

      const studentsData = await studentsRes.json();
      const trackingData = await trackingRes.json();

      if (studentsData.success) setStudents(studentsData.students || []);
      if (trackingData.success) setTracking(trackingData.tracking || []);
    } catch (error) {
      console.error('Error fetching cohort data:', error);
    }
  };

  const getTrackingStatus = (studentId: string, field: string): boolean => {
    const record = tracking.find(t => t.student_id === studentId);
    if (!record) return false;
    const value = (record as any)[field];
    // Handle both boolean fields and date fields (truthy date = complete)
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string' && value.trim()) return true; // non-empty date string = complete
    return !!value;
  };

  const toggleField = async (studentId: string, field: string) => {
    if (!userRole || !canEditClinical(userRole)) return;

    const cellKey = `${studentId}-${field}`;
    setSaving(cellKey);

    const currentValue = getTrackingStatus(studentId, field);
    // For date fields, toggle between today's date and null; for booleans, toggle true/false
    const colConfig = TRACKING_COLUMNS.find(c => c.key === field);
    const isDateField = (colConfig as any)?.isDate;
    const newValue = isDateField
      ? (currentValue ? null : new Date().toISOString().split('T')[0])
      : !currentValue;

    try {
      const res = await fetch('/api/clinical/emt-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          field,
          value: newValue,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Optimistically update local state for instant feedback
        setTracking(prev => {
          const existing = prev.find(t => t.student_id === studentId);
          if (existing) {
            return prev.map(t =>
              t.student_id === studentId ? { ...t, [field]: newValue } : t
            );
          } else {
            return [...prev, { id: data.tracking?.id || '', student_id: studentId, mce_complete: false, vax_uploaded: false, ridealong_scanned: false, vitals_tracker_date: null, [field]: newValue } as unknown as TrackingRecord];
          }
        });
      } else {
        console.error('EMT tracking save failed:', data.error);
        // Refresh to show actual state
        await fetchCohortData();
      }
    } catch (error) {
      console.error('Error toggling field:', error);
      // Refresh to show actual state on error
      await fetchCohortData();
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
      const studentCompleted = TRACKING_COLUMNS.filter(col =>
        getTrackingStatus(student.id, col.key)
      ).length;
      if (studentCompleted === TRACKING_COLUMNS.length) return false;
    }

    return true;
  });

  // Calculate stats
  const totalCells = students.length * TRACKING_COLUMNS.length;
  const completedCells = students.reduce((acc, student) => {
    return acc + TRACKING_COLUMNS.filter(col => getTrackingStatus(student.id, col.key)).length;
  }, 0);
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

  // Get selected cohort details for export
  const selectedCohortDetails = cohorts.find(c => c.id === selectedCohort);
  const cohortLabel = selectedCohortDetails
    ? `EMT Group ${selectedCohortDetails.cohort_number}`
    : 'EMT';

  // Export configuration
  const exportConfig: ExportConfig = {
    title: 'EMT Student Tracking Roster',
    subtitle: selectedCohortDetails ? cohortLabel : undefined,
    filename: `emt-tracking-${cohortLabel.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}`,
    columns: [
      { key: 'name', label: 'Student Name', getValue: (row) => `${row.first_name} ${row.last_name}` },
      { key: 'email', label: 'Email', getValue: (row) => row.email || '' },
      ...TRACKING_COLUMNS.map(col => ({
        key: col.key,
        label: col.label,
        getValue: (row: any) => getTrackingStatus(row.id, col.key)
      })),
      {
        key: 'progress',
        label: 'Progress',
        getValue: (row: any) => {
          const completed = TRACKING_COLUMNS.filter(col => getTrackingStatus(row.id, col.key)).length;
          return `${Math.round((completed / TRACKING_COLUMNS.length) * 100)}%`;
        }
      }
    ],
    data: filteredStudents
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/clinical" className="hover:text-teal-600 dark:hover:text-teal-400">Clinical</Link>
            <ChevronRight className="w-4 h-4" />
            <span>EMT Tracking</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <ClipboardCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">EMT Student Tracking</h1>
                <p className="text-gray-600 dark:text-gray-400">Track vaccinations, ride-alongs, and vitals</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{completionPercent}%</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Complete</div>
              </div>
              <ExportDropdown config={exportConfig} disabled={!selectedCohort || filteredStudents.length === 0} />
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
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
                <option value="">Select EMT Cohort</option>
                {cohorts.map(c => (
                  <option key={c.id} value={c.id}>
                    EMT Group {c.cohort_number}
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
                className="w-4 h-4 text-blue-600 rounded"
              />
              Show incomplete only
            </label>
          </div>
        </div>

        {/* No EMT cohorts message */}
        {cohorts.length === 0 && !loading && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No EMT cohorts found</p>
          </div>
        )}

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
                    {TRACKING_COLUMNS.map(col => (
                      <th
                        key={col.key}
                        className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
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
                      <td colSpan={TRACKING_COLUMNS.length + 2} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        No students found
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(student => {
                      const studentCompleted = TRACKING_COLUMNS.filter(col =>
                        getTrackingStatus(student.id, col.key)
                      ).length;
                      const studentPercent = Math.round((studentCompleted / TRACKING_COLUMNS.length) * 100);

                      return (
                        <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 z-10">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {student.first_name} {student.last_name}
                            </div>
                          </td>
                          {TRACKING_COLUMNS.map(col => {
                            const isCompleted = getTrackingStatus(student.id, col.key);
                            const cellKey = `${student.id}-${col.key}`;
                            const isSaving = saving === cellKey;

                            return (
                              <td key={col.key} className="px-4 py-3 text-center">
                                <button
                                  onClick={() => toggleField(student.id, col.key)}
                                  disabled={!canEdit || isSaving}
                                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                                    isCompleted
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                                  } ${!canEdit ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                  title={`${col.fullName}: ${isCompleted ? 'Complete' : 'Incomplete'}`}
                                >
                                  {isSaving ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                  ) : isCompleted ? (
                                    <Check className="w-5 h-5" />
                                  ) : (
                                    <X className="w-5 h-5" />
                                  )}
                                </button>
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden min-w-[60px]">
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
                              <span className="text-xs text-gray-500 dark:text-gray-400 w-10">
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

        {!selectedCohort && cohorts.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Select a cohort to view tracking data</p>
          </div>
        )}
      </main>
    </div>
  );
}
