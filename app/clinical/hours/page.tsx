'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Clock,
  Users,
  Search,
  Loader2,
  Save,
  Upload,
  X,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import { canAccessClinical, canEditClinical, type Role } from '@/lib/permissions';
import * as XLSX from 'xlsx';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

interface CohortOption {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

// Wide table structure - one row per student with all hours/shifts
interface StudentHours {
  id?: string;
  student_id: string;
  first_name?: string;
  last_name?: string;
  cohort_id?: string;
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
  total_hours: number;
  total_shifts: number;
}

// Department columns configuration - maps to wide table columns
// CCL in UI = cardiology in DB
const DEPT_COLUMNS = [
  { key: 'psych', label: 'Psych', fullName: 'Behavioral Health', hoursField: 'psych_hours', shiftsField: 'psych_shifts' },
  { key: 'ed', label: 'ED', fullName: 'Emergency Room', hoursField: 'ed_hours', shiftsField: 'ed_shifts' },
  { key: 'ems_field', label: 'EMS Field', fullName: 'EMS Field Experience', hoursField: 'ems_field_hours', shiftsField: 'ems_field_shifts' },
  { key: 'icu', label: 'ICU', fullName: 'Intensive Care Unit', hoursField: 'icu_hours', shiftsField: 'icu_shifts' },
  { key: 'ob', label: 'OB', fullName: 'Labor & Delivery', hoursField: 'ob_hours', shiftsField: 'ob_shifts' },
  { key: 'or', label: 'OR', fullName: 'Inpatient', hoursField: 'or_hours', shiftsField: 'or_shifts' },
  { key: 'peds_ed', label: 'Peds ED', fullName: 'Pediatric ED', hoursField: 'peds_ed_hours', shiftsField: 'peds_ed_shifts' },
  { key: 'peds_icu', label: 'Peds ICU', fullName: 'Pediatric ICU', hoursField: 'peds_icu_hours', shiftsField: 'peds_icu_shifts' },
  { key: 'cardiology', label: 'CCL', fullName: 'Cardiac Cath Lab', hoursField: 'cardiology_hours', shiftsField: 'cardiology_shifts' },
] as const;

interface ImportPreviewRow {
  name: string;
  matchedStudent: Student | null;
  data: Partial<StudentHours>;
}

export default function ClinicalHoursTrackerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [hoursData, setHoursData] = useState<StudentHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<Role | null>(null);

  const [selectedCohort, setSelectedCohort] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState({ shifts: 0, hours: 0 });

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

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
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const fetchCohortData = async () => {
    try {
      const [studentsRes, hoursRes] = await Promise.all([
        fetch(`/api/students?cohortId=${selectedCohort}`),
        fetch(`/api/clinical/hours?cohortId=${selectedCohort}`),
      ]);

      const studentsData = await studentsRes.json();
      const hoursDataRes = await hoursRes.json();

      if (studentsData.success) setStudents(studentsData.students || []);
      if (hoursDataRes.success) setHoursData(hoursDataRes.hours || []);
    } catch (error) {
      console.error('Error fetching cohort data:', error);
    }
  };

  const getStudentHours = (studentId: string): StudentHours | null => {
    return hoursData.find(h => h.student_id === studentId) || null;
  };

  const startEditing = (studentId: string, col: typeof DEPT_COLUMNS[number]) => {
    if (!userRole || !canEditClinical(userRole)) return;

    const existing = getStudentHours(studentId);
    setEditingCell(`${studentId}-${col.key}`);
    setEditValue({
      shifts: existing?.[col.shiftsField] || 0,
      hours: existing?.[col.hoursField] || 0,
    });
  };

  const saveHours = async (studentId: string, col: typeof DEPT_COLUMNS[number]) => {
    const cellKey = `${studentId}-${col.key}`;
    setSaving(cellKey);

    try {
      const updateData: Record<string, unknown> = {
        student_id: studentId,
        cohort_id: selectedCohort,
        [col.hoursField]: editValue.hours,
        [col.shiftsField]: editValue.shifts,
      };

      const res = await fetch('/api/clinical/hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (res.ok) {
        await fetchCohortData();
      } else {
        const errorData = await res.json();
        console.error('Error saving hours:', errorData);
      }
    } catch (error) {
      console.error('Error saving hours:', error);
    }
    setSaving(null);
    setEditingCell(null);
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditValue({ shifts: 0, hours: 0 });
  };

