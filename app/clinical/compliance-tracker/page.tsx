'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Shield,
  Users,
  Search,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Download,
  Upload,
  Check,
  FileText,
} from 'lucide-react';
import { canAccessClinical, hasMinRole, type Role } from '@/lib/permissions';
import { useToast } from '@/components/Toast';

interface CohortOption {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

interface DocType {
  id: string;
  name: string;
  description: string | null;
  expiration_months: number | null;
  is_required: boolean;
}

interface StudentRecord {
  student: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
  };
  doc_statuses: Record<string, string>;
  complete_count: number;
  total: number;
  percent: number;
}

interface DocSummary {
  doc_type: DocType;
  complete_count: number;
  total: number;
  percent: number;
}

type FilterMode = 'all' | 'missing' | 'expiring';

// Modal to update a single student/doc cell
interface UpdateModalProps {
  studentName: string;
  docType: DocType;
  currentStatus: string;
  onSave: (status: string, expDate: string, notes: string) => Promise<void>;
  onClose: () => void;
}

function UpdateModal({ studentName, docType, currentStatus, onSave, onClose }: UpdateModalProps) {
  const [status, setStatus] = useState<string>(currentStatus === 'missing' ? 'complete' : currentStatus);
  const [expDate, setExpDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    await onSave(status, expDate, notes);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="p-5 border-b dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Update Document
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {docType.name} — {studentName}
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            >
              <option value="complete">Complete</option>
              <option value="missing">Missing</option>
              <option value="expiring">Expiring Soon</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          {docType.expiration_months && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expiration Date
              </label>
              <input
                type="date"
                value={expDate}
                onChange={e => setExpDate(e.target.value)}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
            />
          </div>
        </div>
        <div className="p-5 border-t dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ComplianceTrackerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [selectedCohort, setSelectedCohort] = useState('');
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [userRole, setUserRole] = useState<Role | null>(null);

  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [studentRows, setStudentRows] = useState<StudentRecord[]>([]);
  const [docSummary, setDocSummary] = useState<DocSummary[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  // Update modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStudent, setModalStudent] = useState<StudentRecord | null>(null);
  const [modalDocType, setModalDocType] = useState<DocType | null>(null);
  const [modalCurrentStatus, setModalCurrentStatus] = useState('missing');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchInitialData();
    }
  }, [session]);

  useEffect(() => {
    if (selectedCohort) {
      fetchCohortData();
    }
  }, [selectedCohort]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const userRes = await fetch('/api/instructor/me');
      const userData = await userRes.json();
      if (userData.success && userData.user) {
        setUserRole(userData.user.role);
        if (!canAccessClinical(userData.user.role)) {
          router.push('/');
          return;
        }
      }

      const cohortsRes = await fetch('/api/lab-management/cohorts?activeOnly=true');
      const cohortsData = await cohortsRes.json();
      if (cohortsData.success) {
        setCohorts(cohortsData.cohorts || []);
        if (cohortsData.cohorts?.length > 0) {
          setSelectedCohort(cohortsData.cohorts[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
    setLoading(false);
  };

  const fetchCohortData = async () => {
    setDataLoading(true);
    try {
      const res = await fetch(`/api/compliance?cohort_id=${selectedCohort}`);
      const data = await res.json();
      if (data.success) {
        setDocTypes(data.doc_types || []);
        setStudentRows(data.student_rows || []);
        setDocSummary(data.doc_summary || []);
      } else {
        console.error('Compliance fetch error:', data.error);
        toast.error('Failed to load compliance data');
      }
    } catch (error) {
      console.error('Error fetching cohort compliance:', error);
      toast.error('Failed to load compliance data');
    }
    setDataLoading(false);
  };

  const openUpdateModal = (row: StudentRecord, docType: DocType) => {
    setModalStudent(row);
    setModalDocType(docType);
    setModalCurrentStatus(row.doc_statuses[docType.id] || 'missing');
    setModalOpen(true);
  };

  const handleModalSave = async (status: string, expDate: string, notes: string) => {
    if (!modalStudent || !modalDocType) return;
    try {
      const res = await fetch('/api/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: modalStudent.student.id,
          doc_type_id: modalDocType.id,
          status,
          expiration_date: expDate || null,
          notes: notes || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Document updated');
        setModalOpen(false);
        await fetchCohortData();
      } else {
        toast.error('Failed to save: ' + data.error);
      }
    } catch (error) {
      console.error('Error saving compliance:', error);
      toast.error('Failed to save document');
    }
  };

  const exportCSV = () => {
    if (studentRows.length === 0) return;

    const headers = ['Student Name', ...docTypes.map(dt => dt.name), 'Overall %'];
    const rows = filteredRows.map(row => [
      `${row.student.last_name}, ${row.student.first_name}`,
      ...docTypes.map(dt => {
        const s = row.doc_statuses[dt.id] || 'missing';
        return s === 'complete' ? 'Complete' : s === 'expiring' ? 'Expiring' : s === 'expired' ? 'Expired' : 'Missing';
      }),
      `${row.percent}%`,
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-${selectedCohort}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  // Filter
  const filteredRows = studentRows.filter(row => {
    if (searchQuery) {
      const name = `${row.student.first_name} ${row.student.last_name}`.toLowerCase();
      if (!name.includes(searchQuery.toLowerCase())) return false;
    }
    if (filterMode === 'missing') {
      const hasMissing = Object.values(row.doc_statuses).some(s => s === 'missing' || s === 'expired') ||
        docTypes.some(dt => !row.doc_statuses[dt.id]);
      if (!hasMissing) return false;
    }
    if (filterMode === 'expiring') {
      const hasExpiring = Object.values(row.doc_statuses).some(s => s === 'expiring');
      if (!hasExpiring) return false;
    }
    return true;
  });

  const canEdit = userRole && hasMinRole(userRole, 'instructor');

  const getStatusIcon = (status: string) => {
    if (status === 'complete') return <CheckCircle className="w-4 h-4 text-green-500 dark:text-green-400" />;
    if (status === 'expiring') return <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />;
    return <XCircle className="w-4 h-4 text-red-500 dark:text-red-400" />;
  };

  const getDocTypeColor = (pct: number) => {
    if (pct === 100) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
    if (pct >= 75) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
    return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!session) return null;

  // Overall stats
  const totalStudents = studentRows.length;
  const fullyCompliant = studentRows.filter(r => r.percent === 100).length;
  const overallPct = totalStudents > 0
    ? Math.round(studentRows.reduce((acc, r) => acc + r.percent, 0) / totalStudents)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-full mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/clinical" className="hover:text-teal-600 dark:hover:text-teal-400">Clinical</Link>
            <ChevronRight className="w-4 h-4" />
            <span>Compliance Tracker</span>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                <Shield className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Student Compliance Tracker</h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Track required documents across your cohort</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">{overallPct}%</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Avg Compliance</div>
              </div>
              <button
                onClick={exportCSV}
                disabled={filteredRows.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-full mx-auto px-4 py-6 space-y-4">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-400" />
              <select
                value={selectedCohort}
                onChange={e => setSelectedCohort(e.target.value)}
                className="px-3 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 min-w-[200px]"
              >
                <option value="">Select Cohort</option>
                {cohorts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.program?.abbreviation || 'PMD'} Group {c.cohort_number}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search student..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              />
            </div>

            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
              {(['all', 'missing', 'expiring'] as FilterMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setFilterMode(mode)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    filterMode === mode
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {mode === 'all' ? 'All' : mode === 'missing' ? 'Missing/Expired' : 'Expiring Soon'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {docSummary.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {docSummary.map(summary => (
              <div
                key={summary.doc_type.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-3"
              >
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate" title={summary.doc_type.name}>
                  {summary.doc_type.name}
                </div>
                <div className={`text-xl font-bold ${
                  summary.percent === 100 ? 'text-green-600 dark:text-green-400' :
                  summary.percent >= 75 ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-red-600 dark:text-red-400'
                }`}>
                  {summary.percent}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {summary.complete_count}/{summary.total} complete
                </div>
                <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      summary.percent === 100 ? 'bg-green-500' :
                      summary.percent >= 75 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${summary.percent}%` }}
                  />
                </div>
              </div>
            ))}

            {/* Overall summary card */}
            {totalStudents > 0 && (
              <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg shadow p-3">
                <div className="text-xs text-teal-600 dark:text-teal-400 mb-1 font-medium">Fully Compliant</div>
                <div className="text-xl font-bold text-teal-700 dark:text-teal-300">
                  {fullyCompliant}/{totalStudents}
                </div>
                <div className="text-xs text-teal-600 dark:text-teal-400">students</div>
                <div className="mt-2 h-1.5 bg-teal-200 dark:bg-teal-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-500 rounded-full"
                    style={{ width: totalStudents > 0 ? `${Math.round((fullyCompliant / totalStudents) * 100)}%` : '0%' }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Student Table */}
        {selectedCohort ? (
          dataLoading ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto" />
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700 z-10 min-w-[160px]">
                        Student
                      </th>
                      {docTypes.map(dt => (
                        <th
                          key={dt.id}
                          className="px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap max-w-[80px]"
                          title={dt.description || dt.name}
                        >
                          <span className="truncate block max-w-[80px]">{dt.name}</span>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[100px]">
                        Overall
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={docTypes.length + 2} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                          {studentRows.length === 0 ? 'No students in this cohort' : 'No students match the current filter'}
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map(row => (
                        <tr key={row.student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 z-10">
                            <Link
                              href={`/lab-management/students/${row.student.id}`}
                              className="font-medium text-blue-600 dark:text-blue-400 hover:underline text-sm"
                            >
                              {row.student.last_name}, {row.student.first_name}
                            </Link>
                          </td>
                          {docTypes.map(dt => {
                            const docStatus = row.doc_statuses[dt.id] || 'missing';
                            return (
                              <td key={dt.id} className="px-2 py-3 text-center">
                                <button
                                  onClick={() => canEdit && openUpdateModal(row, dt)}
                                  disabled={!canEdit}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-colors ${
                                    canEdit
                                      ? 'hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer'
                                      : 'cursor-default'
                                  }`}
                                  title={`${dt.name}: ${docStatus}`}
                                >
                                  {getStatusIcon(docStatus)}
                                </button>
                              </td>
                            );
                          })}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden min-w-[48px]">
                                <div
                                  className={`h-full transition-all rounded-full ${
                                    row.percent === 100 ? 'bg-green-500' :
                                    row.percent >= 75 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${row.percent}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 dark:text-gray-400 w-9 text-right shrink-0">
                                {row.percent}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <Shield className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Select a cohort to view compliance documents</p>
          </div>
        )}
      </main>

      {/* Update Modal */}
      {modalOpen && modalStudent && modalDocType && (
        <UpdateModal
          studentName={`${modalStudent.student.first_name} ${modalStudent.student.last_name}`}
          docType={modalDocType}
          currentStatus={modalCurrentStatus}
          onSave={handleModalSave}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
