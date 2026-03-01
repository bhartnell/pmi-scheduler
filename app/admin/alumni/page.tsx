'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Home,
  ChevronRight,
  GraduationCap,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Search,
  Filter,
  Download,
  UserPlus,
  Briefcase,
  BookOpen,
  Phone,
  Mail,
  Building2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { PageLoader } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { CurrentUser } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EmploymentStatus = 'employed' | 'seeking' | 'continuing_education' | 'unknown';

interface Cohort {
  id: string;
  name: string;
  program: string | null;
}

interface Alumni {
  id: string;
  student_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  graduation_date: string | null;
  cohort_id: string | null;
  cohort: Cohort | null;
  employment_status: EmploymentStatus;
  employer: string | null;
  job_title: string | null;
  continuing_education: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  cohort_id: string | null;
  cohort: Cohort | null;
  status: string;
}

interface AlumniFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  graduation_date: string;
  cohort_id: string;
  employment_status: EmploymentStatus;
  employer: string;
  job_title: string;
  continuing_education: string;
  notes: string;
  student_id: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMPLOYMENT_STATUS_CONFIG: Record<
  EmploymentStatus,
  { label: string; bg: string; text: string; icon: typeof Briefcase }
> = {
  employed: {
    label: 'Employed',
    bg: 'bg-green-100 dark:bg-green-900/40',
    text: 'text-green-800 dark:text-green-300',
    icon: Briefcase,
  },
  seeking: {
    label: 'Seeking',
    bg: 'bg-yellow-100 dark:bg-yellow-900/40',
    text: 'text-yellow-800 dark:text-yellow-300',
    icon: Search,
  },
  continuing_education: {
    label: 'Continuing Education',
    bg: 'bg-blue-100 dark:bg-blue-900/40',
    text: 'text-blue-800 dark:text-blue-300',
    icon: BookOpen,
  },
  unknown: {
    label: 'Unknown',
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-700 dark:text-gray-300',
    icon: AlertCircle,
  },
};

