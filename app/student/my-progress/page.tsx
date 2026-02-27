'use client';

/**
 * Student Self-Service Progress Portal
 *
 * Read-only dashboard for students to view their own progress:
 *   1. Progress Overview - skill/scenario/clinical/attendance summary
 *   2. Skills Completion - grouped by category with sign-off details
 *   3. Scenario Assessment History - score, pass/fail, assessor
 *   4. Clinical Hours Summary - hours by department
 *   5. Attendance Record - lab day presence history
 *   6. Compliance Documents - required document status
 *   7. Upcoming Labs - next scheduled labs for their cohort
 */

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Activity,
  Calendar,
  FileCheck,
  Stethoscope,
  BookOpen,
  MapPin,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Overview {
  skillsCompleted: number;
  skillsTotal: number;
  scenariosAssessed: number;
  clinicalHours: number;
  clinicalHoursRequired: number;
  attendancePresent: number;
  attendanceTotal: number;
  attendanceRate: number;
}

interface Skill {
  id: string;
  name: string;
  category: string;
  description: string | null;
  completed: boolean;
  signedOffAt: string | null;
  signedOffBy: string | null;
}

interface ScenarioAssessment {
  id: string;
  scenarioTitle: string;
  category: string | null;
  date: string;
  score: number | null;
  passed: boolean | null;
  assessorName: string | null;
}

interface ClinicalHoursRecord {
  psych_hours: number;
  psych_shifts: number;
  ed_hours: number;
  ed_shifts: number;
  icu_hours: number;
  icu_shifts: number;
  ob_hours: number;
  ob_shifts: number;
  or_hours: number;
  or_shifts: number;
  peds_ed_hours: number;
  peds_ed_shifts: number;
  peds_icu_hours: number;
  peds_icu_shifts: number;
  ems_field_hours: number;
  ems_field_shifts: number;
  cardiology_hours: number;
  cardiology_shifts: number;
  ems_ridealong_hours: number;
  ems_ridealong_shifts: number;
  total_hours: number;
  total_shifts: number;
  updated_at: string;
}

interface AttendanceRecord {
  id: string;
  labDate: string | null;
  labTitle: string | null;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes: string | null;
  markedAt: string;
}

interface ComplianceDoc {
  id: string;
  name: string;
  description: string | null;
  isRequired: boolean;
  status: 'complete' | 'missing' | 'expiring' | 'expired';
  expirationDate: string | null;
  notes: string | null;
  verifiedAt: string | null;
}

interface UpcomingLab {
  id: string;
  date: string;
  title: string | null;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
}

interface StudentInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  status: string | null;
  cohort: {
    id: string;
    cohortNumber: number;
    program: { name: string; abbreviation: string } | null;
  } | null;
}

