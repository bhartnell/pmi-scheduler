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
  AlertCircle,
  CheckCircle,
  BarChart3,
  Layout,
  UserPlus,
  Edit2,
  UserMinus,
  UserCheck,
  Eye,
  EyeOff,
  Download,
  Mail,
  Send,
  X,
  Archive,
  ArchiveRestore,
  FileText
} from 'lucide-react';
import ExportDropdown from '@/components/ExportDropdown';
import FieldTripAttendance from '@/components/FieldTripAttendance';
import BulkPhotoUpload from '@/components/BulkPhotoUpload';
import { useToast } from '@/components/Toast';
import type { ExportConfig } from '@/lib/export-utils';

interface ArchiveSummary {
  cohort_name: string;
  program: { id: string; name: string; abbreviation: string } | null;
  start_date: string | null;
  expected_end_date: string | null;
  completion_date: string;
  total_students: number;
  total_lab_days: number;
  total_scenarios_assessed: number;
  total_skills_completed: number;
  attendance_rate: number;
  students: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    agency: string | null;
    status: string;
    skills_completed: number;
    scenarios_completed: number;
  }>;
}

interface Cohort {
  id: string;
  cohort_number: number;
  start_date: string | null;
  expected_end_date: string | null;
  is_active: boolean;
  archived_at: string | null;
  archived_by: string | null;
  archive_summary: ArchiveSummary | null;
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
  email: string | null;
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
  icon: React.ComponentType<{ className?: string }>;
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
  const [withdrawnStudents, setWithdrawnStudents] = useState<Student[]>([]);
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const [removingStudent, setRemovingStudent] = useState<Student | null>(null);
  const [processing, setProcessing] = useState(false);
  const [learningStyles, setLearningStyles] = useState<LearningStyle[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailCcDirectors, setEmailCcDirectors] = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  // Bulk photo upload modal state
  const [showBulkPhotoUpload, setShowBulkPhotoUpload] = useState(false);

  // Archive modal state
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [archiving, setArchiving] = useState(false);

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

      // Fetch active students
      const studentsRes = await fetch(`/api/lab-management/students?cohortId=${cohortId}&status=active`);
      const studentsData = await studentsRes.json();
      if (studentsData.success) {
        setStudents(studentsData.students || []);
      }

      // Fetch withdrawn students
      const withdrawnRes = await fetch(`/api/lab-management/students?cohortId=${cohortId}&status=withdrawn`);
      const withdrawnData = await withdrawnRes.json();
      if (withdrawnData.success) {
        setWithdrawnStudents(withdrawnData.students || []);
      }

