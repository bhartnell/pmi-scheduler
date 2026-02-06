'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Users,
  Calendar,
  Settings,
  Plus,
  Upload,
  Home,
  GraduationCap,
  Camera,
  Brain,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  Layout,
  UserPlus,
  Edit2
} from 'lucide-react';
import ExportDropdown from '@/components/ExportDropdown';
import FieldTripAttendance from '@/components/FieldTripAttendance';
import type { ExportConfig } from '@/lib/export-utils';

interface Cohort {
  id: string;
  cohort_number: number;
  start_date: string | null;
  expected_end_date: string | null;
  is_active: boolean;
  program: {
    id: string;
    name: string;
    abbreviation: string;
  };
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  agency: string | null;
  photo_url: string | null;
  status: string;
}

interface LearningStyle {
  student_id: string;
  primary_style: string;
  social_style: string;
}

interface Stats {
  totalStudents: number;
  withPhotos: number;
  withAgency: number;
  withLearningStyles: number;
  photosPercent: number;
  agencyPercent: number;
  learningStylesPercent: number;
  agencyBreakdown: { name: string; count: number }[];
  learningStyleBreakdown: { style: string; count: number }[];
  socialStyleBreakdown: { style: string; count: number }[];
  groupsCount: number;
  seatingChartsCount: number;
  activeSeatingChart: { id: string; name: string; created_at: string } | null;
  upcomingLabs: { id: string; date: string; title: string }[];
  nextLab: { id: string; date: string; title: string } | null;
}

const STYLE_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  audio: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', label: 'A' },
  visual: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: 'V' },
  kinesthetic: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', label: 'K' },
  social: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', label: 'S' },
  independent: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', label: 'I' },
};

function ProgressBar({ label, current, total, href }: { label: string; current: number; total: number; href?: string }) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  const barColor = percent === 100 ? 'bg-green-500' : percent >= 80 ? 'bg-blue-500' : percent >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">{current}/{total} ({percent}%)</span>
          {href && (
            <Link href={href} className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
              {percent < 100 ? 'Manage' : 'View All'}
            </Link>
          )}
        </div>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} transition-all duration-300`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function ToolCard({
  icon: Icon,
  title,
  status,
  warning,
  actionLabel,
  href,
  disabled
}: {
  icon: any;
  title: string;
  status: string;
  warning?: string | null;
  actionLabel: string;
  href?: string;
  disabled?: boolean;
}) {
  const content = (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 border dark:border-gray-700 ${disabled ? 'opacity-50' : 'hover:shadow-md transition-shadow'}`}>
      <div className="flex items-start gap-3">
        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{status}</p>
          {warning && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {warning}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 text-right">
        <span className={`text-sm font-medium ${disabled ? 'text-gray-400 dark:text-gray-500' : 'text-blue-600 dark:text-blue-400'}`}>
          {actionLabel} &rarr;
        </span>
      </div>
    </div>
  );

  if (disabled || !href) {
    return content;
  }

  return <Link href={href}>{content}</Link>;
}

