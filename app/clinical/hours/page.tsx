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
  FileSpreadsheet,
  LayoutGrid,
  Table2,
  TrendingUp
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

// Hour requirements for each category
const HOUR_REQUIREMENTS: Record<string, number> = {
  psych_hours: 12,
  ed_hours: 132,
  icu_hours: 12,
  ob_hours: 24,
  or_hours: 36,
  peds_ed_hours: 36,
  peds_icu_hours: 12,
  ems_field_hours: 24,  // Elective/Misc
  cardiology_hours: 0,  // CCL - no requirement
};

const TOTAL_REQUIRED_HOURS = 290;

// Department columns configuration - maps to wide table columns
// CCL in UI = cardiology in DB
const DEPT_COLUMNS = [
  { key: 'psych', label: 'Psych', fullName: 'Behavioral Health', hoursField: 'psych_hours' as const, shiftsField: 'psych_shifts' as const, required: 12 },
  { key: 'ed', label: 'ED', fullName: 'Emergency Room', hoursField: 'ed_hours' as const, shiftsField: 'ed_shifts' as const, required: 132 },
  { key: 'icu', label: 'ICU', fullName: 'Intensive Care Unit', hoursField: 'icu_hours' as const, shiftsField: 'icu_shifts' as const, required: 12 },
  { key: 'ob', label: 'OB', fullName: 'Labor & Delivery', hoursField: 'ob_hours' as const, shiftsField: 'ob_shifts' as const, required: 24 },
  { key: 'or', label: 'OR', fullName: 'Inpatient', hoursField: 'or_hours' as const, shiftsField: 'or_shifts' as const, required: 36 },
  { key: 'peds_ed', label: 'Peds ED', fullName: 'Pediatric ED', hoursField: 'peds_ed_hours' as const, shiftsField: 'peds_ed_shifts' as const, required: 36 },
  { key: 'peds_icu', label: 'Peds ICU', fullName: 'Pediatric ICU', hoursField: 'peds_icu_hours' as const, shiftsField: 'peds_icu_shifts' as const, required: 12 },
  { key: 'ems_field', label: 'Elective', fullName: 'EMS Field / Elective', hoursField: 'ems_field_hours' as const, shiftsField: 'ems_field_shifts' as const, required: 24 },
  { key: 'cardiology', label: 'CCL', fullName: 'Cardiac Cath Lab', hoursField: 'cardiology_hours' as const, shiftsField: 'cardiology_shifts' as const, required: 0 },
] as const;

interface ImportPreviewRow {
  name: string;
  matchedStudent: Student | null;
  similarNames: string[];  // Suggestions for unmatched names
  data: Partial<StudentHours>;
  manualMatch?: string;  // For manual matching by user
}