  // Filter students
  const filteredStudents = students.filter(student => {
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      const name = `${student.first_name} ${student.last_name}`.toLowerCase();
      if (!name.includes(search)) return false;
    }
    return true;
  });

  // Platinum Import Functions
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

      // Skip header rows (0-4), start from row 5
      const dataRows = jsonData.slice(5);

      // Filter out empty rows and the grand total row
      const validRows = dataRows.filter((row: unknown[]) => {
        const name = row[0];
        if (!name || typeof name !== 'string') return false;
        if (name.toLowerCase().includes('grand total')) return false;
        return true;
      });

      // Parse and match students
      const preview: ImportPreviewRow[] = validRows.map((row: unknown[]) => {
        const name = String(row[0] || '').trim();

        // Parse hours/shifts from columns
        // Cols 1-2: Behavioral (Hours, Shifts) → psych
        // Cols 3-4: Emergency Room → ed
        // Cols 5-6: EMS Field Experience → ems_field
        // Cols 7-8: ICU → icu
        // Cols 9-10: OB/Labor & Delivery → ob
        // Cols 11-12: OR Inpatient → or
        // Cols 13-14: Pediatric ED → peds_ed
        // Cols 15-16: Pediatric ICU → peds_icu
        const parseNum = (val: unknown): number => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string') return parseFloat(val) || 0;
          return 0;
        };

        const rowData: Partial<StudentHours> = {
          psych_hours: parseNum(row[1]),
          psych_shifts: parseNum(row[2]),
          ed_hours: parseNum(row[3]),
          ed_shifts: parseNum(row[4]),
          ems_field_hours: parseNum(row[5]),
          ems_field_shifts: parseNum(row[6]),
          icu_hours: parseNum(row[7]),
          icu_shifts: parseNum(row[8]),
          ob_hours: parseNum(row[9]),
          ob_shifts: parseNum(row[10]),
          or_hours: parseNum(row[11]),
          or_shifts: parseNum(row[12]),
          peds_ed_hours: parseNum(row[13]),
          peds_ed_shifts: parseNum(row[14]),
          peds_icu_hours: parseNum(row[15]),
          peds_icu_shifts: parseNum(row[16]),
        };

        // Try to match student by name
        const matchedStudent = matchStudentByName(name);

        return {
          name,
          matchedStudent,
          data: rowData,
        };
      });

      setImportPreview(preview);
      setShowImportModal(true);
    } catch (error) {
      console.error('Error parsing file:', error);
      setImportError('Failed to parse file. Please ensure it is a valid Excel file.');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const matchStudentByName = (importName: string): Student | null => {
    const normalizedImport = importName.toLowerCase().trim();

    // Try exact match first
    let match = students.find(s => {
      const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
      const reverseName = `${s.last_name} ${s.first_name}`.toLowerCase();
      const lastFirst = `${s.last_name}, ${s.first_name}`.toLowerCase();
      return fullName === normalizedImport ||
             reverseName === normalizedImport ||
             lastFirst === normalizedImport;
    });

    if (match) return match;

    // Try partial match (last name + first initial)
    match = students.find(s => {
      const lastName = s.last_name.toLowerCase();
      const firstInitial = s.first_name[0]?.toLowerCase();
      return normalizedImport.includes(lastName) &&
             normalizedImport.includes(firstInitial);
    });

    return match || null;
  };

  const executeImport = async () => {
    setImporting(true);
    setImportError(null);

    try {
      const matchedRows = importPreview.filter(row => row.matchedStudent);

      for (const row of matchedRows) {
        if (!row.matchedStudent) continue;

        const updateData = {
          student_id: row.matchedStudent.id,
          cohort_id: selectedCohort,
          ...row.data,
        };

        const res = await fetch('/api/clinical/hours', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        });

        if (!res.ok) {
          throw new Error(`Failed to import for ${row.name}`);
        }
      }

      // Refresh data
      await fetchCohortData();
      setShowImportModal(false);
      setImportPreview([]);
    } catch (error) {
      console.error('Import error:', error);
      setImportError('Failed to import some records. Please try again.');
    }

    setImporting(false);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!session) return null;

  const canEdit = userRole && canEditClinical(userRole);
  const unmatchedCount = importPreview.filter(r => !r.matchedStudent).length;
  const matchedCount = importPreview.filter(r => r.matchedStudent).length;

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
            <span>Clinical Hours</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clinical Hours Tracker</h1>
                <p className="text-gray-600 dark:text-gray-400">Track shifts and hours by department</p>
              </div>
            </div>
            {canEdit && selectedCohort && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Import from Platinum
                </button>
              </div>
            )}
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
                onChange={(e) => setSelectedCohort(e.target.value)}
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

            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
              />
            </div>

            <div className="text-sm text-gray-500 dark:text-gray-400">
              Click any cell to edit shifts/hours
            </div>
          </div>
        </div>

        {/* Grid Table */}
        {selectedCohort && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700 z-10">
                      Student
                    </th>
                    {DEPT_COLUMNS.map(col => (
                      <th
                        key={col.key}
                        className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                        title={col.fullName}
                      >
                        <div>{col.label}</div>
                        <div className="text-[10px] font-normal normal-case text-gray-400">{col.fullName}</div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-blue-50 dark:bg-blue-900/20">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={DEPT_COLUMNS.length + 2} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        No students found
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(student => {
                      const studentHours = getStudentHours(student.id);

                      return (
                        <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 z-10">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {student.first_name} {student.last_name}
                            </div>
                          </td>
                          {DEPT_COLUMNS.map(col => {
                            const hours = studentHours?.[col.hoursField] || 0;
                            const shifts = studentHours?.[col.shiftsField] || 0;
                            const cellKey = `${student.id}-${col.key}`;
                            const isEditing = editingCell === cellKey;
                            const isSaving = saving === cellKey;

                            return (
                              <td key={col.key} className="px-3 py-2 text-center">
                                {isEditing ? (
                                  <div className="flex flex-col gap-1 min-w-[80px]">
                                    <div className="text-[10px] text-gray-400 text-left">Shifts:</div>
                                    <input
                                      type="number"
                                      value={editValue.shifts}
                                      onChange={(e) => setEditValue({ ...editValue, shifts: parseInt(e.target.value) || 0 })}
                                      className="w-full px-2 py-1 text-xs border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                                      min="0"
                                    />
                                    <div className="text-[10px] text-gray-400 text-left">Hours:</div>
                                    <input
                                      type="number"
                                      value={editValue.hours}
                                      onChange={(e) => setEditValue({ ...editValue, hours: parseFloat(e.target.value) || 0 })}
                                      className="w-full px-2 py-1 text-xs border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                                      min="0"
                                      step="0.5"
                                    />
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => saveHours(student.id, col)}
                                        disabled={isSaving}
                                        className="flex-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                                      >
                                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : <Save className="w-3 h-3 mx-auto" />}
                                      </button>
                                      <button
                                        onClick={cancelEditing}
                                        className="flex-1 px-2 py-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                                      >
                                        X
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => startEditing(student.id, col)}
                                    disabled={!canEdit}
                                    className={`min-w-[60px] px-2 py-1 rounded text-xs transition-colors ${
                                      shifts > 0 || hours > 0
                                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                                    } ${canEdit ? 'hover:bg-blue-200 dark:hover:bg-blue-900/50 cursor-pointer' : 'cursor-not-allowed'}`}
                                  >
                                    {shifts > 0 || hours > 0 ? (
                                      <div>
                                        <div className="font-medium">{shifts}s</div>
                                        <div className="text-[10px]">{hours}h</div>
                                      </div>
                                    ) : (
                                      '-'
                                    )}
                                  </button>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-center bg-blue-50 dark:bg-blue-900/20">
                            <div className="font-semibold text-blue-700 dark:text-blue-300">
                              {studentHours?.total_shifts || 0}s / {studentHours?.total_hours || 0}h
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!selectedCohort && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Select a cohort to view clinical hours</p>
          </div>
        )}
      </main>

      {/* Import Preview Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Import Preview</h2>
              </div>
              <button
                onClick={() => { setShowImportModal(false); setImportPreview([]); }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              {importError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {importError}
                </div>
              )}

              <div className="mb-4 flex gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-gray-600 dark:text-gray-400">{matchedCount} matched</span>
                </div>
                {unmatchedCount > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    <span className="text-gray-600 dark:text-gray-400">{unmatchedCount} unmatched (will be skipped)</span>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto border rounded-lg border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Name (from file)</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Matched To</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Psych</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">ED</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">EMS</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">ICU</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">OB</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">OR</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Peds ED</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Peds ICU</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {importPreview.map((row, idx) => (
                      <tr
                        key={idx}
                        className={row.matchedStudent ? '' : 'bg-yellow-50 dark:bg-yellow-900/10'}
                      >
                        <td className="px-3 py-2">
                          {row.matchedStudent ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-yellow-600" />
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-900 dark:text-white">{row.name}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                          {row.matchedStudent
                            ? `${row.matchedStudent.first_name} ${row.matchedStudent.last_name}`
                            : <span className="text-yellow-600">No match</span>
                          }
                        </td>
                        <td className="px-3 py-2 text-center text-xs">
                          {row.data.psych_shifts}s/{row.data.psych_hours}h
                        </td>
                        <td className="px-3 py-2 text-center text-xs">
                          {row.data.ed_shifts}s/{row.data.ed_hours}h
                        </td>
                        <td className="px-3 py-2 text-center text-xs">
                          {row.data.ems_field_shifts}s/{row.data.ems_field_hours}h
                        </td>
                        <td className="px-3 py-2 text-center text-xs">
                          {row.data.icu_shifts}s/{row.data.icu_hours}h
                        </td>
                        <td className="px-3 py-2 text-center text-xs">
                          {row.data.ob_shifts}s/{row.data.ob_hours}h
                        </td>
                        <td className="px-3 py-2 text-center text-xs">
                          {row.data.or_shifts}s/{row.data.or_hours}h
                        </td>
                        <td className="px-3 py-2 text-center text-xs">
                          {row.data.peds_ed_shifts}s/{row.data.peds_ed_hours}h
                        </td>
                        <td className="px-3 py-2 text-center text-xs">
                          {row.data.peds_icu_shifts}s/{row.data.peds_icu_hours}h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => { setShowImportModal(false); setImportPreview([]); }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={executeImport}
                disabled={importing || matchedCount === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Import {matchedCount} Students
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