export default function CohortHubPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const cohortId = params.id as string;

  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [learningStyles, setLearningStyles] = useState<LearningStyle[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session && cohortId) {
      fetchData();
    }
  }, [session, cohortId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch cohort details
      const cohortRes = await fetch(`/api/lab-management/cohorts/${cohortId}`);
      const cohortData = await cohortRes.json();
      if (cohortData.success) {
        setCohort(cohortData.cohort);
      }

      // Fetch students
      const studentsRes = await fetch(`/api/lab-management/students?cohortId=${cohortId}&status=active`);
      const studentsData = await studentsRes.json();
      if (studentsData.success) {
        setStudents(studentsData.students || []);
      }

      // Fetch learning styles
      const lsRes = await fetch(`/api/seating/learning-styles?cohortId=${cohortId}`);
      const lsData = await lsRes.json();
      if (lsData.success) {
        setLearningStyles(lsData.learningStyles?.map((ls: any) => ({
          student_id: ls.student_id,
          primary_style: ls.primary_style,
          social_style: ls.social_style,
        })) || []);
      }

      // Fetch cohort stats
      const statsRes = await fetch(`/api/lab-management/cohorts/${cohortId}/stats`);
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData.stats);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const getLearningStyle = (studentId: string) => {
    return learningStyles.find(ls => ls.student_id === studentId);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading cohort...</p>
        </div>
      </div>
    );
  }

  if (!session || !cohort) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Cohort Not Found</h2>
          <Link href="/lab-management/admin/cohorts" className="text-blue-600 dark:text-blue-400 hover:underline">
            Back to Cohorts
          </Link>
        </div>
      </div>
    );
  }

  const missingLearningStyles = (stats?.totalStudents || 0) - (stats?.withLearningStyles || 0);

  // Export configuration
  const cohortLabel = cohort ? `${cohort.program.abbreviation} Group ${cohort.cohort_number}` : '';
  const exportConfig: ExportConfig = {
    title: 'Student Roster',
    subtitle: cohortLabel,
    filename: `roster-${cohortLabel.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}`,
    columns: [
      { key: 'last_name', label: 'Last Name', getValue: (row) => row.last_name },
      { key: 'first_name', label: 'First Name', getValue: (row) => row.first_name },
      { key: 'email', label: 'Email', getValue: (row) => row.email || '' },
      { key: 'status', label: 'Status', getValue: (row) => row.status },
      { key: 'agency', label: 'Agency', getValue: (row) => row.agency || '' }
    ],
    data: students
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/admin/cohorts" className="hover:text-blue-600 dark:hover:text-blue-400">Cohorts</Link>
            <ChevronRight className="w-4 h-4" />
            <span>{cohort.program.abbreviation} Group {cohort.cohort_number}</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <GraduationCap className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {cohort.program.abbreviation} Group {cohort.cohort_number}
                </h1>
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${cohort.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'}`}>
                    {cohort.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {cohort.start_date && (
                    <span>Started: {new Date(cohort.start_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  )}
                  <span>{stats?.totalStudents || 0} students</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Link
                href={`/lab-management/students/new?cohortId=${cohortId}&returnTo=${encodeURIComponent(`/lab-management/cohorts/${cohortId}`)}`}
                className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 text-sm text-gray-700 dark:text-gray-200"
              >
                <UserPlus className="w-4 h-4" />
                Add Student
              </Link>
              <Link
                href={`/lab-management/students/import?cohortId=${cohortId}&returnTo=${encodeURIComponent(`/lab-management/cohorts/${cohortId}`)}`}
                className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 text-sm text-gray-700 dark:text-gray-200"
              >
                <Upload className="w-4 h-4" />
                Import
              </Link>
              <Link
                href={`/lab-management/admin/cohorts`}
                className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 text-sm text-gray-700 dark:text-gray-200"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </Link>
              <ExportDropdown config={exportConfig} disabled={students.length === 0} />
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Data Completion Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Data Completion
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ProgressBar
              label="Learning Styles"
              current={stats?.withLearningStyles || 0}
              total={stats?.totalStudents || 0}
              href={`/lab-management/seating/learning-styles?cohortId=${cohortId}`}
            />
            <ProgressBar
              label="Student Photos"
              current={stats?.withPhotos || 0}
              total={stats?.totalStudents || 0}
            />
            <ProgressBar
              label="Agency Info"
              current={stats?.withAgency || 0}
              total={stats?.totalStudents || 0}
            />
          </div>
        </div>

        {/* Cohort Tools Section */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            Cohort Tools
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ToolCard
              icon={Layout}
              title="Seating Chart"
              status={stats?.activeSeatingChart ? `Created ${new Date(stats.activeSeatingChart.created_at).toLocaleDateString()}` : 'Not created'}
              warning={missingLearningStyles > 0 ? `Need ${missingLearningStyles} more learning styles` : null}
              actionLabel={stats?.activeSeatingChart ? 'View Chart' : 'Create Chart'}
              href={`/lab-management/seating/charts?cohortId=${cohortId}`}
            />
            <ToolCard
              icon={Users}
              title="Lab Groups"
              status={stats?.groupsCount ? `${stats.groupsCount} groups` : 'Not created'}
              warning={missingLearningStyles > 0 ? `Need ${missingLearningStyles} more learning styles` : null}
              actionLabel={stats?.groupsCount ? 'View Groups' : 'Create Groups'}
              href={`/lab-management/cohorts/${cohortId}/groups`}
            />
            <ToolCard
              icon={Calendar}
              title="Lab Schedule"
              status={stats?.upcomingLabs?.length ? `${stats.upcomingLabs.length} upcoming` : 'No labs scheduled'}
              actionLabel="View Schedule"
              href={`/lab-management/schedule?cohortId=${cohortId}`}
            />
            <ToolCard
              icon={BarChart3}
              title="Progress Tracking"
              status="Coming soon"
              actionLabel="View Progress"
              disabled={true}
            />
          </div>
        </div>

        {/* Stats Section */}
        {stats && (stats.agencyBreakdown.length > 0 || stats.learningStyleBreakdown.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Agency Breakdown */}
            {stats.agencyBreakdown.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Agencies</h3>
                <div className="flex flex-wrap gap-2">
                  {stats.agencyBreakdown.map(({ name, count }) => (
                    <span key={name} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300">
                      {name} <span className="font-semibold">({count})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Learning Style Breakdown */}
            {stats.learningStyleBreakdown.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Learning Styles</h3>
                <div className="flex flex-wrap gap-2">
                  {stats.learningStyleBreakdown.map(({ style, count }) => {
                    const badge = STYLE_BADGES[style];
                    return (
                      <span key={style} className={`px-3 py-1 rounded-full text-sm ${badge?.bg || 'bg-gray-100 dark:bg-gray-700'} ${badge?.text || 'text-gray-700 dark:text-gray-300'}`}>
                        {style.charAt(0).toUpperCase() + style.slice(1)} <span className="font-semibold">({count})</span>
                      </span>
                    );
                  })}
                </div>
                {stats.socialStyleBreakdown.length > 0 && (
                  <div className="mt-3 pt-3 border-t dark:border-gray-700 flex flex-wrap gap-2">
                    {stats.socialStyleBreakdown.map(({ style, count }) => {
                      const badge = STYLE_BADGES[style];
                      return (
                        <span key={style} className={`px-3 py-1 rounded-full text-sm ${badge?.bg || 'bg-gray-100 dark:bg-gray-700'} ${badge?.text || 'text-gray-700 dark:text-gray-300'}`}>
                          {style.charAt(0).toUpperCase() + style.slice(1)} <span className="font-semibold">({count})</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Field Trip Attendance */}
        {students.length > 0 && (
          <FieldTripAttendance cohortId={cohortId} students={students} />
        )}

        {/* Student List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              Students ({students.length})
            </h2>
            <Link
              href={`/lab-management/students?cohortId=${cohortId}`}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              View All &rarr;
            </Link>
          </div>

          {students.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 mb-4">No students in this cohort yet</p>
              <Link
                href={`/lab-management/students/new?cohortId=${cohortId}&returnTo=${encodeURIComponent(`/lab-management/cohorts/${cohortId}`)}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add First Student
              </Link>
            </div>
          ) : (
            <div className="divide-y dark:divide-gray-700 max-h-96 overflow-y-auto">
              {students.map((student) => {
                const ls = getLearningStyle(student.id);
                return (
                  <Link
                    key={student.id}
                    href={`/lab-management/students/${student.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    {/* Photo */}
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                      {student.photo_url ? (
                        <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm font-medium">
                          {student.first_name[0]}{student.last_name[0]}
                        </div>
                      )}
                    </div>

                    {/* Name & Agency */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {student.first_name} {student.last_name}
                      </div>
                      {student.agency && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">{student.agency}</div>
                      )}
                    </div>

                    {/* Learning Style Badges */}
                    <div className="flex items-center gap-1">
                      {ls ? (
                        <>
                          {ls.primary_style && (
                            <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${STYLE_BADGES[ls.primary_style]?.bg} ${STYLE_BADGES[ls.primary_style]?.text}`}>
                              {STYLE_BADGES[ls.primary_style]?.label}
                            </span>
                          )}
                          {ls.social_style && (
                            <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${STYLE_BADGES[ls.social_style]?.bg} ${STYLE_BADGES[ls.social_style]?.text}`}>
                              {STYLE_BADGES[ls.social_style]?.label}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                          Not assessed
                        </span>
                      )}
                    </div>

                    {/* Photo indicator */}
                    <div className="flex-shrink-0">
                      {student.photo_url ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Camera className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                      )}
                    </div>

                    <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
