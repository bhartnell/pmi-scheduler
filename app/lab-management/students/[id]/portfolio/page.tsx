'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Printer,
  User,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Activity,
  Shield,
  Calendar,
  TrendingUp,
  Award,
  Loader2,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface CohortInfo {
  id: string;
  cohort_number: number;
  start_date: string | null;
  expected_end_date: string | null;
  program: { name: string; abbreviation: string } | null;
}

interface StudentInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  photo_url: string | null;
  status: string;
  agency: string | null;
  student_id: string | null;
  prior_cert_level: string | null;
  years_ems_experience: number | null;
  created_at: string;
  cohort: CohortInfo | null;
}

interface SkillItem {
  id: string;
  skill_name: string;
  skill_category: string | null;
  signed_off_at: string;
  signed_off_by: string;
}

interface ScenarioItem {
  id: string;
  scenario_title: string;
  scenario_category: string | null;
  date: string;
  week_number: number | null;
  day_number: number | null;
  score: number | null;
  grade: string;
  instructor: string;
}

interface SummativeItem {
  id: string;
  scenario_title: string;
  scenario_number: number | null;
  evaluation_date: string | null;
  examiner_name: string;
  total_score: number | null;
  passed: boolean | null;
  grading_complete: boolean;
  graded_at: string | null;
  scores: {
    leadership_scene: number | null;
    patient_assessment: number | null;
    patient_management: number | null;
    interpersonal: number | null;
    integration: number | null;
  };
  critical_criteria_failed: boolean;
}

interface AttendanceRecord {
  id: string;
  lab_day_date: string | null;
  week_number: number | null;
  day_number: number | null;
  status: string;
  notes: string | null;
  marked_at: string;
}

interface ComplianceItem {
  name: string;
  status: string;
  expiration_date: string | null;
  is_required: boolean;
}

interface Portfolio {
  student: StudentInfo;
  generatedAt: string;
  skills: {
    total: number;
    items: SkillItem[];
  };
  scenarios: {
    total: number;
    averageScore: number | null;
    items: ScenarioItem[];
  };
  summativeEvaluations: {
    total: number;
    passed: number;
    items: SummativeItem[];
  };
  attendance: {
    total: number;
    present: number;
    absent: number;
    excused: number;
    late: number;
    records: AttendanceRecord[];
  };
  compliance: {
    total: number;
    complete: number;
    missing: number;
    expiring: number;
    expired: number;
    items: ComplianceItem[];
  };
  clinicalHours: {
    totalHours: number;
    totalShifts: number;
    byDepartment: Record<string, { hours: number; shifts: number }>;
  };
  teamLeadCount: number;
}

// ============================================================
// Helper components
// ============================================================

