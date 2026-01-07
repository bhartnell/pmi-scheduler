'use client';

export const dynamic = 'force-dynamic';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ChevronRight,
  AlertCircle,
  Star,
  TrendingUp,
  Users,
  BarChart3
} from 'lucide-react';

interface StudentWithTL {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  team_lead_count: number;
  last_team_lead_date: string | null;
}

interface Stats {
  totalLeads: number;
  avgLeads: number;
  minLeads: number;
  maxLeads: number;
  studentsCount: number;
  studentsNeedingTL: number;
}

interface Cohort {
  id: string;
  cohort_number: number;
  program: {
    abbreviation: string;
  };
}

export default function TeamLeadReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cohortIdParam = searchParams.get('cohortId');

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState(cohortIdParam || '');
  const [students, setStudents] = useState<StudentWithTL[]>([]);
  const [needingTL, setNeedingTL] = useState<StudentWithTL[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

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
    if (session && selectedCohort) {
      fetchTeamLeadData();
    }
  }, [session, selectedCohort]);

  const fetchCohorts = async () => {
    try {
      const res = await fetch('/api/lab-management/cohorts');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts);
        // Auto-select first cohort if none selected
        if (!selectedCohort && data.cohorts.length > 0) {
          setSelectedCohort(data.cohorts[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
    setLoading(false);
  };

  const fetchTeamLeadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lab-management/team-leads?cohortId=${selectedCohort}`);
      const data = await res.json();
      
      if (data.success) {
        setStudents(data.students);
        setNeedingTL(data.needingTL);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching team lead data:', error);
    }
    setLoading(false);
  };

  const selectedCohortData = cohorts.find(c => c.id === selectedCohort);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading...</p>
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
                <Link href="/lab-management/reports" className="hover:text-blue-600">Reports</Link>
                <ChevronRight className="w-4 h-4" />
                <span>Team Lead Distribution</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Team Lead Distribution</h1>
            </div>
            <select
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
              className="px-4 py-2 border rounded-lg text-gray-900 bg-white font-medium"
            >
              <option value="">Select Cohort</option>
              {cohorts.map(cohort => (
                <option key={cohort.id} value={cohort.id}>
                  {cohort.program.abbreviation} Group {cohort.cohort_number}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!selectedCohort ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Cohort</h3>
            <p className="text-gray-600">Choose a cohort to view team lead distribution</p>
          </div>
        ) : loading ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-700">Loading data...</p>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <Star className="w-4 h-4" />
                    <span className="text-sm">Total TL Assignments</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{stats.totalLeads}</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm">Average per Student</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{stats.avgLeads}</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">Students</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{stats.studentsCount}</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center gap-2 text-orange-600 mb-1">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">Need More TL</span>
                  </div>
                  <div className="text-2xl font-bold text-orange-600">{stats.studentsNeedingTL}</div>
                </div>
              </div>
            )}

            {/* Alert for students needing TL */}
            {needingTL.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-orange-800">Students Below Average</h3>
                    <p className="text-sm text-orange-700 mt-1">
                      The following students have fewer team lead assignments than average and should be prioritized:
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {needingTL.map(student => (
                        <span 
                          key={student.id}
                          className="px-2 py-1 bg-orange-100 text-orange-800 text-sm rounded"
                        >
                          {student.first_name} {student.last_name} ({student.team_lead_count})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Student List */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h2 className="font-semibold text-gray-900">
                  {selectedCohortData?.program.abbreviation} Group {selectedCohortData?.cohort_number} - All Students
                </h2>
              </div>
              
              {students.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No students in this cohort</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Student
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          TL Count
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last TL Date
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Distribution
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {students
                        .sort((a, b) => a.team_lead_count - b.team_lead_count)
                        .map((student) => {
                          const isBelowAverage = stats && student.team_lead_count < stats.avgLeads;
                          const barWidth = stats && stats.maxLeads > 0 
                            ? (student.team_lead_count / stats.maxLeads) * 100 
                            : 0;
                          
                          return (
                            <tr key={student.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  {student.photo_url ? (
                                    <img
                                      src={student.photo_url}
                                      alt=""
                                      className="w-10 h-10 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                      <span className="text-sm font-bold text-gray-400">
                                        {student.first_name[0]}{student.last_name[0]}
                                      </span>
                                    </div>
                                  )}
                                  <div>
                                    <div className="font-medium text-gray-900">
                                      {student.first_name} {student.last_name}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                                  isBelowAverage
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {student.team_lead_count}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center text-sm text-gray-600">
                                {student.last_team_lead_date 
                                  ? new Date(student.last_team_lead_date).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric'
                                    })
                                  : '—'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {isBelowAverage ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">
                                    <AlertCircle className="w-3 h-3" />
                                    Below Avg
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                    <Star className="w-3 h-3" />
                                    On Track
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full transition-all ${
                                      isBelowAverage ? 'bg-orange-500' : 'bg-green-500'
                                    }`}
                                    style={{ width: `${barWidth}%` }}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