      // Fetch learning styles
      const lsRes = await fetch(`/api/seating/learning-styles?cohortId=${cohortId}`);
      const lsData = await lsRes.json();
      if (lsData.success) {
        setLearningStyles(lsData.learningStyles?.map((ls: { student_id: string; primary_style: string; social_style: string }) => ({
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

  const handleRemoveStudent = async () => {
    if (!removingStudent) return;

    setProcessing(true);
    try {
      const res = await fetch(`/api/lab-management/students/${removingStudent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'withdrawn' })
      });

      if (res.ok) {
        // Move student from students to withdrawnStudents
        setStudents(prev => prev.filter(s => s.id !== removingStudent.id));
        setWithdrawnStudents(prev => [...prev, { ...removingStudent, status: 'withdrawn' }]);
        setRemovingStudent(null);
        toast.success(`${removingStudent.first_name} ${removingStudent.last_name} removed from cohort`);
      } else {
        console.error('Failed to remove student');
        toast.error('Failed to remove student. Please try again.');
      }
    } catch (error) {
      console.error('Error removing student:', error);
      toast.error('An error occurred. Please try again.');
    }
    setProcessing(false);
  };

  const handleRestoreStudent = async (student: Student) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/lab-management/students/${student.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' })
      });

      if (res.ok) {
        // Move student from withdrawnStudents to students
        setWithdrawnStudents(prev => prev.filter(s => s.id !== student.id));
        setStudents(prev => [...prev, { ...student, status: 'active' }]);
        toast.success(`${student.first_name} ${student.last_name} restored to active`);
      } else {
        console.error('Failed to restore student');
        toast.error('Failed to restore student. Please try again.');
      }
    } catch (error) {
      console.error('Error restoring student:', error);
      toast.error('An error occurred. Please try again.');
    }
    setProcessing(false);
  };

  const handleSendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) return;

    setEmailSending(true);
    try {
      const res = await fetch(`/api/lab-management/cohorts/${cohortId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: emailSubject.trim(),
          body: emailBody.trim(),
          cc_directors: emailCcDirectors,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to send emails');
        setEmailSending(false);
        return;
      }

      // Build success message
      let message = `Email sent to ${data.sent} student${data.sent !== 1 ? 's' : ''}`;
      if (data.skipped > 0) {
        message += `. ${data.skipped} skipped (no email address)`;
      }
      if (data.failed > 0) {
        message += `. ${data.failed} failed`;
      }

      toast.success(message);

      if (data.skipped > 0) {
        toast.warning(`${data.skipped} student${data.skipped !== 1 ? 's have' : ' has'} no email address on file`);
      }

      // Close modal and reset
      setShowEmailModal(false);
      setEmailSubject('');
      setEmailBody('');
      setEmailCcDirectors(false);
    } catch (error) {
      console.error('Error sending cohort email:', error);
      toast.error('An error occurred while sending emails');
    }
    setEmailSending(false);
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      const res = await fetch(`/api/lab-management/cohorts/${cohortId}/archive`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setCohort(data.cohort);
        setShowArchiveDialog(false);
        toast.success(`${cohortLabel} has been archived`);
      } else {
        toast.error('Failed to archive: ' + data.error);
      }
    } catch (error) {
      console.error('Error archiving cohort:', error);
      toast.error('An error occurred while archiving');
    }
    setArchiving(false);
  };

  const handleUnarchive = async () => {
    try {
      const res = await fetch(`/api/lab-management/cohorts/${cohortId}/archive`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setCohort(data.cohort);
        toast.success(`${cohortLabel} has been unarchived`);
      } else {
        toast.error('Failed to unarchive: ' + data.error);
      }
    } catch (error) {
      console.error('Error unarchiving cohort:', error);
      toast.error('An error occurred while unarchiving');
    }
  };

  const handleExportCSV = () => {
    if (students.length === 0) return;

    // Google Contacts CSV format
    // Ref: https://support.google.com/contacts/answer/1069522
    const csvRows = [
      ['Name', 'Given Name', 'Family Name', 'Group Membership', 'E-mail 1 - Value', 'Phone 1 - Value'],
      ...students.map(s => [
        `${s.first_name} ${s.last_name}`,
        s.first_name,
        s.last_name,
        cohortLabel,
        s.email || '',
        '' // Phone not stored in student records
      ])
    ];

    const csvContent = csvRows.map(row =>
      row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    // Add BOM for proper Excel/Google Sheets UTF-8 encoding
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${cohortLabel.replace(/\s+/g, '-').toLowerCase()}-google-contacts.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

  const studentsWithEmail = students.filter(s => s.email);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2 overflow-x-auto whitespace-nowrap">
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

            <div className="flex flex-wrap gap-2">
              {!cohort.archived_at && (
                <>
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
                </>
              )}
              <button
                onClick={() => setShowEmailModal(true)}
                disabled={students.length === 0 || !!cohort.archived_at}
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title={cohort.archived_at ? 'Cannot email archived cohort' : 'Send email to all students in cohort'}
              >
                <Mail className="w-4 h-4" />
                Email Cohort
              </button>
              <button
                onClick={handleExportCSV}
                disabled={students.length === 0}
                className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 text-sm text-gray-700 dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Export CSV for Gmail Contacts"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <ExportDropdown config={exportConfig} disabled={students.length === 0} />
              {cohort.archived_at ? (
                <button
                  onClick={handleUnarchive}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 text-sm"
                  title="Unarchive this cohort"
                >
                  <ArchiveRestore className="w-4 h-4" />
                  Unarchive
                </button>
              ) : (
                <button
                  onClick={() => setShowArchiveDialog(true)}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-sm"
                  title="Archive this cohort"
                >
                  <Archive className="w-4 h-4" />
                  Archive
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Archived Banner */}
        {cohort.archived_at && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Archive className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800 dark:text-amber-300">This cohort is archived</h3>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                  Archived on {new Date(cohort.archived_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  {cohort.archived_by && ` by ${cohort.archived_by}`}.
                  Editing is disabled. Use the Unarchive button to restore this cohort.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Archive Summary (shown when archived) */}
        {cohort.archived_at && cohort.archive_summary && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              Archive Summary
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{cohort.archive_summary.total_students}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Students</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{cohort.archive_summary.total_lab_days}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Lab Days</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{cohort.archive_summary.total_scenarios_assessed}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Scenarios Run</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{cohort.archive_summary.total_skills_completed}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Skills Passed</div>
              </div>
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{cohort.archive_summary.attendance_rate}%</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Attendance Rate</div>
              </div>
            </div>
            {cohort.archive_summary.students.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Student Summary</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b dark:border-gray-700">
                        <th className="text-left py-2 pr-4 text-gray-600 dark:text-gray-400 font-medium">Student</th>
                        <th className="text-left py-2 pr-4 text-gray-600 dark:text-gray-400 font-medium">Agency</th>
                        <th className="text-left py-2 pr-4 text-gray-600 dark:text-gray-400 font-medium">Status</th>
                        <th className="text-right py-2 pr-4 text-gray-600 dark:text-gray-400 font-medium">Skills</th>
                        <th className="text-right py-2 text-gray-600 dark:text-gray-400 font-medium">Scenarios</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {cohort.archive_summary.students.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="py-2 pr-4 text-gray-900 dark:text-white">{s.first_name} {s.last_name}</td>
                          <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">{s.agency || '-'}</td>
                          <td className="py-2 pr-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-right text-gray-700 dark:text-gray-300">{s.skills_completed}</td>
                          <td className="py-2 text-right text-gray-700 dark:text-gray-300">{s.scenarios_completed}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

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
              title="Completion Report"
              status={stats?.totalStudents ? `${stats.totalStudents} students tracked` : 'View program completion'}
              actionLabel="View Report"
              href={`/lab-management/cohorts/${cohortId}/completion`}
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
          <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                Students ({students.length})
              </h2>
              {withdrawnStudents.length > 0 && (
                <button
                  onClick={() => setShowWithdrawn(!showWithdrawn)}
                  className="inline-flex items-center gap-2 px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {showWithdrawn ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showWithdrawn ? 'Hide' : 'Show'} Withdrawn ({withdrawnStudents.length})
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {students.length > 0 && (
                <button
                  onClick={() => setShowBulkPhotoUpload(true)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  title="Upload photos for multiple students at once"
                >
                  <Camera className="w-4 h-4" />
                  Upload Photos
                </button>
              )}
              <Link
                href={`/lab-management/students?cohortId=${cohortId}`}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                View All &rarr;
              </Link>
            </div>
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
                  <div
                    key={student.id}
                    className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 group"
                  >
                    <Link
                      href={`/lab-management/students/${student.id}`}
                      className="flex items-center gap-4 flex-1 min-w-0"
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
                    </Link>

                    {/* Remove button */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setRemovingStudent(student);
                      }}
                      className="flex-shrink-0 p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      title="Remove from cohort"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>

                    <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          )}

          {/* Withdrawn Students */}
          {showWithdrawn && withdrawnStudents.length > 0 && (
            <div className="border-t dark:border-gray-700">
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <UserMinus className="w-4 h-4" />
                  Withdrawn Students ({withdrawnStudents.length})
                </h3>
              </div>
              <div className="divide-y dark:divide-gray-700 max-h-64 overflow-y-auto">
                {withdrawnStudents.map((student) => {
                  const ls = getLearningStyle(student.id);
                  return (
                    <div
                      key={student.id}
                      className="flex items-center gap-4 p-4 opacity-60 hover:opacity-100 transition-opacity bg-gray-50/50 dark:bg-gray-900/30"
                    >
                      <Link
                        href={`/lab-management/students/${student.id}`}
                        className="flex items-center gap-4 flex-1 min-w-0"
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
                          <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            {student.first_name} {student.last_name}
                            <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs font-medium">
                              Withdrawn
                            </span>
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
                      </Link>

                      {/* Restore button */}
                      <button
                        onClick={() => handleRestoreStudent(student)}
                        disabled={processing}
                        className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg border border-green-300 dark:border-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Restore to active"
                      >
                        <UserCheck className="w-4 h-4" />
                        Restore
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bulk Photo Upload Modal */}
      {showBulkPhotoUpload && (
        <BulkPhotoUpload
          students={students}
          onComplete={fetchData}
          onClose={() => setShowBulkPhotoUpload(false)}
        />
      )}

      {/* Email Cohort Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Email Cohort
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {cohortLabel}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEmailModal(false)}
                disabled={emailSending}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Enter email subject..."
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={emailSending}
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Message
                </label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Write your message here..."
                  rows={8}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  disabled={emailSending}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Line breaks will be preserved in the email.
                </p>
              </div>

              {/* CC Directors */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <input
                  type="checkbox"
                  id="cc-directors"
                  checked={emailCcDirectors}
                  onChange={(e) => setEmailCcDirectors(e.target.checked)}
                  disabled={emailSending}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="cc-directors" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  CC directors and admins (lead instructors, admins, superadmins)
                </label>
              </div>

              {/* Recipients Preview */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Recipients ({studentsWithEmail.length} of {students.length} students have email)
                </h4>
                <div className="border dark:border-gray-600 rounded-lg max-h-48 overflow-y-auto">
                  {students.length === 0 ? (
                    <p className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">No students in cohort</p>
                  ) : (
                    <div className="divide-y dark:divide-gray-700">
                      {students.map((student) => (
                        <div key={student.id} className="flex items-center justify-between px-3 py-2">
                          <span className="text-sm text-gray-800 dark:text-gray-200">
                            {student.first_name} {student.last_name}
                          </span>
                          {student.email ? (
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate max-w-[12rem]">
                              {student.email}
                            </span>
                          ) : (
                            <span className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              No email
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {students.some(s => !s.email) && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Students without an email address will be skipped.
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-6 border-t dark:border-gray-700 gap-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Sending to {studentsWithEmail.length} student{studentsWithEmail.length !== 1 ? 's' : ''}
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEmailModal(false)}
                  disabled={emailSending}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={emailSending || !emailSubject.trim() || !emailBody.trim() || studentsWithEmail.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {emailSending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Email
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove Student Confirmation Modal */}
      {removingStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Remove from Cohort?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Remove {removingStudent.first_name} {removingStudent.last_name} from {cohortLabel}? Their data will be preserved and they can be re-added later.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setRemovingStudent(null)}
                disabled={processing}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveStudent}
                disabled={processing}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Removing...
                  </>
                ) : (
                  <>
                    <UserMinus className="w-4 h-4" />
                    Remove
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Dialog */}
      {showArchiveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <Archive className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Archive {cohortLabel}?
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{cohort.program.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowArchiveDialog(false)}
                disabled={archiving}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                This will hide the cohort from default views and prevent editing. A summary report will be generated and stored.
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                You can unarchive it later from the archived cohorts view.
              </p>

              {/* Current stats preview */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">{students.length}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Active Students</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">{withdrawnStudents.length}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Withdrawn Students</div>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
                <p className="text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  The cohort will be marked inactive and hidden from all default cohort lists.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 justify-end p-6 border-t dark:border-gray-700">
              <button
                onClick={() => setShowArchiveDialog(false)}
                disabled={archiving}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleArchive}
                disabled={archiving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {archiving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Archiving...
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4" />
                    Archive Cohort
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