function SectionHeader({
  title,
  icon: Icon,
  isOpen,
  onToggle,
  badge,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  isOpen: boolean;
  onToggle: () => void;
  badge?: string | number;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors print:pointer-events-none print:bg-transparent"
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400 print:text-blue-600" />
        <span className="font-semibold text-gray-900 dark:text-white text-base">{title}</span>
        {badge !== undefined && (
          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full print:bg-blue-100 print:text-blue-700">
            {badge}
          </span>
        )}
      </div>
      <span className="print:hidden">
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </span>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    complete: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 print:bg-green-100 print:text-green-800',
    missing: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 print:bg-red-100 print:text-red-800',
    expiring: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 print:bg-yellow-100 print:text-yellow-800',
    expired: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 print:bg-orange-100 print:text-orange-800',
    present: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 print:bg-green-100 print:text-green-800',
    absent: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 print:bg-red-100 print:text-red-800',
    excused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 print:bg-yellow-100 print:text-yellow-800',
    late: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 print:bg-orange-100 print:text-orange-800',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  const styles: Record<string, string> = {
    A: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 print:bg-green-100 print:text-green-800',
    B: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 print:bg-blue-100 print:text-blue-800',
    C: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 print:bg-yellow-100 print:text-yellow-800',
    D: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 print:bg-orange-100 print:text-orange-800',
    F: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 print:bg-red-100 print:text-red-800',
  };
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${styles[grade] || 'bg-gray-100 text-gray-700'}`}>
      {grade}
    </span>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ============================================================
// Main page
// ============================================================

export default function StudentPortfolioPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const studentId = params?.id as string;

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Section open/close state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    skills: true,
    scenarios: true,
    summative: true,
    attendance: true,
    compliance: true,
    clinical: true,
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (!studentId || status !== 'authenticated') return;

    const fetchPortfolio = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/lab-management/students/${studentId}/portfolio`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to load portfolio');
        }
        setPortfolio(data.portfolio);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, [studentId, status]);

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
          <p className="text-red-700 dark:text-red-300 font-medium">{error}</p>
          <Link href="/lab-management/students" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
            Back to Students
          </Link>
        </div>
      </div>
    );
  }

  if (!portfolio) return null;

  const { student, skills, scenarios, summativeEvaluations, attendance, compliance, clinicalHours, teamLeadCount, generatedAt } = portfolio;
  const studentName = `${student.first_name} ${student.last_name}`;
  const cohortData = student.cohort as CohortInfo | null;
  const programName = cohortData?.program?.name || 'Unknown Program';
  const cohortLabel = cohortData ? `Cohort ${cohortData.cohort_number}` : 'No Cohort';

  const attendanceRate = attendance.total > 0
    ? Math.round((attendance.present / attendance.total) * 100)
    : null;

  const complianceRate = compliance.total > 0
    ? Math.round((compliance.complete / compliance.total) * 100)
    : null;

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          nav, header, .print-hide { display: none !important; }
          body { background: white !important; }
          .print-full-width { width: 100% !important; max-width: 100% !important; }
          .print-no-shadow { box-shadow: none !important; }
          .print-section { page-break-inside: avoid; }
        }
      `}</style>

      <div className="max-w-5xl mx-auto px-4 py-6 print-full-width">

        {/* Breadcrumb - hidden on print */}
        <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-6 print-hide" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Home</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/lab-management" className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Lab Management</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/lab-management/students" className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Students</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href={`/lab-management/students/${studentId}`} className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">{studentName}</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-700 dark:text-gray-200 font-medium">Portfolio</span>
        </nav>

        {/* Page actions - hidden on print */}
        <div className="flex items-center justify-between mb-6 print-hide">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Student Portfolio</h1>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print / Export PDF
          </button>
        </div>

        {/* Official header (visible in both screen and print) */}
        <div className="bg-white dark:bg-gray-800 print:bg-white rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 print:border-gray-300 p-6 mb-6 print-no-shadow">
          {/* Institution header */}
          <div className="text-center border-b border-gray-200 dark:border-gray-700 print:border-gray-300 pb-4 mb-5">
            <p className="text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 print:text-gray-500 mb-1">Pima Medical Institute</p>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white print:text-gray-900">{programName}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600 mt-1">Official Student Transcript &amp; Portfolio</p>
          </div>

          {/* Student info grid */}
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Photo */}
            <div className="flex-shrink-0">
              {student.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={student.photo_url}
                  alt={studentName}
                  className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600 print:border-gray-300"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700 print:bg-gray-100 flex items-center justify-center border-2 border-gray-200 dark:border-gray-600 print:border-gray-300">
                  <User className="w-10 h-10 text-gray-400 print:text-gray-400" />
                </div>
              )}
            </div>

            {/* Details */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 print:text-gray-500 uppercase tracking-wide">Student Name</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white print:text-gray-900">{studentName}</p>
              </div>
              {student.student_id && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 print:text-gray-500 uppercase tracking-wide">Student ID</p>
                  <p className="text-base text-gray-900 dark:text-white print:text-gray-900 font-mono">{student.student_id}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 print:text-gray-500 uppercase tracking-wide">Program / Cohort</p>
                <p className="text-base text-gray-900 dark:text-white print:text-gray-900">{cohortLabel}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 print:text-gray-500 uppercase tracking-wide">Enrollment Status</p>
                <p className="text-base capitalize text-gray-900 dark:text-white print:text-gray-900">{student.status || '—'}</p>
              </div>
              {cohortData?.start_date && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 print:text-gray-500 uppercase tracking-wide">Program Start</p>
                  <p className="text-base text-gray-900 dark:text-white print:text-gray-900">{formatDate(cohortData.start_date)}</p>
                </div>
              )}
              {cohortData?.expected_end_date && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 print:text-gray-500 uppercase tracking-wide">Expected Completion</p>
                  <p className="text-base text-gray-900 dark:text-white print:text-gray-900">{formatDate(cohortData.expected_end_date)}</p>
                </div>
              )}
              {student.agency && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 print:text-gray-500 uppercase tracking-wide">Agency</p>
                  <p className="text-base text-gray-900 dark:text-white print:text-gray-900">{student.agency}</p>
                </div>
              )}
              {student.prior_cert_level && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 print:text-gray-500 uppercase tracking-wide">Prior Certification</p>
                  <p className="text-base text-gray-900 dark:text-white print:text-gray-900">{student.prior_cert_level}</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700 print:border-gray-300 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 print:text-blue-600">{skills.total}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 print:text-gray-500 mt-0.5">Skills Signed Off</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 print:text-purple-600">{scenarios.total}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 print:text-gray-500 mt-0.5">Scenarios as TL</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 print:text-green-600">
                {attendanceRate !== null ? `${attendanceRate}%` : '—'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 print:text-gray-500 mt-0.5">Attendance Rate</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 print:text-teal-600">
                {clinicalHours.totalHours > 0 ? `${clinicalHours.totalHours}h` : '—'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 print:text-gray-500 mt-0.5">Clinical Hours</p>
            </div>
          </div>
        </div>

        {/* ============================================================
            SECTION 1: Skills Completed
        ============================================================ */}
        <div className="bg-white dark:bg-gray-800 print:bg-white rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 print:border-gray-300 mb-4 overflow-hidden print-section print-no-shadow">
          <SectionHeader
            title="Skills Completed"
            icon={CheckCircle}
            isOpen={openSections.skills}
            onToggle={() => toggleSection('skills')}
            badge={skills.total}
          />
          {(openSections.skills || true) && (
            <div className={openSections.skills ? 'block' : 'hidden print:block'}>
              <div className="border-t border-gray-200 dark:border-gray-700 print:border-gray-300">
                {skills.total === 0 ? (
                  <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                    No skills signed off yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700/50 print:bg-gray-50">
                          <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300 print:text-gray-600">Skill</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300 print:text-gray-600">Category</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300 print:text-gray-600">Date</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300 print:text-gray-600">Signed Off By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700 print:divide-gray-200">
                        {skills.items.map(skill => (
                          <tr key={skill.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 print:hover:bg-transparent">
                            <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white print:text-gray-900">{skill.skill_name}</td>
                            <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300 print:text-gray-600 capitalize">{skill.skill_category || '—'}</td>
                            <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300 print:text-gray-600 whitespace-nowrap">{formatDate(skill.signed_off_at)}</td>
                            <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300 print:text-gray-600">{skill.signed_off_by}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ============================================================
            SECTION 2: Scenario Assessments (Team Lead)
        ============================================================ */}
        <div className="bg-white dark:bg-gray-800 print:bg-white rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 print:border-gray-300 mb-4 overflow-hidden print-section print-no-shadow">
          <SectionHeader
            title="Scenario Assessments (Team Lead)"
            icon={Activity}
            isOpen={openSections.scenarios}
            onToggle={() => toggleSection('scenarios')}
            badge={scenarios.total}
          />
          {(openSections.scenarios || true) && (
            <div className={openSections.scenarios ? 'block' : 'hidden print:block'}>
              <div className="border-t border-gray-200 dark:border-gray-700 print:border-gray-300">
                {scenarios.averageScore !== null && (
                  <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 print:bg-blue-50 border-b border-blue-100 dark:border-blue-800 print:border-blue-100 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-600 print:text-blue-600" />
                    <span className="text-sm text-blue-800 dark:text-blue-200 print:text-blue-800">
                      Average score: <strong>{scenarios.averageScore.toFixed(2)}</strong> / 5.0
                      {' '}({scenarios.averageScore >= 4 ? 'A' : scenarios.averageScore >= 3 ? 'B' : scenarios.averageScore >= 2 ? 'C' : scenarios.averageScore >= 1 ? 'D' : 'F'})
                    </span>
                  </div>
                )}
                {scenarios.total === 0 ? (
                  <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                    No scenario assessments recorded yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700/50 print:bg-gray-50">
                          <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300 print:text-gray-600">Scenario</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300 print:text-gray-600">Date</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300 print:text-gray-600">Week / Day</th>
                          <th className="px-4 py-2.5 text-center font-medium text-gray-600 dark:text-gray-300 print:text-gray-600">Score</th>
                          <th className="px-4 py-2.5 text-center font-medium text-gray-600 dark:text-gray-300 print:text-gray-600">Grade</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300 print:text-gray-600">Instructor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700 print:divide-gray-200">
                        {scenarios.items.map(s => (
                          <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 print:hover:bg-transparent">
                            <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white print:text-gray-900">{s.scenario_title}</td>
                            <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300 print:text-gray-600 whitespace-nowrap">{formatDate(s.date)}</td>
                            <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300 print:text-gray-600">
                              {s.week_number ? `Wk ${s.week_number} / Day ${s.day_number || '?'}` : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-center text-gray-900 dark:text-white print:text-gray-900">
                              {s.score !== null ? `${s.score}/5` : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {s.grade !== 'N/A' ? <GradeBadge grade={s.grade} /> : <span className="text-gray-400">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300 print:text-gray-600">{s.instructor}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ============================================================
            SECTION 3: Summative Evaluations
        ============================================================ */}
        {summativeEvaluations.total > 0 && (
          <div className="bg-white dark:bg-gray-800 print:bg-white rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 print:border-gray-300 mb-4 overflow-hidden print-section print-no-shadow">
            <SectionHeader
              title="Summative Evaluations"
              icon={Award}
              isOpen={openSections.summative}
              onToggle={() => toggleSection('summative')}
              badge={`${summativeEvaluations.passed}/${summativeEvaluations.total} passed`}
            />
            {(openSections.summative || true) && (
              <div className={openSections.summative ? 'block' : 'hidden print:block'}>
                <div className="border-t border-gray-200 dark:border-gray-700 print:border-gray-300">
                  <div className="divide-y divide-gray-100 dark:divide-gray-700 print:divide-gray-200">
                    {summativeEvaluations.items.map(ev => (
                      <div key={ev.id} className="p-4">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white print:text-gray-900">{ev.scenario_title}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 print:text-gray-500 mt-0.5">
                              {formatDate(ev.evaluation_date)} &bull; Examiner: {ev.examiner_name}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {ev.passed === true && (
                              <span className="flex items-center gap-1 px-2.5 py-1 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 print:bg-green-100 print:text-green-800 text-xs font-medium rounded-full">
                                <CheckCircle className="w-3.5 h-3.5" /> Pass
                              </span>
                            )}
                            {ev.passed === false && (
                              <span className="flex items-center gap-1 px-2.5 py-1 bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 print:bg-red-100 print:text-red-800 text-xs font-medium rounded-full">
                                <XCircle className="w-3.5 h-3.5" /> Fail
                              </span>
                            )}
                            {ev.total_score !== null && (
                              <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 print:bg-gray-100 text-gray-700 dark:text-gray-300 print:text-gray-700 text-xs font-medium rounded-full">
                                {ev.total_score}/15
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Rubric scores */}
                        {ev.grading_complete && (
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2">
                            {[
                              { label: 'Leadership', val: ev.scores.leadership_scene },
                              { label: 'Pt Assessment', val: ev.scores.patient_assessment },
                              { label: 'Pt Management', val: ev.scores.patient_management },
                              { label: 'Interpersonal', val: ev.scores.interpersonal },
                              { label: 'Integration', val: ev.scores.integration },
                            ].map(item => (
                              <div key={item.label} className="bg-gray-50 dark:bg-gray-700/50 print:bg-gray-50 rounded p-2 text-center">
                                <p className="text-xs text-gray-500 dark:text-gray-400 print:text-gray-500">{item.label}</p>
                                <p className="font-semibold text-gray-900 dark:text-white print:text-gray-900">
                                  {item.val !== null ? `${item.val}/3` : '—'}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                        {ev.critical_criteria_failed && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-red-700 dark:text-red-400 print:text-red-700">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Critical criteria failed
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================
            SECTION 4: Clinical Hours
        ============================================================ */}
        <div className="bg-white dark:bg-gray-800 print:bg-white rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 print:border-gray-300 mb-4 overflow-hidden print-section print-no-shadow">
          <SectionHeader
            title="Clinical Hours Summary"
            icon={Clock}
            isOpen={openSections.clinical}
            onToggle={() => toggleSection('clinical')}
            badge={`${clinicalHours.totalHours}h total`}
          />
          {(openSections.clinical || true) && (
            <div className={openSections.clinical ? 'block' : 'hidden print:block'}>
              <div className="border-t border-gray-200 dark:border-gray-700 print:border-gray-300 p-4">
                {clinicalHours.totalHours === 0 && Object.keys(clinicalHours.byDepartment).length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                    No clinical hours recorded.
                  </div>
                ) : (
                  <>
                    <div className="flex gap-6 mb-4">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 print:text-gray-500 uppercase tracking-wide">Total Hours</p>
                        <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 print:text-teal-600">{clinicalHours.totalHours}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 print:text-gray-500 uppercase tracking-wide">Total Shifts</p>
                        <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 print:text-teal-600">{clinicalHours.totalShifts}</p>
                      </div>
                    </div>
                    {Object.keys(clinicalHours.byDepartment).length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Object.entries(clinicalHours.byDepartment)
                          .sort(([, a], [, b]) => b.hours - a.hours)
                          .map(([dept, data]) => (
                            <div key={dept} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 print:bg-gray-50 rounded-lg px-3 py-2">
                              <span className="text-sm text-gray-700 dark:text-gray-300 print:text-gray-700">{dept}</span>
                              <span className="text-sm font-medium text-gray-900 dark:text-white print:text-gray-900">
                                {data.hours}h / {data.shifts} shift{data.shifts !== 1 ? 's' : ''}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ============================================================
            SECTION 5: Attendance Record
        ============================================================ */}
        <div className="bg-white dark:bg-gray-800 print:bg-white rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 print:border-gray-300 mb-4 overflow-hidden print-section print-no-shadow">
          <SectionHeader
            title="Attendance Record"
            icon={Calendar}
            isOpen={openSections.attendance}
            onToggle={() => toggleSection('attendance')}
            badge={`${attendance.present}/${attendance.total} present`}
          />
          {(openSections.attendance || true) && (
            <div className={openSections.attendance ? 'block' : 'hidden print:block'}>
              <div className="border-t border-gray-200 dark:border-gray-700 print:border-gray-300">
                {/* Summary row */}
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/30 print:bg-gray-50 border-b border-gray-200 dark:border-gray-700 print:border-gray-200 grid grid-cols-4 gap-3 text-center">
                  <div>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400 print:text-green-600">{attendance.present}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 print:text-gray-500">Present</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400 print:text-red-600">{attendance.absent}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 print:text-gray-500">Absent</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400 print:text-yellow-600">{attendance.excused}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 print:text-gray-500">Excused</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400 print:text-orange-600">{attendance.late}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 print:text-gray-500">Late</p>
                  </div>
                </div>

                {attendance.total === 0 ? (
                  <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                    No attendance records found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700/50 print:bg-gray-50">
                          <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300 print:text-gray-600">Date</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300 print:text-gray-600">Week / Day</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300 print:text-gray-600">Status</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300 print:text-gray-600">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700 print:divide-gray-200">
                        {attendance.records.map(rec => (
                          <tr key={rec.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 print:hover:bg-transparent">
                            <td className="px-4 py-2.5 text-gray-900 dark:text-white print:text-gray-900 whitespace-nowrap">
                              {formatDate(rec.lab_day_date)}
                            </td>
                            <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300 print:text-gray-600">
                              {rec.week_number ? `Wk ${rec.week_number} / Day ${rec.day_number || '?'}` : '—'}
                            </td>
                            <td className="px-4 py-2.5">
                              <StatusBadge status={rec.status} />
                            </td>
                            <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 print:text-gray-500 text-xs">
                              {rec.notes || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ============================================================
            SECTION 6: Compliance Documents
        ============================================================ */}
        <div className="bg-white dark:bg-gray-800 print:bg-white rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 print:border-gray-300 mb-6 overflow-hidden print-section print-no-shadow">
          <SectionHeader
            title="Compliance Documents"
            icon={Shield}
            isOpen={openSections.compliance}
            onToggle={() => toggleSection('compliance')}
            badge={complianceRate !== null ? `${complianceRate}% complete` : undefined}
          />
          {(openSections.compliance || true) && (
            <div className={openSections.compliance ? 'block' : 'hidden print:block'}>
              <div className="border-t border-gray-200 dark:border-gray-700 print:border-gray-300">
                {compliance.total === 0 ? (
                  <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                    No compliance documents tracked.
                  </div>
                ) : (
                  <>
                    {/* Progress bar */}
                    {complianceRate !== null && (
                      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 print:border-gray-200">
                        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300 print:text-gray-600 mb-1">
                          <span>{compliance.complete} of {compliance.total} complete</span>
                          <span>{complianceRate}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 dark:bg-gray-700 print:bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 print:bg-green-500 rounded-full transition-all"
                            style={{ width: `${complianceRate}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="divide-y divide-gray-100 dark:divide-gray-700 print:divide-gray-200">
                      {compliance.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-3">
                            {item.status === 'complete' ? (
                              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                            ) : item.status === 'expiring' ? (
                              <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                            ) : item.status === 'expired' ? (
                              <XCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                            )}
                            <span className="text-sm text-gray-900 dark:text-white print:text-gray-900">{item.name}</span>
                            {item.is_required && (
                              <span className="text-xs text-gray-400 dark:text-gray-500 print:text-gray-400">(required)</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {item.expiration_date && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 print:text-gray-500">
                                Exp: {formatDate(item.expiration_date)}
                              </span>
                            )}
                            <StatusBadge status={item.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 dark:text-gray-500 print:text-gray-400 py-4 border-t border-gray-200 dark:border-gray-700 print:border-gray-300">
          <p className="font-medium text-gray-600 dark:text-gray-400 print:text-gray-600 mb-1">Pima Medical Institute &mdash; Paramedic Program</p>
          <p>This document is an unofficial summary generated on {formatDate(generatedAt)}.</p>
          <p className="mt-1">For official transcripts, contact the Registrar&apos;s Office. This record is subject to FERPA.</p>
        </div>

      </div>
    </>
  );
}
