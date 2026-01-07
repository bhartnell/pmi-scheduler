'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { 
  ChevronRight,
  Star,
  AlertCircle,
  Users,
  TrendingDown
} from 'lucide-react';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  team_lead_count: number;
  last_team_lead_date: string | null;
}

interface Cohort {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

function TeamLeadsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cohortIdParam = searchParams.get('cohortId');

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState(cohortIdParam || '');
  const [stats, setStats] = useState<Student[]>([]);
  const [averageTL, setAverageTL] = useState(0);
  const [needingTL, setNeedingTL] = useState<Student[]>([]);
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
      fetchTeamLeadStats();
    }
  }, [session, selectedCohort]);

  const fetchCohorts = async () => {
    try {
      const res = await fetch('/api/lab-management/cohorts');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts);
        if (data.cohorts.length > 0 && !selectedCohort) {
          setSelectedCohort(data.cohorts[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
  };

  const fetchTeamLeadStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lab-management/team-leads?cohortId=${selectedCohort}`);
      const data = await res.json();
      if (data.success) {
        setStats(data.stats || []);
        setAverageTL(data.averageTL || 0);
        setNeedingTL(data.needingTL || []);
      }
    } catch (error) {
      console.error('Error fetching team lead stats:', error);
    }
    setLoading(false);
  };

  const selectedCohortData = cohorts.find(c => c.id === selectedCohort);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <Link href="/lab-management" className="hover:text-blue-600">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/reports" className="hover:text-blue-600">Reports</Link>
            <ChevronRight className="w-4 h-4" />
            <span>Team Lead Distribution</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900">Team Lead Distribution</h1>
            <select
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
              className="px-3 py-2 border rounded-lg text-gray-900 bg-white"
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

      <main className="max-w-5xl mx-auto px-4 py-6">
        {!selectedCohort ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">Select a cohort to view team lead distribution</p>
          </div>
        ) : loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading stats...</p>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-600">Total Students</div>
                <div className="text-2xl font-bold text-gray-900">{stats.length}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-600">Average TL Count</div>
                <div className="text-2xl font-bold text-gray-900">{averageTL}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-600">Total TL Assignments</div>
                <div className="text-2xl font-bold text-gray-900">
                  {stats.reduce((sum, s) => sum + s.team_lead_count, 0)}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-sm text-gray-600">Need More TL</div>
                <div className="text-2xl font-bold text-orange-600">{needingTL.length}</div>
              </div>
            </div>

            {/* Alert for students needing TL */}
            {needingTL.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-orange-800">Students Below Average</h3>
                    <p className="text-sm text-orange-700 mt-1">
                      {needingTL.length} student{needingTL.length !== 1 ? 's need' : ' needs'} more team lead opportunities:
                      {' '}{needingTL.slice(0, 5).map(s => `${s.first_name} ${s.last_name}`).join(', ')}
                      {needingTL.length > 5 && ` and ${needingTL.length - 5} more`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Student List */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="font-semibold text-gray-900">All Students</h2>
              </div>
              {stats.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No students in this cohort
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">TL Count</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last TL Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {stats
                        .sort((a, b) => a.team_lead_count - b.team_lead_count)
                        .map(student => {
                          const belowAvg = student.team_lead_count < averageTL;
                          return (
                            <tr key={student.id} className={belowAvg ? 'bg-orange-50' : ''}>
                              <td className="px-4 py-3">
                                <Link 
                                  href={`/lab-management/students/${student.id}`}
                                  className="font-medium text-gray-900 hover:text-blue-600"
                                >
                                  {student.first_name} {student.last_name}
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${
                                  belowAvg ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                                }`}>
                                  <Star className="w-4 h-4" />
                                  {student.team_lead_count}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {student.last_team_lead_date 
                                  ? new Date(student.last_team_lead_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                  : '—'}
                              </td>
                              <td className="px-4 py-3">
                                {belowAvg ? (
                                  <span className="inline-flex items-center gap-1 text-sm text-orange-600">
                                    <TrendingDown className="w-4 h-4" />
                                    Below avg
                                  </span>
                                ) : (
                                  <span className="text-sm text-green-600">On track</span>
                                )}
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

export default function TeamLeadsReportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <TeamLeadsContent />
    </Suspense>
  );
}
