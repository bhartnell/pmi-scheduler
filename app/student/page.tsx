'use client';

/**
 * Student Dashboard
 *
 * Main landing page for students showing their progress overview.
 * Phase 1: Placeholder sections with "Coming Soon" indicators.
 */

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import {
  CheckSquare,
  Activity,
  BookOpen,
  FileText,
  TrendingUp,
  Clock,
  AlertCircle,
  Sparkles
} from 'lucide-react';

interface StudentUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface DashboardStats {
  stationsCompleted: number;
  stationsTotal: number;
  ekgLatestScore: number | null;
  scenariosParticipated: number;
  protocolsReviewed: number;
}

export default function StudentDashboard() {
  const { data: session } = useSession();
  const [user, setUser] = useState<StudentUser | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.email) {
      fetchUserData();
    }
  }, [session]);

  const fetchUserData = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        // TODO: Fetch actual stats from /api/student/dashboard
        // For now, show placeholder
        setStats({
          stationsCompleted: 0,
          stationsTotal: 0,
          ekgLatestScore: null,
          scenariosParticipated: 0,
          protocolsReviewed: 0,
        });
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
  const firstName = user.name.split(' ')[0];

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

      {/* Coming Soon Banner */}
      <div className="bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl p-6 mb-8 text-white">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white/20 rounded-lg">
            <Sparkles className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold mb-2">Student Portal Coming Soon!</h2>
            <p className="text-cyan-100 mb-4">
              We&apos;re building a comprehensive tracking system for your Semester 3 clinical preparation.
              Check back soon for station completion tracking, EKG progress, and more.
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-full text-sm">
                <CheckSquare className="w-4 h-4" />
                Station Tracking
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-full text-sm">
                <Activity className="w-4 h-4" />
                EKG Progress
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-full text-sm">
                <BookOpen className="w-4 h-4" />
                Scenario History
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview - Placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={CheckSquare}
          label="Stations Completed"
          value="--"
          subtext="Coming soon"
          color="cyan"
        />
        <StatCard
          icon={Activity}
          label="Latest EKG Score"
          value="--"
          subtext="Coming soon"
          color="green"
        />
        <StatCard
          icon={BookOpen}
          label="Scenarios"
          value="--"
          subtext="Coming soon"
          color="purple"
        />
        <StatCard
          icon={FileText}
          label="Protocols"
          value="--"
          subtext="Coming soon"
          color="amber"
        />
      </div>

      {/* Content Sections - Placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Station Progress */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Station Progress</h2>
            </div>
            <span className="text-xs bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 px-2 py-1 rounded-full">
              Coming Soon
            </span>
          </div>
          <div className="p-6">
            <PlaceholderContent
              icon={Clock}
              message="Station completion tracking will appear here"
            />
          </div>
        </div>

        {/* EKG Scores */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">EKG Progress</h2>
            </div>
            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full">
              Coming Soon
            </span>
          </div>
          <div className="p-6">
            <PlaceholderContent
              icon={TrendingUp}
              message="Your EKG warmup score history will appear here"
            />
          </div>
        </div>

        {/* Recent Scenarios */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Scenario History</h2>
            </div>
            <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-1 rounded-full">
              Coming Soon
            </span>
          </div>
          <div className="p-6">
            <PlaceholderContent
              icon={BookOpen}
              message="Your scenario participation history will appear here"
            />
          </div>
        </div>

        {/* Needs Attention */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h2 className="font-semibold text-gray-900 dark:text-white">Needs Attention</h2>
            </div>
            <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full">
              Coming Soon
            </span>
          </div>
          <div className="p-6">
            <PlaceholderContent
              icon={AlertCircle}
              message="Incomplete stations and areas needing attention will appear here"
            />
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

// Placeholder Content Component
function PlaceholderContent({
  icon: Icon,
  message,
}: {
  icon: React.ComponentType<{ className?: string }>;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full mb-3">
        <Icon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
}
