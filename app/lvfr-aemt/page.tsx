'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useEffectiveRole } from '@/hooks/useEffectiveRole';
import { canEditLVFR } from '@/lib/permissions';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import {
  Calendar, Users, BarChart3, Award, BookOpen,
  AlertTriangle, CheckCircle2, TrendingUp,
  ChevronRight, Shield, ClipboardCheck, FolderOpen,
} from 'lucide-react';

interface DashboardData {
  courseProgress: {
    completedChapters: number;
    totalChapters: number;
    completedDays: number;
    totalDays: number;
    paceStatus: 'on_track' | 'slightly_behind' | 'behind';
  };
  coverageAlerts: {
    totalGaps: number;
    nextGapDay: number | null;
    nextGapDate: string | null;
  };
  studentStats: {
    totalStudents: number;
    avgGrade: number | null;
    skillsCompletionRate: number | null;
    atRiskCount: number;
  };
  recentGrades: Array<{
    assessment_id: string;
    title: string;
    date_taken: string;
    score_percent: number;
    passed: boolean;
  }>;
  upcomingAssessments: Array<{
    id: string;
    title: string;
    date: string;
    category: string;
  }>;
}

export default function LVFRDashboardPage() {
  const { data: session } = useSession();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const effectiveRole = useEffectiveRole(userRole);

  useEffect(() => {
    if (!session?.user?.email) return;

    // Fetch role
    fetch('/api/instructor/me')
      .then(res => res.json())
      .then(d => {
        if (d.success) setUserRole(d.user.role);
      })
      .catch(() => {});

    // Fetch dashboard data
    fetch('/api/lvfr-aemt/dashboard')
      .then(res => res.json())
      .then(d => {
        if (d.success) setData(d.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session?.user?.email]);

  const isInstructor = canEditLVFR(effectiveRole || '');
  const isObserver = effectiveRole === 'agency_observer' || effectiveRole === 'agency_liaison';
  const isStudent = effectiveRole === 'student';

  // Nav links based on role
  const navLinks = isStudent
    ? [
        { href: '/lvfr-aemt/calendar', icon: Calendar, label: 'Calendar', description: 'Course schedule and upcoming classes', color: 'bg-blue-600' },
        { href: '/lvfr-aemt/grades', icon: BarChart3, label: 'My Grades', description: 'View your grades and assessment scores', color: 'bg-purple-600' },
        { href: '/lvfr-aemt/skills', icon: ClipboardCheck, label: 'My Skills', description: 'Track your psychomotor skill competencies', color: 'bg-teal-600' },
        { href: '/lvfr-aemt/files', icon: FolderOpen, label: 'Course Materials', description: 'PowerPoints, handouts, and study resources', color: 'bg-indigo-600' },
        { href: '/lvfr-aemt/pharm', icon: Award, label: 'Pharm Checkpoints', description: 'Medication card practice and testing', color: 'bg-red-600' },
      ]
    : [
        { href: '/lvfr-aemt/calendar', icon: Calendar, label: 'Course Calendar', description: 'View and manage the 30-day course schedule', color: 'bg-blue-600' },
        ...(isInstructor ? [{ href: '/lvfr-aemt/scheduling', icon: Users, label: 'Coverage Grid', description: 'Instructor scheduling and coverage analysis', color: 'bg-amber-600' }] : []),
        { href: '/lvfr-aemt/grades', icon: BarChart3, label: 'Gradebook', description: 'Student grades, assessments, and CSV import', color: 'bg-purple-600' },
        { href: '/lvfr-aemt/skills', icon: ClipboardCheck, label: 'Skills Tracking', description: 'Psychomotor skill competencies and matrix', color: 'bg-teal-600' },
        { href: '/lvfr-aemt/files', icon: FolderOpen, label: 'Course Materials', description: 'Upload and manage course content files', color: 'bg-indigo-600' },
        { href: '/lvfr-aemt/pharm', icon: Award, label: 'Pharmacology', description: 'Medication checkpoint cards and scoring', color: 'bg-red-600' },
      ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-700 to-red-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Breadcrumbs className="mb-3 [&_*]:!text-red-200 [&_a:hover]:!text-white" />
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">LVFR AEMT Program</h1>
                  <p className="text-red-200 text-sm mt-0.5">
                    Las Vegas Fire & Rescue — Advanced EMT Training
                    {isObserver && ' (Observer View)'}
                  </p>
                </div>
              </div>
            </div>
            {isInstructor && (
              <Link
                href="/lvfr-aemt/scheduling"
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
              >
                <Users className="w-4 h-4" />
                Coverage Grid
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Quick Stats */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2" />
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16" />
              </div>
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={BookOpen}
              label="Course Progress"
              value={`${data.courseProgress.completedChapters}/${data.courseProgress.totalChapters}`}
              sublabel="chapters completed"
              color="text-blue-600"
              bgColor="bg-blue-50 dark:bg-blue-900/20"
            />
            <StatCard
              icon={Calendar}
              label="Days Completed"
              value={`${data.courseProgress.completedDays}/${data.courseProgress.totalDays}`}
              sublabel="course days"
              color="text-green-600"
              bgColor="bg-green-50 dark:bg-green-900/20"
            />
            {!isStudent && (
              <StatCard
                icon={Users}
                label="Students"
                value={String(data.studentStats.totalStudents)}
                sublabel={data.studentStats.atRiskCount > 0 ? `${data.studentStats.atRiskCount} at risk` : 'all on track'}
                color={data.studentStats.atRiskCount > 0 ? 'text-amber-600' : 'text-green-600'}
                bgColor={data.studentStats.atRiskCount > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-green-50 dark:bg-green-900/20'}
              />
            )}
            {!isStudent && (
              <StatCard
                icon={BarChart3}
                label="Avg Grade"
                value={data.studentStats.avgGrade != null ? `${Math.round(data.studentStats.avgGrade)}%` : '—'}
                sublabel="class average"
                color="text-purple-600"
                bgColor="bg-purple-50 dark:bg-purple-900/20"
              />
            )}
            {isStudent && (
              <>
                <StatCard
                  icon={Award}
                  label="Pharm Checkpoints"
                  value="—"
                  sublabel="completed"
                  color="text-red-600"
                  bgColor="bg-red-50 dark:bg-red-900/20"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Pace"
                  value={data.courseProgress.paceStatus === 'on_track' ? '✓' : '!'}
                  sublabel={data.courseProgress.paceStatus.replace('_', ' ')}
                  color={data.courseProgress.paceStatus === 'on_track' ? 'text-green-600' : 'text-amber-600'}
                  bgColor={data.courseProgress.paceStatus === 'on_track' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}
                />
              </>
            )}
          </div>
        ) : null}

        {/* Pace Indicator (instructor/observer) */}
        {data && !isStudent && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Course Pace</h3>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                data.courseProgress.paceStatus === 'on_track'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : data.courseProgress.paceStatus === 'slightly_behind'
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {data.courseProgress.paceStatus === 'on_track' ? 'On Track' :
                 data.courseProgress.paceStatus === 'slightly_behind' ? 'Slightly Behind' : 'Behind'}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  data.courseProgress.paceStatus === 'on_track'
                    ? 'bg-green-500'
                    : data.courseProgress.paceStatus === 'slightly_behind'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                }`}
                style={{ width: `${data.courseProgress.totalChapters > 0 ? Math.round((data.courseProgress.completedChapters / data.courseProgress.totalChapters) * 100) : 0}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {data.courseProgress.completedChapters} of {data.courseProgress.totalChapters} chapters completed
              {data.coverageAlerts.totalGaps > 0 && !isObserver && (
                <span className="text-amber-600 dark:text-amber-400 ml-2">
                  • {data.coverageAlerts.totalGaps} coverage gap{data.coverageAlerts.totalGaps !== 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
        )}

        {/* Coverage Alerts (instructor only) */}
        {data && isInstructor && data.coverageAlerts.totalGaps > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Coverage Gaps</h3>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
                  {data.coverageAlerts.totalGaps} day{data.coverageAlerts.totalGaps !== 1 ? 's' : ''} with insufficient instructor coverage.
                  {data.coverageAlerts.nextGapDay && (
                    <> Next gap: Day {data.coverageAlerts.nextGapDay}{data.coverageAlerts.nextGapDate ? ` (${data.coverageAlerts.nextGapDate})` : ''}.</>
                  )}
                </p>
              </div>
              <Link
                href="/lvfr-aemt/scheduling"
                className="text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline whitespace-nowrap"
              >
                View Grid →
              </Link>
            </div>
          </div>
        )}

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow p-5 flex items-start gap-4 group"
            >
              <div className={`p-3 rounded-lg ${link.color} text-white flex-shrink-0`}>
                <link.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                  {link.label}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  {link.description}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors flex-shrink-0 mt-1" />
            </Link>
          ))}
        </div>

        {/* Recent Activity / Upcoming for instructors and observers */}
        {data && !isStudent && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upcoming Assessments */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">Upcoming Assessments</h3>
                <Link href="/lvfr-aemt/calendar" className="text-xs text-red-600 dark:text-red-400 hover:underline">View All</Link>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.upcomingAssessments.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">No upcoming assessments</p>
                ) : (
                  data.upcomingAssessments.slice(0, 5).map(a => (
                    <div key={a.id} className="px-4 py-3 flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        a.category === 'exam' ? 'bg-red-500' : a.category === 'quiz' ? 'bg-purple-500' : 'bg-blue-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{a.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{a.date}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        a.category === 'exam'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      }`}>
                        {a.category}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Grades */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">Recent Grades</h3>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.recentGrades.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">No grades recorded yet</p>
                ) : (
                  data.recentGrades.slice(0, 5).map(g => (
                    <div key={g.assessment_id} className="px-4 py-3 flex items-center gap-3">
                      {g.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{g.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{g.date_taken}</p>
                      </div>
                      <span className={`text-sm font-semibold ${g.passed ? 'text-green-600' : 'text-red-600'}`}>
                        {Math.round(g.score_percent)}%
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sublabel, color, bgColor }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sublabel: string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex items-center gap-2 mb-1">
        <div className={`p-1.5 rounded ${bgColor}`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sublabel}</p>
    </div>
  );
}
