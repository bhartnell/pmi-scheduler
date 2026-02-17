'use client';

/**
 * Student Dashboard
 *
 * Main landing page for students showing their progress overview.
 * Fetches real data from the student API endpoints.
 */

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckSquare,
  Activity,
  BookOpen,
  FileText,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface StudentUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface StationStatus {
  id: string;
  station_code: string;
  station_name: string;
  category: string;
  status: 'pass' | 'needs_review' | 'incomplete' | 'not_started';
  completed_at: string | null;
}

interface CompletionSummary {
  total_stations: number;
  completed: number;
  needs_review: number;
  not_started: number;
  completion_rate: number;
}

interface DashboardData {
  student: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  stations: StationStatus[];
  summary: CompletionSummary;
  message?: string;
}

export default function StudentDashboard() {
  const { data: session } = useSession();
  const [user, setUser] = useState<StudentUser | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.email) {
      fetchUserData();
    }
  }, [session]);

  const fetchUserData = async () => {
    try {
      // Fetch user info
      const userRes = await fetch('/api/instructor/me');
      const userData = await userRes.json();

      if (userData.success && userData.user) {
        setUser(userData.user);

        // Fetch student completions data
        const completionsRes = await fetch('/api/student/completions');
        const completionsData = await completionsRes.json();

        if (completionsData.success) {
          setDashboardData(completionsData);
        } else {
          // Set empty data structure
          setDashboardData({
            student: null,
            stations: [],
            summary: {
              total_stations: 0,
              completed: 0,
              needs_review: 0,
              not_started: 0,
              completion_rate: 0,
            },
            message: completionsData.message,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  if (!user) return null;

  // Get first name for greeting
  const firstName = dashboardData?.student?.first_name || user.name.split(' ')[0];
  const summary = dashboardData?.summary;
  const stations = dashboardData?.stations || [];

  // Separate stations by status
  const needsAttention = stations.filter(s => s.status === 'needs_review' || s.status === 'incomplete');
  const notStarted = stations.filter(s => s.status === 'not_started');
  const completed = stations.filter(s => s.status === 'pass');

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Welcome back, {firstName}!
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track your progress through the Paramedic Program
        </p>
      </div>

      {/* Message Banner (if student record not found) */}
      {dashboardData?.message && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-8">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-800 dark:text-amber-200">Note</h3>
              <p className="text-sm text-amber-700 dark:text-amber-300">{dashboardData.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={CheckSquare}
          label="Stations Completed"
          value={summary ? `${summary.completed}/${summary.total_stations}` : '--'}
          subtext={summary?.total_stations ? `${summary.completion_rate}% complete` : 'No stations yet'}
          color="cyan"
        />
        <StatCard
          icon={Activity}
          label="Needs Review"
          value={summary?.needs_review?.toString() || '0'}
          subtext={summary?.needs_review ? 'Stations to retry' : 'All clear!'}
          color="amber"
        />
        <StatCard
          icon={BookOpen}
          label="Not Started"
          value={summary?.not_started?.toString() || '0'}
          subtext={summary?.not_started ? 'Stations remaining' : 'All started!'}
          color="purple"
        />
        <StatCard
          icon={TrendingUp}
          label="Progress"
          value={summary ? `${summary.completion_rate}%` : '--'}
          subtext="Overall completion"
          color="green"
        />
      </div>

      {/* Content Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Needs Attention */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Needs Attention</h2>
            </div>
            <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full">
              {needsAttention.length} stations
            </span>
          </div>
          <div className="p-4">
            {needsAttention.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full mb-3">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No stations need attention - great job!
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {needsAttention.map(station => (
                  <StationRow key={station.id} station={station} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Station Progress */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Station Progress</h2>
            </div>
            <Link
              href="/student/completions"
              className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              View All →
            </Link>
          </div>
          <div className="p-4">
            {stations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full mb-3">
                  <Clock className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No station data available yet
                </p>
              </div>
            ) : (
              <>
                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Overall Progress</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {summary?.completion_rate || 0}%
                    </span>
                  </div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${summary?.completion_rate || 0}%` }}
                    />
                  </div>
                </div>

                {/* Recent completions */}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {completed.slice(0, 5).map(station => (
                    <StationRow key={station.id} station={station} />
                  ))}
                  {completed.length > 5 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                      +{completed.length - 5} more completed
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Not Started */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Not Started</h2>
            </div>
            <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-1 rounded-full">
              {notStarted.length} stations
            </span>
          </div>
          <div className="p-4">
            {notStarted.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full mb-3">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  You&apos;ve started all stations!
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {notStarted.map(station => (
                  <StationRow key={station.id} station={station} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Coming Soon - EKG & Scenarios */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">EKG & Scenarios</h2>
            </div>
            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-full">
              Coming Soon
            </span>
          </div>
          <div className="p-6">
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full mb-3">
                <TrendingUp className="w-6 h-6 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                EKG progress and scenario history coming soon
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Track your rhythm recognition scores and scenario roles
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtext: string;
  color: 'cyan' | 'green' | 'purple' | 'amber';
}) {
  const colors = {
    cyan: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</span>
      </div>
      <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{value}</div>
      <div className="text-sm text-gray-500 dark:text-gray-500">{subtext}</div>
    </div>
  );
}

// Station Row Component
function StationRow({ station }: { station: StationStatus }) {
  const statusConfig = {
    pass: {
      icon: CheckCircle,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-100 dark:bg-green-900/30',
      label: 'Passed',
    },
    needs_review: {
      icon: AlertCircle,
      color: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      label: 'Needs Review',
    },
    incomplete: {
      icon: XCircle,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-100 dark:bg-red-900/30',
      label: 'Incomplete',
    },
    not_started: {
      icon: Clock,
      color: 'text-gray-400 dark:text-gray-500',
      bg: 'bg-gray-100 dark:bg-gray-700',
      label: 'Not Started',
    },
  };

  const config = statusConfig[station.status];
  const StatusIcon = config.icon;

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <div className={`p-1.5 rounded ${config.bg}`}>
        <StatusIcon className={`w-4 h-4 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {station.station_name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {station.category}
        </p>
      </div>
      <span className={`text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    </div>
  );
}
