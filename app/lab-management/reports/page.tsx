'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ChevronRight,
  BarChart3,
  Star,
  Users,
  TrendingUp,
  FileText,
  Calendar,
  Download
} from 'lucide-react';

interface Cohort {
  id: string;
  cohort_number: number;
  student_count: number;
  program: { abbreviation: string };
}

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState('');
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

  const fetchCohorts = async () => {
    try {
      const res = await fetch('/api/lab-management/cohorts');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts);
        if (data.cohorts.length > 0) {
          setSelectedCohort(data.cohorts[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
    setLoading(false);
  };

  const reports = [
    {
      title: 'Team Lead Distribution',
      description: 'Track team lead assignments across students to ensure equal opportunities',
      href: `/lab-management/reports/team-leads${selectedCohort ? `?cohortId=${selectedCohort}` : ''}`,
      icon: Star,
      color: 'bg-yellow-100 text-yellow-600',
      available: true,
    },
    {
      title: 'Student Performance',
      description: 'View assessment scores and progress for individual students',
      href: '/lab-management/reports/performance',
      icon: TrendingUp,
      color: 'bg-green-100 text-green-600',
      available: false,
    },
    {
      title: 'Cohort Overview',
      description: 'Summary statistics for entire cohorts including completion rates',
      href: '/lab-management/reports/cohort',
      icon: Users,
      color: 'bg-blue-100 text-blue-600',
      available: false,
    },
    {
      title: 'Scenario Usage',
      description: 'Track which scenarios have been used and when',
      href: '/lab-management/reports/scenarios',
      icon: FileText,
      color: 'bg-purple-100 text-purple-600',
      available: false,
    },
    {
      title: 'Lab Schedule History',
      description: 'Historical view of all lab days and assessments',
      href: '/lab-management/reports/schedule-history',
      icon: Calendar,
      color: 'bg-orange-100 text-orange-600',
      available: false,
    },
  ];

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  const selectedCohortData = cohorts.find(c => c.id === selectedCohort);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <Link href="/lab-management" className="hover:text-blue-600">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <span>Reports</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
                <p className="text-gray-600">Analytics and insights for your program</p>
              </div>
            </div>
            <select
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
              className="px-3 py-2 border rounded-lg text-gray-900 bg-white"
            >
              <option value="">All Cohorts</option>
              {cohorts.map(cohort => (
                <option key={cohort.id} value={cohort.id}>
                  {cohort.program.abbreviation} Group {cohort.cohort_number}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Quick Stats */}
        {selectedCohortData && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              Quick Stats: {selectedCohortData.program.abbreviation} Group {selectedCohortData.cohort_number}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{selectedCohortData.student_count}</div>
                <div className="text-sm text-gray-600">Students</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">—</div>
                <div className="text-sm text-gray-600">Lab Days</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">—</div>
                <div className="text-sm text-gray-600">Assessments</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">—</div>
                <div className="text-sm text-gray-600">Avg Score</div>
              </div>
            </div>
          </div>
        )}

        {/* Report Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((report) => (
            <Link
              key={report.title}
              href={report.available ? report.href : '#'}
              className={`bg-white rounded-lg shadow p-6 transition-shadow ${
                report.available ? 'hover:shadow-lg' : 'opacity-60 cursor-not-allowed'
              }`}
              onClick={report.available ? undefined : (e) => e.preventDefault()}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${report.color}`}>
                  <report.icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-gray-900">{report.title}</h2>
                    {!report.available && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
              </div>
            </Link>
          ))}
        </div>

        {/* Export Section */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <Download className="w-5 h-5 text-gray-600" />
            <h2 className="font-semibold text-gray-900">Export Data</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Export your data for external analysis or backup purposes.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              disabled
              className="px-4 py-2 border rounded-lg text-gray-400 cursor-not-allowed"
            >
              Export Students (CSV)
            </button>
            <button
              disabled
              className="px-4 py-2 border rounded-lg text-gray-400 cursor-not-allowed"
            >
              Export Assessments (CSV)
            </button>
            <button
              disabled
              className="px-4 py-2 border rounded-lg text-gray-400 cursor-not-allowed"
            >
              Export Full Report (PDF)
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">Export functionality coming soon</p>
        </div>
      </main>
    </div>
  );
}