type ViewMode = 'dashboard' | 'detailed';

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
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');

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

  // Get completion status color for a cell
  const getCompletionColor = (current: number, required: number): string => {
    if (required === 0) return 'bg-gray-100 dark:bg-gray-700'; // No requirement
    const percentage = (current / required) * 100;
    if (percentage >= 100) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
    if (percentage >= 50) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
    return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
  };

  // Get progress bar color
  const getProgressColor = (percentage: number): string => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Calculate cohort summary stats
  const getCohortStats = () => {
    const totalStudents = students.length;
    let completedCount = 0;
    let totalPercentage = 0;

    students.forEach(student => {
      const hours = getStudentHours(student.id);
      const studentTotal = hours?.total_hours || 0;
      const percentage = Math.min((studentTotal / TOTAL_REQUIRED_HOURS) * 100, 100);
      totalPercentage += percentage;
      if (studentTotal >= TOTAL_REQUIRED_HOURS) {
        completedCount++;
      }
    });

    return {
      totalStudents,
      completedCount,
      averagePercentage: totalStudents > 0 ? Math.round(totalPercentage / totalStudents) : 0
    };
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

  // Platinum Import Functions - REPLACES values (not increments)
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

        // Parse hours/shifts from columns (Platinum shows cumulative totals)
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

        const matchedStudent = matchStudentByName(name);
        // Find similar names if no match
        const similarNames = matchedStudent ? [] : findSimilarNames(name);

        return {
          name,
          matchedStudent,
          similarNames,
          data: rowData,
        };
      });

      setImportPreview(preview);
      setShowImportModal(true);
    } catch (error) {
      console.error('Error parsing file:', error);
      setImportError('Failed to parse file. Please ensure it is a valid Excel file.');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Normalize name for comparison
  const normalizeName = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')  // Multiple spaces to single
      .replace(/[.,]/g, '')   // Remove periods and commas
      .trim();
  };

  // Calculate Levenshtein distance for fuzzy matching
  const levenshteinDistance = (a: string, b: string): number => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }
    return matrix[b.length][a.length];
  };

  // Get student name variations for matching
  const getNameVariations = (student: Student): string[] => {
    const first = normalizeName(student.first_name);
    const last = normalizeName(student.last_name);
    return [
      `${first} ${last}`,           // John Smith
      `${last} ${first}`,           // Smith John
      `${last}, ${first}`,          // Smith, John
      `${last} ${first[0]}`,        // Smith J
      `${first[0]} ${last}`,        // J Smith
    ];
  };

  // Find similar names for suggestions
  const findSimilarNames = (importName: string, maxSuggestions: number = 3): string[] => {
    const normalized = normalizeName(importName);

    const scored = students.map(s => {
      const fullName = `${s.first_name} ${s.last_name}`;
      const variations = getNameVariations(s);

      // Find minimum distance across all variations
      const minDistance = Math.min(
        ...variations.map(v => levenshteinDistance(normalized, v))
      );

      return { student: s, name: fullName, distance: minDistance };
    });

    // Sort by distance and return top suggestions
    return scored
      .filter(s => s.distance <= 5)  // Only reasonably close matches
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxSuggestions)
      .map(s => s.name);
  };

  const matchStudentByName = (importName: string): Student | null => {
    const normalized = normalizeName(importName);

    // Exact match attempts
    let match = students.find(s => {
      const variations = getNameVariations(s);
      return variations.some(v => v === normalized);
    });

    if (match) return match;

    // Partial match: last name + first initial
    match = students.find(s => {
      const lastName = normalizeName(s.last_name);
      const firstInitial = s.first_name[0]?.toLowerCase();
      return normalized.includes(lastName) &&
             normalized.includes(firstInitial);
    });

    if (match) return match;

    // Fuzzy match: very close Levenshtein distance (≤2)
    const fuzzyMatch = students.find(s => {
      const variations = getNameVariations(s);
      return variations.some(v => levenshteinDistance(normalized, v) <= 2);
    });

    return fuzzyMatch || null;
  };

  // Handle manual match selection
  const handleManualMatch = (rowIndex: number, studentId: string) => {
    const student = students.find(s => s.id === studentId) || null;
    setImportPreview(prev => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        matchedStudent: student,
        manualMatch: studentId,
        similarNames: [], // Clear suggestions once matched
      };
      return updated;
    });
  };

  // Import REPLACES/SETS values (Platinum shows cumulative totals, not increments)
  const executeImport = async () => {
    setImporting(true);
    setImportError(null);

    const matchedRows = importPreview.filter(row => row.matchedStudent);
    const results = { success: 0, failed: 0, failedNames: [] as string[] };

    for (const row of matchedRows) {
      if (!row.matchedStudent) continue;

      try {
        // POST with the values - API will SET (not increment) these values
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

        if (res.ok) {
          results.success++;
        } else {
          results.failed++;
          results.failedNames.push(row.name);
        }
      } catch (error) {
        console.error(`Import error for ${row.name}:`, error);
        results.failed++;
        results.failedNames.push(row.name);
      }
    }

    // Check unmatched count
    const unmatchedNames = importPreview
      .filter(row => !row.matchedStudent)
      .map(row => row.name);

    await fetchCohortData();

    // Show summary message
    if (results.failed > 0 || unmatchedNames.length > 0) {
      let message = `Imported ${results.success}/${matchedRows.length} students.`;
      if (results.failed > 0) {
        message += ` ${results.failed} failed: ${results.failedNames.join(', ')}.`;
      }
      if (unmatchedNames.length > 0) {
        message += ` ${unmatchedNames.length} skipped (no match): ${unmatchedNames.slice(0, 3).join(', ')}${unmatchedNames.length > 3 ? '...' : ''}.`;
      }
      setImportError(message);
      // Don't close modal if there were issues, let user see summary
      if (results.failed === 0) {
        setShowImportModal(false);
        setImportPreview([]);
      }
    } else {
      setShowImportModal(false);
      setImportPreview([]);
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
  const cohortStats = getCohortStats();

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
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('dashboard')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm transition-colors ${
                    viewMode === 'dashboard'
                      ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  Dashboard
                </button>
                <button
                  onClick={() => setViewMode('detailed')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm transition-colors ${
                    viewMode === 'detailed'
                      ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Table2 className="w-4 h-4" />
                  Detailed
                </button>
              </div>

              {canEdit && selectedCohort && (
                <>
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
                </>
              )}
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

            {viewMode === 'detailed' && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Click any cell to edit shifts/hours
              </div>
            )}
          </div>
        </div>

        {/* Cohort Summary Stats */}
        {selectedCohort && students.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-semibold text-gray-900 dark:text-white">{cohortStats.completedCount}</span> of {cohortStats.totalStudents} students completed all hours
                  </span>
                </div>
                <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Cohort average: <span className="font-semibold text-gray-900 dark:text-white">{cohortStats.averagePercentage}%</span> complete
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-green-500"></span> Complete
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-yellow-500"></span> 50%+
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-red-500"></span> &lt;50%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard View */}
        {selectedCohort && viewMode === 'dashboard' && (
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
                        className="px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                        title={col.fullName}
                      >
                        <div>{col.label}</div>
                        {col.required > 0 && (
                          <div className="text-[10px] font-normal text-gray-400">/{col.required}h</div>
                        )}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-blue-50 dark:bg-blue-900/20">
                      Total<br/><span className="text-[10px] font-normal">/{TOTAL_REQUIRED_HOURS}h</span>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                      Progress
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={DEPT_COLUMNS.length + 3} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        No students found
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(student => {
                      const studentHours = getStudentHours(student.id);
                      const totalHours = studentHours?.total_hours || 0;
                      const progressPercent = Math.min(Math.round((totalHours / TOTAL_REQUIRED_HOURS) * 100), 100);

                      return (
                        <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-2 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 z-10">
                            <div className="font-medium text-gray-900 dark:text-white text-sm">
                              {student.last_name}, {student.first_name}
                            </div>
                          </td>
                          {DEPT_COLUMNS.map(col => {
                            const hours = studentHours?.[col.hoursField] || 0;
                            const colorClass = getCompletionColor(hours, col.required);

                            return (
                              <td key={col.key} className="px-2 py-2 text-center">
                                <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${colorClass}`}>
                                  {hours}{col.required > 0 ? `/${col.required}` : ''}
                                </div>
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-center bg-blue-50 dark:bg-blue-900/20">
                            <div className="font-semibold text-blue-700 dark:text-blue-300 text-sm">
                              {totalHours}/{TOTAL_REQUIRED_HOURS}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${getProgressColor(progressPercent)} transition-all`}
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                              <span className={`text-xs font-medium min-w-[3rem] text-right ${
                                progressPercent >= 100 ? 'text-green-600' :
                                progressPercent >= 50 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {progressPercent}%
                              </span>
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

        {/* Detailed View (original editable grid) */}
        {selectedCohort && viewMode === 'detailed' && (
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
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Import Preview</h2>
                  <p className="text-xs text-gray-500">Values will REPLACE existing data (Platinum shows cumulative totals)</p>
                </div>
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
                <div className={`mb-4 p-3 rounded-lg flex items-start gap-2 ${
                  importError.includes('failed') || importError.includes('skipped')
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                }`}>
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">{importError}</div>
                </div>
              )}

              <div className="mb-4 flex flex-wrap gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-gray-600 dark:text-gray-400">{matchedCount} matched</span>
                </div>
                {unmatchedCount > 0 && (
                  <div className="flex items-center gap-2 text-sm bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    <span className="text-yellow-700 dark:text-yellow-400 font-medium">
                      {unmatchedCount} unmatched - select from dropdown or will be skipped
                    </span>
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
                    {/* Show unmatched rows first */}
                    {importPreview
                      .map((row, idx) => ({ row, idx }))
                      .sort((a, b) => {
                        // Unmatched first
                        const aMatched = a.row.matchedStudent ? 1 : 0;
                        const bMatched = b.row.matchedStudent ? 1 : 0;
                        return aMatched - bMatched;
                      })
                      .map(({ row, idx }) => (
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
                        <td className="px-3 py-2 text-gray-900 dark:text-white font-medium">{row.name}</td>
                        <td className="px-3 py-2 min-w-[200px]">
                          {row.matchedStudent ? (
                            <span className="text-green-700 dark:text-green-400">
                              {row.matchedStudent.first_name} {row.matchedStudent.last_name}
                              {row.manualMatch && <span className="text-xs ml-1">(manual)</span>}
                            </span>
                          ) : (
                            <div className="space-y-1">
                              <select
                                value={row.manualMatch || ''}
                                onChange={(e) => handleManualMatch(idx, e.target.value)}
                                className="w-full text-xs px-2 py-1 border rounded bg-white dark:bg-gray-700 border-yellow-400 dark:border-yellow-600 text-gray-900 dark:text-white"
                              >
                                <option value="">-- Select student --</option>
                                {row.similarNames.length > 0 && (
                                  <optgroup label="Similar names">
                                    {row.similarNames.map(name => {
                                      const student = students.find(s => `${s.first_name} ${s.last_name}` === name);
                                      return student ? (
                                        <option key={student.id} value={student.id}>
                                          {name}
                                        </option>
                                      ) : null;
                                    })}
                                  </optgroup>
                                )}
                                <optgroup label="All students">
                                  {students.map(s => (
                                    <option key={s.id} value={s.id}>
                                      {s.first_name} {s.last_name}
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                              {row.similarNames.length > 0 && !row.manualMatch && (
                                <div className="text-xs text-yellow-600 dark:text-yellow-400">
                                  Similar: {row.similarNames.join(', ')}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center text-xs">
                          {row.data.psych_hours}h
                        </td>
                        <td className="px-3 py-2 text-center text-xs">
                          {row.data.ed_hours}h
                        </td>
                        <td className="px-3 py-2 text-center text-xs">
                          {row.data.ems_field_hours}h
                        </td>
                        <td className="px-3 py-2 text-center text-xs">
                          {row.data.icu_hours}h
                        </td>
                        <td className="px-3 py-2 text-center text-xs">
                          {row.data.ob_hours}h
                        </td>
                        <td className="px-3 py-2 text-center text-xs">
                          {row.data.or_hours}h
                        </td>
                        <td className="px-3 py-2 text-center text-xs">
                          {row.data.peds_ed_hours}h
                        </td>
                        <td className="px-3 py-2 text-center text-xs">
                          {row.data.peds_icu_hours}h
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