interface ProgressData {
  success: boolean;
  studentFound: boolean;
  message?: string;
  student?: StudentInfo;
  overview?: Overview;
  skills?: Skill[];
  scenarios?: ScenarioAssessment[];
  clinicalHours?: ClinicalHoursRecord | null;
  attendance?: AttendanceRecord[];
  compliance?: ComplianceDoc[];
  upcomingLabs?: UpcomingLab[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return '';
  // time is "HH:MM:SS" or "HH:MM"
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${m} ${ampm}`;
}

function ProgressBar({
  value,
  max,
  colorClass = 'bg-cyan-500',
}: {
  value: number;
  max: number;
  colorClass?: string;
}) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  return (
    <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({
  title,
  icon: Icon,
  iconColor,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
          <h2 className="font-semibold text-gray-900 dark:text-white text-base">
            {title}
          </h2>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {open && <div className="p-6">{children}</div>}
    </div>
  );
}

function EmptyState({
  message,
  icon: Icon,
}: {
  message: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full mb-3">
        <Icon className="w-7 h-7 text-gray-400 dark:text-gray-500" />
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MyProgressPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.email) {
      fetchProgress();
    }
  }, [session]);

  const fetchProgress = async () => {
    try {
      const res = await fetch('/api/student/my-progress');
      if (!res.ok) {
        if (res.status === 403) {
          setError('This page is only accessible to students.');
        } else {
          setError('Failed to load progress data. Please try again.');
        }
        setLoading(false);
        return;
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Error fetching progress:', err);
      setError('Failed to load progress data. Please try again.');
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-800 dark:text-red-200 mb-1">Error</h3>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // ─── Student not in system yet ───────────────────────────────────────────
  if (!data.studentFound) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-1">
              No Student Record Found
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {data.message ||
                'Your student record has not been set up yet. Please contact your instructor.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { student, overview, skills, scenarios, clinicalHours, attendance, compliance, upcomingLabs } =
    data;

  // ─── Skill categories ────────────────────────────────────────────────────
  const skillsByCategory = (skills || []).reduce<Record<string, Skill[]>>(
    (acc, skill) => {
      const cat = skill.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(skill);
      return acc;
    },
    {}
  );
  const sortedCategories = Object.keys(skillsByCategory).sort();

  // ─── Clinical hours rows ─────────────────────────────────────────────────
  const clinicalDepts = clinicalHours
    ? [
        { label: 'Emergency Dept (ED)', hours: clinicalHours.ed_hours || 0, shifts: clinicalHours.ed_shifts || 0 },
        { label: 'ICU / Critical Care', hours: clinicalHours.icu_hours || 0, shifts: clinicalHours.icu_shifts || 0 },
        { label: 'OB / Labor & Delivery', hours: clinicalHours.ob_hours || 0, shifts: clinicalHours.ob_shifts || 0 },
        { label: 'OR / Surgery', hours: clinicalHours.or_hours || 0, shifts: clinicalHours.or_shifts || 0 },
        { label: 'Peds ED', hours: clinicalHours.peds_ed_hours || 0, shifts: clinicalHours.peds_ed_shifts || 0 },
        { label: 'Peds ICU', hours: clinicalHours.peds_icu_hours || 0, shifts: clinicalHours.peds_icu_shifts || 0 },
        { label: 'Cardiology', hours: clinicalHours.cardiology_hours || 0, shifts: clinicalHours.cardiology_shifts || 0 },
        { label: 'Psych', hours: clinicalHours.psych_hours || 0, shifts: clinicalHours.psych_shifts || 0 },
        { label: 'EMS Field', hours: clinicalHours.ems_field_hours || 0, shifts: clinicalHours.ems_field_shifts || 0 },
        { label: 'EMS Ride-Along', hours: clinicalHours.ems_ridealong_hours || 0, shifts: clinicalHours.ems_ridealong_shifts || 0 },
      ].filter((d) => d.hours > 0)
    : [];

  // ─── Attendance status config ─────────────────────────────────────────────
  const attendanceConfig: Record<string, { label: string; color: string; bg: string; iconColor: string }> = {
    present: { label: 'Present', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30', iconColor: 'text-green-600 dark:text-green-400' },
    late: { label: 'Late', color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30', iconColor: 'text-yellow-600 dark:text-yellow-400' },
    excused: { label: 'Excused', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30', iconColor: 'text-blue-600 dark:text-blue-400' },
    absent: { label: 'Absent', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', iconColor: 'text-red-600 dark:text-red-400' },
  };

  // ─── Compliance status config ─────────────────────────────────────────────
  const complianceConfig: Record<string, { label: string; color: string; bg: string }> = {
    complete: { label: 'Complete', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
    expiring: { label: 'Expiring Soon', color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
    expired: { label: 'Expired', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
    missing: { label: 'Missing', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700' },
  };

  const skillsPct =
    (overview?.skillsTotal || 0) > 0
      ? Math.round(((overview?.skillsCompleted || 0) / (overview?.skillsTotal || 1)) * 100)
      : 0;

  const clinicalPct =
    (overview?.clinicalHoursRequired || 0) > 0
      ? Math.min(
          Math.round(((overview?.clinicalHours || 0) / (overview?.clinicalHoursRequired || 1)) * 100),
          100
        )
      : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/" className="flex items-center gap-1 hover:text-cyan-600 dark:hover:text-cyan-400">
          <Home className="w-3.5 h-3.5" />
          Home
        </Link>
        <ChevronRight className="w-4 h-4" />
        <Link href="/student" className="hover:text-cyan-600 dark:hover:text-cyan-400">
          Student
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-900 dark:text-white">My Progress</span>
      </nav>

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          My Progress
        </h1>
        {student && (
          <p className="text-gray-600 dark:text-gray-400">
            {student.firstName} {student.lastName}
            {student.cohort
              ? ` · ${student.cohort.program?.abbreviation || 'PMD'} Group ${student.cohort.cohortNumber}`
              : ''}
          </p>
        )}
      </div>

      {/* ── Section 1: Progress Overview ── */}
      <SectionCard
        title="Progress Overview"
        icon={TrendingUp}
        iconColor="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Skills */}
          <div>
            <div className="flex justify-between items-end mb-1.5">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Skills Completed
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {overview?.skillsCompleted ?? 0} / {overview?.skillsTotal ?? 0}
              </span>
            </div>
            <ProgressBar
              value={overview?.skillsCompleted || 0}
              max={overview?.skillsTotal || 1}
              colorClass="bg-green-500"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {skillsPct}% complete
            </p>
          </div>

          {/* Scenarios */}
          <div>
            <div className="flex justify-between items-end mb-1.5">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Scenarios Assessed
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {overview?.scenariosAssessed ?? 0}
              </span>
            </div>
            <ProgressBar
              value={overview?.scenariosAssessed || 0}
              max={Math.max(overview?.scenariosAssessed || 0, 20)}
              colorClass="bg-blue-500"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Total as team lead
            </p>
          </div>

          {/* Clinical Hours */}
          <div>
            <div className="flex justify-between items-end mb-1.5">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Clinical Hours
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {overview?.clinicalHours ?? 0}h / {overview?.clinicalHoursRequired ?? 0}h
              </span>
            </div>
            <ProgressBar
              value={overview?.clinicalHours || 0}
              max={overview?.clinicalHoursRequired || 1}
              colorClass={clinicalPct >= 100 ? 'bg-green-500' : clinicalPct >= 50 ? 'bg-cyan-500' : 'bg-amber-500'}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {clinicalPct}% of required hours
            </p>
          </div>

          {/* Attendance */}
          <div>
            <div className="flex justify-between items-end mb-1.5">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Attendance Rate
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {overview?.attendancePresent ?? 0} / {overview?.attendanceTotal ?? 0} labs
              </span>
            </div>
            <ProgressBar
              value={overview?.attendancePresent || 0}
              max={overview?.attendanceTotal || 1}
              colorClass={
                (overview?.attendanceRate || 0) >= 90
                  ? 'bg-green-500'
                  : (overview?.attendanceRate || 0) >= 75
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {overview?.attendanceRate ?? 0}% attendance rate
            </p>
          </div>
        </div>
      </SectionCard>

      {/* ── Section 2: Skills Completion ── */}
      <SectionCard
        title="Skills Completion"
        icon={CheckCircle}
        iconColor="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
        defaultOpen={false}
      >
        {sortedCategories.length === 0 ? (
          <EmptyState message="No skills data available yet." icon={CheckCircle} />
        ) : (
          <div className="space-y-6">
            {sortedCategories.map((category) => {
              const catSkills = skillsByCategory[category];
              const catCompleted = catSkills.filter((s) => s.completed).length;
              return (
                <div key={category}>
                  {/* Category header */}
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 capitalize">
                      {category.replace(/_/g, ' ')}
                    </h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {catCompleted} / {catSkills.length}
                    </span>
                  </div>

                  {/* Skills list */}
                  <div className="space-y-1.5">
                    {catSkills.map((skill) => (
                      <div
                        key={skill.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          skill.completed
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          {skill.completed ? (
                            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                          )}
                          <span
                            className={`text-sm font-medium truncate ${
                              skill.completed
                                ? 'text-green-800 dark:text-green-200'
                                : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {skill.name}
                          </span>
                        </div>
                        {skill.completed && (
                          <div className="text-right ml-3 shrink-0">
                            <p className="text-xs text-green-700 dark:text-green-400">
                              {formatDate(skill.signedOffAt)}
                            </p>
                            {skill.signedOffBy && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {skill.signedOffBy.split('@')[0]}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── Section 3: Scenario Assessment History ── */}
      <SectionCard
        title="Scenario Assessment History"
        icon={Activity}
        iconColor="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
        defaultOpen={false}
      >
        {(scenarios || []).length === 0 ? (
          <EmptyState message="No scenario assessments recorded yet." icon={Activity} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">
                    Scenario
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">
                    Date
                  </th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600 dark:text-gray-400">
                    Score
                  </th>
                  <th className="text-center py-2 px-3 font-medium text-gray-600 dark:text-gray-400">
                    Result
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">
                    Assessor
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {scenarios!.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-gray-900 dark:text-white font-medium">
                      {s.scenarioTitle}
                      {s.category && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 font-normal">
                          {s.category}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">
                      {formatDate(s.date)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {s.score != null ? (
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            s.score >= 80
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : s.score >= 70
                              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          }`}
                        >
                          {s.score}%
                        </span>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {s.passed === true ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Pass
                        </span>
                      ) : s.passed === false ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-700 dark:text-red-400">
                          <XCircle className="w-3.5 h-3.5" />
                          Fail
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">--</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">
                      {s.assessorName || '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── Section 4: Clinical Hours Summary ── */}
      <SectionCard
        title="Clinical Hours Summary"
        icon={Stethoscope}
        iconColor="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
        defaultOpen={false}
      >
        {!clinicalHours || clinicalDepts.length === 0 ? (
          <EmptyState message="No clinical hours logged yet." icon={Stethoscope} />
        ) : (
          <>
            {/* Total hours banner */}
            <div className="mb-5 flex items-center gap-5 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div>
                <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                  {clinicalHours.total_hours || 0}
                </p>
                <p className="text-sm text-purple-600 dark:text-purple-400">Total Hours</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                  {clinicalHours.total_shifts || 0}
                </p>
                <p className="text-sm text-purple-600 dark:text-purple-400">Total Shifts</p>
              </div>
              <div className="flex-1 ml-4">
                <div className="flex justify-between text-xs text-purple-600 dark:text-purple-400 mb-1">
                  <span>Progress toward {overview?.clinicalHoursRequired || 108}h required</span>
                  <span>{clinicalPct}%</span>
                </div>
                <ProgressBar
                  value={clinicalHours.total_hours || 0}
                  max={overview?.clinicalHoursRequired || 108}
                  colorClass={clinicalPct >= 100 ? 'bg-green-500' : 'bg-purple-500'}
                />
              </div>
            </div>

            {/* Department breakdown */}
            <div className="space-y-2">
              {clinicalDepts.map((dept) => (
                <div
                  key={dept.label}
                  className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300">{dept.label}</span>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {dept.hours}h
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                      ({dept.shifts} shift{dept.shifts !== 1 ? 's' : ''})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </SectionCard>

      {/* ── Section 5: Attendance Record ── */}
      <SectionCard
        title="Attendance Record"
        icon={Calendar}
        iconColor="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
        defaultOpen={false}
      >
        {(attendance || []).length === 0 ? (
          <EmptyState message="No attendance records found yet." icon={Calendar} />
        ) : (
          <>
            {/* Summary bar */}
            <div className="flex items-center gap-6 mb-5 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {overview?.attendanceRate ?? 0}%
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">Attendance Rate</p>
              </div>
              <div className="flex-1">
                <ProgressBar
                  value={overview?.attendancePresent || 0}
                  max={overview?.attendanceTotal || 1}
                  colorClass={
                    (overview?.attendanceRate || 0) >= 90
                      ? 'bg-green-500'
                      : (overview?.attendanceRate || 0) >= 75
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }
                />
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  {overview?.attendancePresent || 0} present / {overview?.attendanceTotal || 0} total
                </p>
              </div>
            </div>

            {/* Attendance list */}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {attendance!.map((record) => {
                const cfg = attendanceConfig[record.status] || attendanceConfig.absent;
                return (
                  <div
                    key={record.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30"
                  >
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} shrink-0`}
                    >
                      {cfg.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {record.labTitle || 'Lab Day'}
                      </p>
                      {record.notes && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {record.notes}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                      {formatDate(record.labDate || record.markedAt)}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </SectionCard>

      {/* ── Section 6: Compliance Documents ── */}
      <SectionCard
        title="Compliance Documents"
        icon={FileCheck}
        iconColor="bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400"
        defaultOpen={false}
      >
        {(compliance || []).length === 0 ? (
          <EmptyState message="No compliance documents configured yet." icon={FileCheck} />
        ) : (
          <>
            {/* Summary counts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {(['complete', 'missing', 'expiring', 'expired'] as const).map((status) => {
                const count = compliance!.filter((d) => d.status === status).length;
                const cfg = complianceConfig[status];
                return (
                  <div
                    key={status}
                    className={`rounded-lg p-3 text-center ${cfg.bg}`}
                  >
                    <p className={`text-2xl font-bold ${cfg.color}`}>{count}</p>
                    <p className={`text-xs ${cfg.color}`}>{cfg.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Document list */}
            <div className="space-y-2">
              {compliance!.map((doc) => {
                const cfg = complianceConfig[doc.status] || complianceConfig.missing;
                return (
                  <div
                    key={doc.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      doc.status === 'complete'
                        ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
                        : doc.status === 'expired'
                        ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                        : doc.status === 'expiring'
                        ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10'
                        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      {doc.status === 'complete' ? (
                        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                      ) : doc.status === 'expired' ? (
                        <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                      ) : doc.status === 'expiring' ? (
                        <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {doc.name}
                          {doc.isRequired && (
                            <span className="ml-1.5 text-xs text-gray-500 dark:text-gray-400">
                              (required)
                            </span>
                          )}
                        </p>
                        {doc.notes && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {doc.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                      {doc.expirationDate && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Exp: {formatDate(doc.expirationDate)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </SectionCard>

      {/* ── Section 7: Upcoming Labs ── */}
      <SectionCard
        title="Upcoming Labs"
        icon={BookOpen}
        iconColor="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
        defaultOpen
      >
        {(upcomingLabs || []).length === 0 ? (
          <EmptyState message="No upcoming labs scheduled." icon={BookOpen} />
        ) : (
          <div className="space-y-3">
            {upcomingLabs!.map((lab) => (
              <div
                key={lab.id}
                className="flex items-start gap-4 p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800"
              >
                {/* Date badge */}
                <div className="shrink-0 text-center bg-indigo-600 text-white rounded-lg px-3 py-2 min-w-[52px]">
                  <p className="text-xs uppercase font-medium leading-none">
                    {new Date(lab.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                  </p>
                  <p className="text-xl font-bold leading-tight">
                    {new Date(lab.date + 'T00:00:00').getDate()}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-indigo-900 dark:text-indigo-100">
                    {lab.title || 'Lab Day'}
                  </p>
                  {(lab.startTime || lab.endTime) && (
                    <p className="text-sm text-indigo-700 dark:text-indigo-300">
                      {lab.startTime ? formatTime(lab.startTime) : ''}
                      {lab.startTime && lab.endTime ? ' – ' : ''}
                      {lab.endTime ? formatTime(lab.endTime) : ''}
                    </p>
                  )}
                  {lab.location && (
                    <p className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {lab.location}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
