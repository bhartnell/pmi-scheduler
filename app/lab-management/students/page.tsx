'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Plus,
  Search,
  Upload,
  Users,
  Star
} from 'lucide-react';
import ExportDropdown from '@/components/ExportDropdown';
import type { ExportConfig } from '@/lib/export-utils';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  photo_url: string | null;
  status: string;
  agency: string | null;
  team_lead_count: number;
  scrub_top_size: string | null;
  scrub_bottom_size: string | null;
  cohort?: {
    id: string;
    cohort_number: number;
    program: { abbreviation: string };
  };
}

interface Cohort {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  graduated: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  withdrawn: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  on_hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
};

export default function StudentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCohort, setSelectedCohort] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('active');
  const [studentFlags, setStudentFlags] = useState<Record<string, 'yellow' | 'red'>>({});

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchCohorts();
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchStudents();
    }
  }, [session, selectedCohort, selectedStatus]);

  const fetchCohorts = async () => {
    try {
      const res = await fetch('/api/lab-management/cohorts');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts);
      }
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCohort) params.append('cohortId', selectedCohort);
      if (selectedStatus) params.append('status', selectedStatus);

      const res = await fetch(`/api/lab-management/students?${params}`);
      const data = await res.json();
      if (data.success) {
        setStudents(data.students);
        // Fetch flag summary for loaded students
        if (data.students.length > 0) {
          fetchStudentFlags(data.students.map((s: Student) => s.id));
        } else {
          setStudentFlags({});
        }
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
    setLoading(false);
  };

  const fetchStudentFlags = async (studentIds: string[]) => {
    try {
      const res = await fetch(
        `/api/lab-management/students/notes-summary?studentIds=${studentIds.join(',')}`
      );
      const data = await res.json();
      if (data.success) {
        setStudentFlags(data.flags || {});
      }
    } catch (error) {
      console.error('Error fetching student flags:', error);
    }
  };

  const filteredStudents = students.filter(student => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      student.first_name.toLowerCase().includes(search) ||
      student.last_name.toLowerCase().includes(search) ||
      student.email?.toLowerCase().includes(search) ||
      student.agency?.toLowerCase().includes(search)
    );
  });

  // Export configuration
  const selectedCohortDetails = cohorts.find(c => c.id === selectedCohort);
  const subtitle = selectedCohortDetails
    ? `${selectedCohortDetails.program.abbreviation} Group ${selectedCohortDetails.cohort_number}`
    : 'All Students';
  const exportConfig: ExportConfig = {
    title: 'Student Roster',
    subtitle: subtitle,
    filename: `student-roster-${subtitle.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}`,
    columns: [
      { key: 'last_name', label: 'Last Name', getValue: (row) => row.last_name },
      { key: 'first_name', label: 'First Name', getValue: (row) => row.first_name },
      { key: 'cohort', label: 'Cohort', getValue: (row) => row.cohort ? `${row.cohort.program.abbreviation} G${row.cohort.cohort_number}` : '' },
      { key: 'email', label: 'Email', getValue: (row) => row.email || '' },
      { key: 'status', label: 'Status', getValue: (row) => row.status },
      { key: 'agency', label: 'Agency', getValue: (row) => row.agency || '' },
      { key: 'scrub_top_size', label: 'Scrub Top', getValue: (row) => row.scrub_top_size || '' },
      { key: 'scrub_bottom_size', label: 'Scrub Bottom', getValue: (row) => row.scrub_bottom_size || '' }
    ],
    data: filteredStudents
  };

  if (status === 'loading') {
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
      <div className="bg-white shadow-sm dark:bg-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <span>Students</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Student Roster</h1>
            <div className="flex gap-2">
              <ExportDropdown config={exportConfig} disabled={filteredStudents.length === 0} />
              <Link
                href="/lab-management/students/import"
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Upload className="w-4 h-4" />
                Import
              </Link>
              <Link
                href="/lab-management/students/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Student
              </Link>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search by name, email, or agency..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              />
            </div>

            {/* Cohort Filter */}
            <select
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            >
              <option value="">All Cohorts</option>
              {cohorts.map(cohort => (
                <option key={cohort.id} value={cohort.id}>
                  {cohort.program.abbreviation} Group {cohort.cohort_number}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="graduated">Graduated</option>
              <option value="withdrawn">Withdrawn</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>
        </div>

        {/* Students Grid */}
        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading students...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No students found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {searchTerm ? 'Try adjusting your search or filters.' : 'Add your first student to get started.'}
            </p>
            <Link
              href="/lab-management/students/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Student
            </Link>
          </div>
        ) : (
          <>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Showing {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredStudents.map(student => (
                <Link
                  key={student.id}
                  href={`/lab-management/students/${student.id}`}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-4"
                >
                  <div className="flex items-start gap-3">
                    {/* Photo */}
                    <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden shrink-0">
                      {student.photo_url ? (
                        <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg font-medium text-gray-500 dark:text-gray-400">
                          {student.first_name[0]}{student.last_name[0]}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {student.first_name} {student.last_name}
                        </div>
                        {studentFlags[student.id] === 'red' && (
                          <span title="Red flag" className="shrink-0 w-2 h-2 rounded-full bg-red-500" />
                        )}
                        {studentFlags[student.id] === 'yellow' && (
                          <span title="Yellow flag" className="shrink-0 w-2 h-2 rounded-full bg-yellow-400" />
                        )}
                      </div>
                      {student.cohort && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {student.cohort.program.abbreviation} G{student.cohort.cohort_number}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[student.status]}`}>
                          {student.status}
                        </span>
                        {student.team_lead_count > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-xs text-yellow-600 dark:text-yellow-400">
                            <Star className="w-3 h-3" />
                            {student.team_lead_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
