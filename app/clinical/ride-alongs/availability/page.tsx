'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Users,
  Loader2,
  Check,
  X,
  Search,
} from 'lucide-react';
import { canAccessClinical, type Role } from '@/lib/permissions';
import Breadcrumbs from '@/components/Breadcrumbs';

interface AvailabilityRecord {
  id: string;
  student_id: string;
  cohort_id: string | null;
  semester_id: string | null;
  available_days: Record<string, boolean>;
  preferred_shift_type: string[];
  preferred_dates: string[];
  unavailable_dates: string[];
  notes: string | null;
  submitted_at: string;
  updated_at: string;
}

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

const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function RideAlongAvailabilityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [availability, setAvailability] = useState<AvailabilityRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [selectedCohort, setSelectedCohort] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  useEffect(() => {
    if (session) fetchInitialData();
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
        if (!canAccessClinical(userData.user.role)) { router.push('/'); return; }
      }

      const cohortsRes = await fetch('/api/cohorts?active_only=true');
      const cohortsData = await cohortsRes.json();
      setCohorts(cohortsData.cohorts || []);

      // Fetch all availability
      const availRes = await fetch('/api/clinical/ride-alongs/availability');
      const availData = await availRes.json();
      setAvailability(availData.availability || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  const fetchCohortData = async () => {
    try {
      const [studentsRes, availRes] = await Promise.all([
        fetch(`/api/students?cohort_id=${selectedCohort}&status=active`),
        fetch(`/api/clinical/ride-alongs/availability?cohort_id=${selectedCohort}`),
      ]);

      const studentsData = await studentsRes.json();
      const availData = await availRes.json();

      setStudents(studentsData.students || []);
      setAvailability(availData.availability || []);
    } catch (error) {
      console.error('Error fetching cohort data:', error);
    }
  };

  const getStudentAvailability = (studentId: string): AvailabilityRecord | undefined => {
    return availability.find(a => a.student_id === studentId);
  };

  const filteredStudents = students.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.first_name.toLowerCase().includes(q) ||
      s.last_name.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q)
    );
  });

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Breadcrumbs className="mb-2" />
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Student Availability</h1>
              <p className="text-gray-600 dark:text-gray-400">View and manage ride-along availability submissions</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="">-- Select Cohort --</option>
              {cohorts.map(c => (
                <option key={c.id} value={c.id}>{c.program?.abbreviation} C{c.cohort_number}</option>
              ))}
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              {selectedCohort && (
                <>
                  {availability.length} of {students.length} students submitted availability
                </>
              )}
            </div>
          </div>
        </div>

        {!selectedCohort ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 text-center">
            <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Select a cohort to view student availability</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Student</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">Submitted</th>
                    {DAY_LABELS.map(d => (
                      <th key={d} className="px-2 py-3 text-center font-medium text-gray-700 dark:text-gray-300">{d}</th>
                    ))}
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Shift Pref</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Preferred Dates</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={10 + DAY_LABELS.length} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        No students found.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => {
                      const avail = getStudentAvailability(student.id);
                      return (
                        <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                            {student.first_name} {student.last_name}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {avail ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full">
                                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-6 h-6 bg-red-100 dark:bg-red-900/30 rounded-full">
                                <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                              </span>
                            )}
                          </td>
                          {DAY_NAMES.map(day => (
                            <td key={day} className="px-2 py-3 text-center">
                              {avail ? (
                                avail.available_days[day] === true ? (
                                  <span className="inline-block w-5 h-5 bg-green-500 rounded-sm" title="Available" />
                                ) : avail.available_days[day] === false ? (
                                  <span className="inline-block w-5 h-5 bg-red-400 rounded-sm" title="Unavailable" />
                                ) : (
                                  <span className="inline-block w-5 h-5 bg-gray-200 dark:bg-gray-600 rounded-sm" title="No preference" />
                                )
                              ) : (
                                <span className="inline-block w-5 h-5 bg-gray-100 dark:bg-gray-700 rounded-sm" title="Not submitted" />
                              )}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                            {avail?.preferred_shift_type?.length
                              ? avail.preferred_shift_type.join(', ')
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-xs">
                            {avail?.preferred_dates?.length
                              ? avail.preferred_dates.slice(0, 3).map(d =>
                                  new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                ).join(', ') + (avail.preferred_dates.length > 3 ? ` +${avail.preferred_dates.length - 3}` : '')
                              : '-'}
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
      </main>
    </div>
  );
}