const EMPTY_FORM: AlumniFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  graduation_date: '',
  cohort_id: '',
  employment_status: 'unknown',
  employer: '',
  job_title: '',
  continuing_education: '',
  notes: '',
  student_id: '',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function exportCSV(alumni: Alumni[]) {
  const headers = [
    'Last Name',
    'First Name',
    'Email',
    'Phone',
    'Graduation Date',
    'Cohort',
    'Employment Status',
    'Employer',
    'Job Title',
    'Continuing Education',
    'Notes',
  ];

  const rows = alumni.map((a) => [
    a.last_name,
    a.first_name,
    a.email ?? '',
    a.phone ?? '',
    a.graduation_date ?? '',
    a.cohort?.name ?? '',
    EMPLOYMENT_STATUS_CONFIG[a.employment_status]?.label ?? a.employment_status,
    a.employer ?? '',
    a.job_title ?? '',
    a.continuing_education ?? '',
    a.notes ?? '',
  ]);

  const csvContent = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `alumni_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmploymentBadge({ status }: { status: EmploymentStatus }) {
  const config = EMPLOYMENT_STATUS_CONFIG[status] ?? EMPLOYMENT_STATUS_CONFIG.unknown;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {config.label}
    </span>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alumni Form Modal
// ---------------------------------------------------------------------------

function AlumniModal({
  open,
  editRecord,
  cohorts,
  onClose,
  onSave,
}: {
  open: boolean;
  editRecord: Alumni | null;
  cohorts: Cohort[];
  onClose: () => void;
  onSave: (data: AlumniFormData) => Promise<void>;
}) {
  const [form, setForm] = useState<AlumniFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (editRecord) {
        setForm({
          first_name: editRecord.first_name,
          last_name: editRecord.last_name,
          email: editRecord.email ?? '',
          phone: editRecord.phone ?? '',
          graduation_date: editRecord.graduation_date ?? '',
          cohort_id: editRecord.cohort_id ?? '',
          employment_status: editRecord.employment_status,
          employer: editRecord.employer ?? '',
          job_title: editRecord.job_title ?? '',
          continuing_education: editRecord.continuing_education ?? '',
          notes: editRecord.notes ?? '',
          student_id: editRecord.student_id ?? '',
        });
      } else {
        setForm(EMPTY_FORM);
      }
      setTimeout(() => firstFieldRef.current?.focus(), 50);
    }
  }, [open, editRecord]);

  const set = (field: keyof AlumniFormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={editRecord ? 'Edit Alumni Record' : 'Add Alumni Record'}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {editRecord ? 'Edit Alumni Record' : 'Add Alumni Record'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="alumni-first-name" className={labelClass}>
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                ref={firstFieldRef}
                id="alumni-first-name"
                type="text"
                value={form.first_name}
                onChange={(e) => set('first_name', e.target.value)}
                className={inputClass}
                required
                placeholder="Jane"
              />
            </div>
            <div>
              <label htmlFor="alumni-last-name" className={labelClass}>
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                id="alumni-last-name"
                type="text"
                value={form.last_name}
                onChange={(e) => set('last_name', e.target.value)}
                className={inputClass}
                required
                placeholder="Smith"
              />
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="alumni-email" className={labelClass}>
                Email
              </label>
              <input
                id="alumni-email"
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                className={inputClass}
                placeholder="jane@example.com"
              />
            </div>
            <div>
              <label htmlFor="alumni-phone" className={labelClass}>
                Phone
              </label>
              <input
                id="alumni-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                className={inputClass}
                placeholder="(555) 000-0000"
              />
            </div>
          </div>

          {/* Cohort & Graduation Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="alumni-cohort" className={labelClass}>
                Cohort
              </label>
              <select
                id="alumni-cohort"
                value={form.cohort_id}
                onChange={(e) => set('cohort_id', e.target.value)}
                className={inputClass}
              >
                <option value="">-- No cohort --</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="alumni-grad-date" className={labelClass}>
                Graduation Date
              </label>
              <input
                id="alumni-grad-date"
                type="date"
                value={form.graduation_date}
                onChange={(e) => set('graduation_date', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Employment */}
          <div>
            <label htmlFor="alumni-emp-status" className={labelClass}>
              Employment Status
            </label>
            <select
              id="alumni-emp-status"
              value={form.employment_status}
              onChange={(e) => set('employment_status', e.target.value as EmploymentStatus)}
              className={inputClass}
            >
              <option value="unknown">Unknown</option>
              <option value="employed">Employed</option>
              <option value="seeking">Seeking Employment</option>
              <option value="continuing_education">Continuing Education</option>
            </select>
          </div>

          {form.employment_status === 'employed' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="alumni-employer" className={labelClass}>
                  Employer
                </label>
                <input
                  id="alumni-employer"
                  type="text"
                  value={form.employer}
                  onChange={(e) => set('employer', e.target.value)}
                  className={inputClass}
                  placeholder="Agency or hospital name"
                />
              </div>
              <div>
                <label htmlFor="alumni-job-title" className={labelClass}>
                  Job Title
                </label>
                <input
                  id="alumni-job-title"
                  type="text"
                  value={form.job_title}
                  onChange={(e) => set('job_title', e.target.value)}
                  className={inputClass}
                  placeholder="Paramedic"
                />
              </div>
            </div>
          )}

          {form.employment_status === 'continuing_education' && (
            <div>
              <label htmlFor="alumni-continuing-ed" className={labelClass}>
                Continuing Education Details
              </label>
              <input
                id="alumni-continuing-ed"
                type="text"
                value={form.continuing_education}
                onChange={(e) => set('continuing_education', e.target.value)}
                className={inputClass}
                placeholder="Program, institution, etc."
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label htmlFor="alumni-notes" className={labelClass}>
              Notes
            </label>
            <textarea
              id="alumni-notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              className={`${inputClass} resize-none`}
              rows={3}
              placeholder="Any additional information..."
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.first_name.trim() || !form.last_name.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editRecord ? 'Save Changes' : 'Add Alumni'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Convert Student Modal
// ---------------------------------------------------------------------------

function ConvertStudentModal({
  open,
  cohorts,
  onClose,
  onConvert,
}: {
  open: boolean;
  cohorts: Cohort[];
  onClose: () => void;
  onConvert: (data: AlumniFormData) => Promise<void>;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [form, setForm] = useState<AlumniFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  useEffect(() => {
    if (open) {
      setSelectedStudent(null);
      setForm(EMPTY_FORM);
      setStudentSearch('');
      fetchStudents();
    }
  }, [open]);

  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const res = await fetch('/api/admin/users?role=student&limit=500');
      const data = await res.json();
      if (data.success) {
        setStudents(data.users ?? []);
      }
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setForm({
      ...EMPTY_FORM,
      first_name: student.first_name,
      last_name: student.last_name,
      email: student.email ?? '',
      cohort_id: student.cohort_id ?? '',
      student_id: student.id,
      employment_status: 'unknown',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) return;
    setSaving(true);
    try {
      await onConvert(form);
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = studentSearch
    ? students.filter((s) => {
        const name = `${s.first_name} ${s.last_name}`.toLowerCase();
        return name.includes(studentSearch.toLowerCase());
      })
    : students;

  if (!open) return null;

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Convert Student to Alumni"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <UserPlus className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Convert Student to Alumni
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {!selectedStudent ? (
            // Step 1: pick a student
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select a student to pre-fill the alumni record. You can also add alumni manually
                without linking to a student account.
              </p>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search students..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {loadingStudents ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredStudents.length === 0 ? (
                    <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-6">
                      No students found.
                    </p>
                  ) : (
                    filteredStudents.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSelectStudent(s)}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        <p className="font-medium text-gray-900 dark:text-white text-sm">
                          {s.first_name} {s.last_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {s.email ?? 'No email'} &bull; {s.cohort?.name ?? 'No cohort'}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              )}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            // Step 2: fill in details
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Pre-filled from student record for{' '}
                  <strong>
                    {selectedStudent.first_name} {selectedStudent.last_name}
                  </strong>
                  .{' '}
                  <button
                    type="button"
                    onClick={() => setSelectedStudent(null)}
                    className="underline hover:no-underline"
                  >
                    Change
                  </button>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Cohort</label>
                  <select
                    value={form.cohort_id}
                    onChange={(e) => setForm((f) => ({ ...f, cohort_id: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">-- No cohort --</option>
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Graduation Date</label>
                  <input
                    type="date"
                    value={form.graduation_date}
                    onChange={(e) => setForm((f) => ({ ...f, graduation_date: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Employment Status</label>
                <select
                  value={form.employment_status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, employment_status: e.target.value as EmploymentStatus }))
                  }
                  className={inputClass}
                >
                  <option value="unknown">Unknown</option>
                  <option value="employed">Employed</option>
                  <option value="seeking">Seeking Employment</option>
                  <option value="continuing_education">Continuing Education</option>
                </select>
              </div>

              {form.employment_status === 'employed' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Employer</label>
                    <input
                      type="text"
                      value={form.employer}
                      onChange={(e) => setForm((f) => ({ ...f, employer: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Job Title</label>
                    <input
                      type="text"
                      value={form.job_title}
                      onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                </div>
              )}

              {form.employment_status === 'continuing_education' && (
                <div>
                  <label className={labelClass}>Continuing Education Details</label>
                  <input
                    type="text"
                    value={form.continuing_education}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, continuing_education: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>
              )}

              <div>
                <label className={labelClass}>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className={`${inputClass} resize-none`}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Alumni Record
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AlumniPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [alumni, setAlumni] = useState<Alumni[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [cohortFilter, setCohortFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [editRecord, setEditRecord] = useState<Alumni | null>(null);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Auth guard
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetchCurrentUser();
    }
  }, [session]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/instructor/me');
      const data = await res.json();
      if (data.success && data.user) {
        if (!canAccessAdmin(data.user.role)) {
          router.push('/admin');
          return;
        }
        setCurrentUser(data.user);
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  };

  const fetchCohorts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      if (data.cohorts) {
        setCohorts(data.cohorts);
        return;
      }
    } catch {
      // fallback below
    }
    // Fallback: fetch via broadcast endpoint which has cohorts
    try {
      const res = await fetch('/api/admin/broadcast');
      const data = await res.json();
      if (data.cohorts) {
        setCohorts(data.cohorts);
      }
    } catch (err) {
      console.error('Error fetching cohorts:', err);
    }
  }, []);

  const fetchAlumni = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (cohortFilter) params.set('cohort_id', cohortFilter);
        if (statusFilter) params.set('employment_status', statusFilter);

        const res = await fetch(`/api/admin/alumni?${params.toString()}`);
        const data = await res.json();
        if (data.success) {
          setAlumni(data.alumni);
        }
      } catch (err) {
        console.error('Error fetching alumni:', err);
      } finally {
        setLoading(false);
        if (isManual) setRefreshing(false);
      }
    },
    [search, cohortFilter, statusFilter]
  );

  useEffect(() => {
    if (currentUser) {
      fetchCohorts();
      fetchAlumni();
    }
  }, [currentUser, fetchAlumni, fetchCohorts]);

  const handleSave = async (formData: AlumniFormData) => {
    if (editRecord) {
      // Update
      const res = await fetch(`/api/admin/alumni/${editRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        setAlumni((prev) =>
          prev.map((a) => (a.id === editRecord.id ? data.alumni : a))
        );
        toast.success('Alumni record updated.');
        setShowAddModal(false);
        setEditRecord(null);
      } else {
        toast.error(data.error ?? 'Failed to update alumni record.');
      }
    } else {
      // Create
      const res = await fetch('/api/admin/alumni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        setAlumni((prev) => [data.alumni, ...prev]);
        toast.success('Alumni record created.');
        setShowAddModal(false);
      } else {
        toast.error(data.error ?? 'Failed to create alumni record.');
      }
    }
  };

  const handleConvert = async (formData: AlumniFormData) => {
    const res = await fetch('/api/admin/alumni', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    const data = await res.json();
    if (data.success) {
      setAlumni((prev) => [data.alumni, ...prev]);
      toast.success('Student converted to alumni record.');
      setShowConvertModal(false);
    } else {
      toast.error(data.error ?? 'Failed to create alumni record.');
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/alumni/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setAlumni((prev) => prev.filter((a) => a.id !== id));
        toast.success('Alumni record deleted.');
      } else {
        toast.error(data.error ?? 'Failed to delete alumni record.');
      }
    } catch (err) {
      toast.error('Failed to delete alumni record.');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  if (status === 'loading' || !currentUser) {
    return <PageLoader />;
  }

  // Compute stats from loaded data
  const employedCount = alumni.filter((a) => a.employment_status === 'employed').length;
  const seekingCount = alumni.filter((a) => a.employment_status === 'seeking').length;
  const continuingEduCount = alumni.filter(
    (a) => a.employment_status === 'continuing_education'
  ).length;

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
              <Link
                href="/"
                className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
              >
                <Home className="w-3 h-3" aria-hidden="true" />
                Home
              </Link>
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
              <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">
                Admin
              </Link>
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
              <span className="text-gray-900 dark:text-white">Alumni</span>
            </div>

            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <GraduationCap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Alumni Tracking
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    Track graduates: employment, contact info, and continuing education
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <ThemeToggle />
                <button
                  onClick={() => fetchAlumni(true)}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-sm transition-colors"
                  title="Refresh"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  Refresh
                </button>
                <button
                  onClick={() => exportCSV(alumni)}
                  disabled={alumni.length === 0}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-sm transition-colors"
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                  Export CSV
                </button>
                <button
                  onClick={() => setShowConvertModal(true)}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 text-sm font-medium transition-colors"
                >
                  <UserPlus className="w-4 h-4" aria-hidden="true" />
                  Convert Student
                </button>
                <button
                  onClick={() => {
                    setEditRecord(null);
                    setShowAddModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Add Alumni
                </button>
              </div>
            </div>
          </div>
        </div>

        <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 bg-white dark:bg-gray-800 rounded-xl" />
                ))}
              </div>
              <div className="h-16 bg-white dark:bg-gray-800 rounded-xl" />
              <div className="h-64 bg-white dark:bg-gray-800 rounded-xl" />
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard
                  label="Total Alumni"
                  value={alumni.length}
                  color="text-blue-600 dark:text-blue-400"
                />
                <StatCard
                  label="Employed"
                  value={employedCount}
                  color="text-green-600 dark:text-green-400"
                />
                <StatCard
                  label="Seeking"
                  value={seekingCount}
                  color="text-yellow-600 dark:text-yellow-400"
                />
                <StatCard
                  label="Continuing Ed"
                  value={continuingEduCount}
                  color="text-blue-500 dark:text-blue-300"
                />
              </div>

              {/* Filters */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" aria-hidden="true" />

                  {/* Search */}
                  <div className="relative flex-1 min-w-48">
                    <Search
                      className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by name or email..."
                      className="w-full pl-9 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Cohort filter */}
                  <select
                    value={cohortFilter}
                    onChange={(e) => setCohortFilter(e.target.value)}
                    className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Filter by cohort"
                  >
                    <option value="">All Cohorts</option>
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  {/* Status filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Filter by employment status"
                  >
                    <option value="">All Statuses</option>
                    <option value="employed">Employed</option>
                    <option value="seeking">Seeking</option>
                    <option value="continuing_education">Continuing Education</option>
                    <option value="unknown">Unknown</option>
                  </select>

                  {(search || cohortFilter || statusFilter) && (
                    <button
                      onClick={() => {
                        setSearch('');
                        setCohortFilter('');
                        setStatusFilter('');
                      }}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {alumni.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-center px-4">
                    <GraduationCap className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                    <p className="font-semibold text-gray-700 dark:text-gray-300">
                      No alumni records found
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                      {search || cohortFilter || statusFilter
                        ? 'Try adjusting your filters.'
                        : 'Add your first alumni record or convert a completed student.'}
                    </p>
                    {!search && !cohortFilter && !statusFilter && (
                      <div className="flex gap-2 mt-2 flex-wrap justify-center">
                        <button
                          onClick={() => {
                            setEditRecord(null);
                            setShowAddModal(true);
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                        >
                          <Plus className="w-4 h-4" />
                          Add Alumni
                        </button>
                        <button
                          onClick={() => setShowConvertModal(true)}
                          className="inline-flex items-center gap-2 px-4 py-2 border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 text-sm font-medium"
                        >
                          <UserPlus className="w-4 h-4" />
                          Convert Student
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                          <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                            Name
                          </th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 hidden sm:table-cell">
                            Contact
                          </th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 hidden md:table-cell">
                            Cohort / Grad Date
                          </th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                            Status
                          </th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 hidden lg:table-cell">
                            Employer / Details
                          </th>
                          <th className="text-right px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {alumni.map((a) => (
                          <tr
                            key={a.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                          >
                            {/* Name */}
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900 dark:text-white">
                                {a.last_name}, {a.first_name}
                              </p>
                              {a.notes && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-xs">
                                  {a.notes}
                                </p>
                              )}
                            </td>

                            {/* Contact */}
                            <td className="px-4 py-3 hidden sm:table-cell">
                              <div className="space-y-0.5">
                                {a.email && (
                                  <a
                                    href={`mailto:${a.email}`}
                                    className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline text-xs"
                                  >
                                    <Mail className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                                    {a.email}
                                  </a>
                                )}
                                {a.phone && (
                                  <a
                                    href={`tel:${a.phone}`}
                                    className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 text-xs"
                                  >
                                    <Phone className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                                    {a.phone}
                                  </a>
                                )}
                                {!a.email && !a.phone && (
                                  <span className="text-xs text-gray-400 dark:text-gray-500">
                                    No contact info
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Cohort / Grad */}
                            <td className="px-4 py-3 hidden md:table-cell">
                              <p className="text-gray-700 dark:text-gray-300 text-xs">
                                {a.cohort?.name ?? '—'}
                              </p>
                              <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                                {fmtDate(a.graduation_date)}
                              </p>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3">
                              <EmploymentBadge status={a.employment_status} />
                            </td>

                            {/* Employer / details */}
                            <td className="px-4 py-3 hidden lg:table-cell">
                              {a.employment_status === 'employed' && (
                                <div className="flex items-start gap-1 text-xs text-gray-700 dark:text-gray-300">
                                  <Building2
                                    className="w-3 h-3 flex-shrink-0 mt-0.5 text-gray-400"
                                    aria-hidden="true"
                                  />
                                  <div>
                                    {a.employer && <p>{a.employer}</p>}
                                    {a.job_title && (
                                      <p className="text-gray-500 dark:text-gray-400">
                                        {a.job_title}
                                      </p>
                                    )}
                                    {!a.employer && !a.job_title && (
                                      <span className="text-gray-400">No details</span>
                                    )}
                                  </div>
                                </div>
                              )}
                              {a.employment_status === 'continuing_education' &&
                                a.continuing_education && (
                                  <p className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-xs">
                                    {a.continuing_education}
                                  </p>
                                )}
                              {(a.employment_status === 'seeking' ||
                                a.employment_status === 'unknown') && (
                                <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => {
                                    setEditRecord(a);
                                    setShowAddModal(true);
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                  title="Edit"
                                  aria-label={`Edit ${a.first_name} ${a.last_name}`}
                                >
                                  <Pencil className="w-4 h-4" aria-hidden="true" />
                                </button>
                                <button
                                  onClick={() => setDeleteId(a.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                  title="Delete"
                                  aria-label={`Delete ${a.first_name} ${a.last_name}`}
                                >
                                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Footer count */}
                {alumni.length > 0 && (
                  <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                    Showing {alumni.length} alumni record{alumni.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Add / Edit Modal */}
      <AlumniModal
        open={showAddModal}
        editRecord={editRecord}
        cohorts={cohorts}
        onClose={() => {
          setShowAddModal(false);
          setEditRecord(null);
        }}
        onSave={handleSave}
      />

      {/* Convert Student Modal */}
      <ConvertStudentModal
        open={showConvertModal}
        cohorts={cohorts}
        onClose={() => setShowConvertModal(false)}
        onConvert={handleConvert}
      />

      {/* Delete Confirmation Dialog */}
      {deleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Delete"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDeleteId(null)}
            aria-hidden="true"
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Delete Alumni Record?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              This will permanently remove the alumni record. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
