'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import {
  Trophy,
  Loader2,
  Download,
  ChevronDown,
} from 'lucide-react';
import Leaderboard from '@/components/cases/Leaderboard';
import { CASE_CATEGORIES } from '@/types/case-studies';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface CohortOption {
  id: string;
  name: string;
}

interface LeaderboardEntry {
  rank: number;
  student_id: string;
  initials: string;
  first_name: string;
  last_name: string;
  total_points: number;
  cases_completed: number;
  average_score: number;
  badges_earned: number;
}

type TimePeriod = 'all' | 'month' | 'week';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LeaderboardPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isInstructor, setIsInstructor] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [cohortId, setCohortId] = useState<string>('');
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [period, setPeriod] = useState<TimePeriod>('all');
  const [category, setCategory] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Fetch user info
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    if (!session?.user?.email) return;

    const fetchUserInfo = async () => {
      try {
        const res = await fetch('/api/instructor/me');
        const data = await res.json();
        if (data.success && data.user) {
          setUserInfo(data.user);
          const role = data.user.role;
          const instructorLevel = ['superadmin', 'admin', 'lead_instructor', 'instructor'].includes(role);
          setIsInstructor(instructorLevel);
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
      }
    };

    fetchUserInfo();
  }, [session, sessionStatus, router]);

  // Fetch cohorts for instructor, or student's cohort
  useEffect(() => {
    if (!userInfo) return;

    const fetchCohorts = async () => {
      try {
        if (isInstructor) {
          // Fetch all cohorts
          const res = await fetch('/api/admin/database-tools/cohorts');
          const data = await res.json();
          if (data.cohorts) {
            const cohortList = data.cohorts.map((c: { id: string; name: string }) => ({
              id: c.id,
              name: c.name,
            }));
            setCohorts(cohortList);
            if (cohortList.length > 0 && !cohortId) {
              setCohortId(cohortList[0].id);
            }
          }
        } else {
          // Student: fetch their own record to get cohort_id
          const res = await fetch('/api/student/me');
          const data = await res.json();
          if (data.student) {
            setStudentId(data.student.id);
            if (data.student.cohort_id) {
              setCohortId(data.student.cohort_id);
              setCohorts([{
                id: data.student.cohort_id,
                name: data.student.cohort?.name || 'My Cohort',
              }]);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching cohorts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCohorts();
  }, [userInfo, isInstructor]);

  // Export CSV handler (instructor only)
  const handleExportCSV = useCallback(async () => {
    if (!cohortId || exporting) return;

    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (period) params.set('period', period);
      if (category) params.set('category', category);

      const res = await fetch(`/api/cases/leaderboard/${cohortId}?${params.toString()}`);
      const data = await res.json();

      if (!data.leaderboard || data.leaderboard.length === 0) {
        return;
      }

      // Build CSV
      const headers = ['Rank', 'First Name', 'Last Name', 'Initials', 'Total Points', 'Cases Completed', 'Average Score', 'Badges Earned'];
      const rows = data.leaderboard.map((entry: LeaderboardEntry) => [
        entry.rank,
        entry.first_name,
        entry.last_name,
        entry.initials,
        entry.total_points,
        entry.cases_completed,
        entry.average_score,
        entry.badges_earned,
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row: (string | number)[]) =>
          row.map((cell: string | number) => {
            const str = String(cell);
            // Escape commas and quotes in CSV
            if (str.includes(',') || str.includes('"')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          }).join(',')
        ),
      ].join('\n');

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cohortName = cohorts.find((c) => c.id === cohortId)?.name || 'cohort';
      link.download = `leaderboard-${cohortName.replace(/\s+/g, '-').toLowerCase()}-${period}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting CSV:', error);
    } finally {
      setExporting(false);
    }
  }, [cohortId, period, category, cohorts, exporting]);

  // Loading state
  if (sessionStatus === 'loading' || loading || !userInfo) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // No cohort
  if (!cohortId) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-20">
          <Trophy className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-1">
            No cohort found
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isInstructor
              ? 'No cohorts are available. Create a cohort first to view the leaderboard.'
              : 'You are not assigned to a cohort yet. Contact your instructor.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Trophy className="h-7 w-7 text-yellow-500" />
            Case Study Leaderboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isInstructor
              ? 'Track student performance and engagement with case studies'
              : 'See how you rank among your classmates'}
          </p>
        </div>

        {isInstructor && (
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Cohort selector (instructor only) */}
        {isInstructor && cohorts.length > 1 && (
          <div className="relative">
            <select
              value={cohortId}
              onChange={(e) => setCohortId(e.target.value)}
              className="appearance-none w-full sm:w-56 pl-3 pr-8 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        )}

        {/* Time period buttons */}
        <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
          {([
            { value: 'all', label: 'All Time' },
            { value: 'month', label: 'This Month' },
            { value: 'week', label: 'This Week' },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                period === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <div className="relative">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="appearance-none w-full sm:w-44 pl-3 pr-8 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Categories</option>
            {CASE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Leaderboard component */}
      <Leaderboard
        cohortId={cohortId}
        currentStudentId={studentId || undefined}
        period={period}
        category={category || undefined}
      />
    </div>
  );
}
