'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Search, 
  Plus, 
  Users,
  ChevronRight,
  Upload,
  Camera,
  Star,
  Filter,
  X
} from 'lucide-react';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  photo_url: string | null;
  status: string;
  agency: string | null;
  team_lead_count: number;
  last_team_lead_date: string | null;
  cohort?: {
    id: string;
    cohort_number: number;
    program: {
      abbreviation: string;
    };
  };
}

interface Cohort {
  id: string;
  cohort_number: number;
  student_count: number;
  program: {
    name: string;
    abbreviation: string;
  };
}

export default function StudentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cohortIdParam = searchParams.get('cohortId');

  const [students, setStudents] = useState<Student[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCohort, setSelectedCohort] = useState(cohortIdParam || '');
  const [statusFilter, setStatusFilter] = useState('active');

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
  }, [session, selectedCohort, statusFilter]);

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
      if (statusFilter) params.append('status', statusFilter);

      const res = await fetch(`/api/lab-management/students?${params}`);
      const data = await res.json();
      if (data.success) {
        setStudents(data.students);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
    setLoading(false);
  };

  const filteredStudents = students.filter(s => 
    search === '' || 
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  // Group students by cohort if no cohort filter
  const groupedStudents = !selectedCohort 
    ? filteredStudents.reduce((acc, student) => {
        const key = student.cohort?.id || 'no-cohort';
        if (!acc[key]) {
          acc[key] = {
            cohort: student.cohort,
            students: []
          };
        }
        acc[key].students.push(student);
        return acc;
      }, {} as Record<string, { cohort: any; students: Student[] }>)
    : null;

  const selectedCohortData = cohorts.find(c => c.id === selectedCohort);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading students...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <Link href="/lab-management" className="hover:text-blue-600">Lab Management</Link>
                <ChevronRight className="w-4 h-4" />
                <span>Students</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                {selectedCohortData 
                  ? `${selectedCohortData.program.abbreviation} Group ${selectedCohortData.cohort_number}`
                  : 'All Students'}
              </h1>
            </div>
            <div className="flex gap-2">
              <Link
                href="/lab-management/students/import"
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                <Upload className="w-5 h-5" />
                Import
              </Link>
              <Link
                href="/lab-management/students/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                <Plus className="w-5 h-5" />
                Add Student
              </Link>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search students..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-gray-900 bg-white"
              />
            </div>
            <select
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
              className="px-3 py-2 border rounded-lg text-gray-900 bg-white"
            >
              <option value="">All Cohorts</option>
              {cohorts.map(cohort => (
                <option key={cohort.id} value={cohort.id}>
                  {cohort.program.abbreviation} Group {cohort.cohort_number} ({cohort.student_count})
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-gray-900 bg-white"
            >
              <option value="active">Active</option>
              <option value="graduated">Graduated</option>
              <option value="withdrawn">Withdrawn</option>
              <option value="on_hold">On Hold</option>
              <option value="">All Statuses</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="mb-4 text-sm text-gray-600">
          {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
        </div>

        {/* Students List */}
        {filteredStudents.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No students found</h3>
            <p className="text-gray-600 mb-4">
              {selectedCohort 
                ? 'Add students to this cohort or import from a file'
                : 'Get started by adding students'}
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                href="/lab-management/students/import"
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <Upload className="w-5 h-5" />
                Import Students
              </Link>
              <Link
                href="/lab-management/students/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-5 h-5" />
                Add Student
              </Link>
            </div>
          </div>
        ) : selectedCohort ? (
          // Single cohort view - grid of student cards
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredStudents.map((student) => (
              <Link
                key={student.id}
                href={`/lab-management/students/${student.id}`}
                className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow text-center"
              >
                <div className="relative mx-auto w-20 h-20 mb-3">
                  {student.photo_url ? (
                    <img
                      src={student.photo_url}
                      alt={`${student.first_name} ${student.last_name}`}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-2xl font-bold text-gray-400">
                        {student.first_name[0]}{student.last_name[0]}
                      </span>
                    </div>
                  )}
                  {student.team_lead_count > 0 && (
                    <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                      {student.team_lead_count}
                    </div>
                  )}
                </div>
                <div className="font-medium text-gray-900 truncate">
                  {student.first_name} {student.last_name}
                </div>
                {student.agency && (
                  <div className="text-xs text-gray-500 truncate">{student.agency}</div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          // All students view - grouped by cohort
          <div className="space-y-6">
            {Object.entries(groupedStudents || {}).map(([key, group]) => (
              <div key={key} className="bg-white rounded-lg shadow">
                <div className="p-4 border-b flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">
                    {group.cohort 
                      ? `${group.cohort.program.abbreviation} Group ${group.cohort.cohort_number}`
                      : 'No Cohort Assigned'}
                  </h2>
                  <span className="text-sm text-gray-600">{group.students.length} students</span>
                </div>
                <div className="divide-y">
                  {group.students.map((student) => (
                    <Link
                      key={student.id}
                      href={`/lab-management/students/${student.id}`}
                      className="p-4 flex items-center gap-4 hover:bg-gray-50"
                    >
                      <div className="relative">
                        {student.photo_url ? (
                          <img
                            src={student.photo_url}
                            alt={`${student.first_name} ${student.last_name}`}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-lg font-bold text-gray-400">
                              {student.first_name[0]}{student.last_name[0]}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900">
                          {student.first_name} {student.last_name}
                        </div>
                        <div className="text-sm text-gray-600 truncate">
                          {student.email || student.agency || 'No email'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {student.team_lead_count > 0 && (
                          <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                            <Star className="w-3 h-3" />
                            {student.team_lead_count} TL
                          </span>
                        )}
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
