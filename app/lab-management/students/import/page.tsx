'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  X,
  Download,
  ChevronDown,
  ChevronUp,
  History,
  Clock,
  User,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Cohort {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

type RowStatus = 'valid' | 'error' | 'warning';

interface RowValidation {
  status: RowStatus;
  errors: string[];
  warnings: string[];
  cellErrors: Record<string, string>;
  cellWarnings: Record<string, string>;
}

interface ParsedStudent {
  row: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  agency: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  learning_style: string;
  notes: string;
  selected: boolean;
  validation: RowValidation;
  duplicateInfo?: { existing_name: string; student_id: string; match_type?: 'email' | 'name' };
}

interface ImportResultRow {
  row: number;
  status: 'imported' | 'updated' | 'skipped' | 'failed';
  student?: { id: string; name: string };
  error?: string;
}

interface ImportSummary {
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
}

interface ImportResult {
  results: ImportResultRow[];
  summary: ImportSummary;
}

interface ImportHistoryEntry {
  id: string;
  imported_by: string;
  cohort_id: string | null;
  import_mode: string;
  imported_count: number;
  updated_count: number;
  skipped_count: number;
  created_at: string;
}

const VALID_LEARNING_STYLES = new Set(['visual', 'auditory', 'kinesthetic', 'reading']);

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function downloadTemplate() {
  const header = 'first_name,last_name,email,phone,agency,emergency_contact_name,emergency_contact_phone,learning_style,notes';
  const rows = [
    'John,Doe,john.doe@example.com,555-1234,AMR,Jane Doe,555-5678,visual,Good student',
    'Jane,Smith,jane.smith@example.com,555-9012,Fire Dept,Bob Smith,555-3456,auditory,',
  ];
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'student-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function buildValidation(
  student: Omit<ParsedStudent, 'validation' | 'selected'>,
  csvDuplicateEmails: Set<string>,
  dbDuplicates: Map<string, { existing_name: string; student_id: string; match_type?: 'email' | 'name' }>
): RowValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cellErrors: Record<string, string> = {};
  const cellWarnings: Record<string, string> = {};

  if (!student.first_name.trim()) {
    errors.push('First name is required');
    cellErrors.first_name = 'Required';
  }
  if (!student.last_name.trim()) {
    errors.push('Last name is required');
    cellErrors.last_name = 'Required';
  }
  if (student.email && !isValidEmail(student.email)) {
    errors.push('Invalid email format');
    cellErrors.email = 'Invalid format';
  }
  if (student.learning_style && !VALID_LEARNING_STYLES.has(student.learning_style.toLowerCase())) {
    errors.push(`Invalid learning style: "${student.learning_style}"`);
    cellErrors.learning_style = 'Must be: visual, auditory, kinesthetic, reading';
  }
  if (student.email && csvDuplicateEmails.has(student.email.toLowerCase())) {
    warnings.push('Email appears more than once in this CSV');
    cellWarnings.email = 'Duplicate within CSV';
  }

  // Check DB duplicates by email
  const emailKey = student.email?.toLowerCase() || '';
  if (emailKey && dbDuplicates.has(emailKey)) {
    const info = dbDuplicates.get(emailKey)!;
    warnings.push(`Email already exists (${info.existing_name})`);
    cellWarnings.email = `Exists: ${info.existing_name}`;
  }

  // Check DB duplicates by name (when no email match found)
  if (!emailKey || !dbDuplicates.has(emailKey)) {
    const nameKey = `__name__${student.first_name.toLowerCase().trim()}_${student.last_name.toLowerCase().trim()}`;
    if (dbDuplicates.has(nameKey)) {
      const info = dbDuplicates.get(nameKey)!;
      warnings.push(`Name matches existing student (${info.existing_name})`);
      cellWarnings.first_name = `Name match: ${info.existing_name}`;
    }
  }

  const status: RowStatus =
    errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid';

  return { status, errors, warnings, cellErrors, cellWarnings };
}

// ── CSV Parser ────────────────────────────────────────────────────────────────

function parseCSV(
  text: string,
  csvDuplicateEmails: Set<string>,
  dbDuplicates: Map<string, { existing_name: string; student_id: string; match_type?: 'email' | 'name' }>
): ParsedStudent[] {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];

  const delimiter = lines[0].includes('\t') ? '\t' : ',';

  const firstLineLower = lines[0].toLowerCase();
  const hasHeader =
    firstLineLower.includes('first') ||
    firstLineLower.includes('name') ||
    firstLineLower.includes('email') ||
    firstLineLower.includes('phone') ||
    firstLineLower.includes('agency') ||
    firstLineLower.includes('emergency') ||
    firstLineLower.includes('learning') ||
    firstLineLower.includes('notes');

  // Detect column positions from header
  let colFirst = 0, colLast = 1, colEmail = 2, colPhone = 3, colAgency = 4;
  let colEcName = -1, colEcPhone = -1, colLearning = -1, colNotes = -1;

  if (hasHeader) {
    const headerParts = lines[0]
      .split(delimiter)
      .map(p => p.trim().toLowerCase().replace(/^["']|["']$/g, ''));
    headerParts.forEach((h, i) => {
      if (h.includes('first')) colFirst = i;
      else if (h.includes('last')) colLast = i;
      else if (h.includes('email')) colEmail = i;
      else if (h === 'phone' || (h.includes('phone') && !h.includes('emergency') && !h.includes('contact'))) colPhone = i;
      else if (h.includes('agency')) colAgency = i;
      else if (h.includes('emergency') && h.includes('name')) colEcName = i;
      else if (h.includes('emergency') && (h.includes('phone') || h.includes('contact'))) colEcPhone = i;
      else if (h.includes('learning')) colLearning = i;
      else if (h.includes('note')) colNotes = i;
    });
  }

  const dataLines = hasHeader ? lines.slice(1) : lines;

  const parsed: ParsedStudent[] = dataLines
    .map((line, lineIndex) => {
      const parts = line.split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));

      let first_name = '';
      let last_name = '';
      let email = '';
      let phone = '';
      let agency = '';
      let emergency_contact_name = '';
      let emergency_contact_phone = '';
      let learning_style = '';
      let notes = '';

      if (hasHeader) {
        first_name = parts[colFirst] || '';
        last_name = parts[colLast] || '';
        email = parts[colEmail] || '';
        phone = parts[colPhone] || '';
        agency = parts[colAgency] || '';
        emergency_contact_name = colEcName >= 0 ? (parts[colEcName] || '') : '';
        emergency_contact_phone = colEcPhone >= 0 ? (parts[colEcPhone] || '') : '';
        learning_style = colLearning >= 0 ? (parts[colLearning] || '') : '';
        notes = colNotes >= 0 ? (parts[colNotes] || '') : '';
      } else if (parts.length >= 2) {
        first_name = parts[0] || '';
        last_name = parts[1] || '';
        if (parts.length >= 3 && parts[2].includes('@')) {
          email = parts[2];
          if (parts.length >= 4) phone = parts[3];
          if (parts.length >= 5) agency = parts[4];
        } else if (parts.length >= 3) {
          phone = parts[2];
          if (parts.length >= 4) agency = parts[3];
        }
      } else if (parts.length === 1 && parts[0].includes(' ')) {
        const nameParts = parts[0].split(' ');
        first_name = nameParts[0];
        last_name = nameParts.slice(1).join(' ');
      }

      const base = {
        row: lineIndex + 1,
        first_name,
        last_name,
        email,
        phone,
        agency,
        emergency_contact_name,
        emergency_contact_phone,
        learning_style,
        notes,
      };

      const validation = buildValidation(base, csvDuplicateEmails, dbDuplicates);
      const emailKey = email?.toLowerCase() || '';
      const nameKey = `__name__${first_name.toLowerCase().trim()}_${last_name.toLowerCase().trim()}`;

      return {
        ...base,
        selected: validation.status !== 'error',
        validation,
        duplicateInfo:
          (emailKey && dbDuplicates.get(emailKey)) ||
          dbDuplicates.get(nameKey) ||
          undefined,
      };
    })
    .filter(s => s.first_name || s.last_name);

  return parsed;
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <span className="relative group inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max max-w-xs rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-pre-wrap text-center shadow-lg">
        {text}
      </span>
    </span>
  );
}

// ── DataCell ──────────────────────────────────────────────────────────────────

function DataCell({
  value,
  errorMsg,
  warningMsg,
}: {
  value: string;
  errorMsg?: string;
  warningMsg?: string;
}) {
  const hasError = !!errorMsg;
  const hasWarning = !!warningMsg && !hasError;

  const cellClass = hasError
    ? 'border border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded px-1'
    : hasWarning
    ? 'border border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded px-1'
    : 'text-gray-900 dark:text-white';

  const tooltipText = errorMsg || warningMsg || '';

  return (
    <td className="px-2 py-2 text-sm max-w-[140px] truncate">
      {tooltipText ? (
        <Tooltip text={tooltipText}>
          <span className={cellClass}>{value || '—'}</span>
        </Tooltip>
      ) : (
        <span className={cellClass}>{value || '—'}</span>
      )}
    </td>
  );
}

// ── Import History Section ────────────────────────────────────────────────────

function ImportHistorySection() {
  const [history, setHistory] = useState<ImportHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch('/api/lab-management/students/import?limit=10')
      .then(r => r.json())
      .then(d => {
        if (d.success) setHistory(d.history);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        Loading import history...
      </div>
    );
  }

  if (history.length === 0) {
    return null;
  }

  const modeLabel = (mode: string | null) => {
    if (mode === 'skip') return 'Skip dupes';
    if (mode === 'update') return 'Update dupes';
    if (mode === 'import_new') return 'Allow dupes';
    return '—';
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <span className="font-semibold text-gray-900 dark:text-white">Import History</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">({history.length} recent)</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="border-t dark:border-gray-700 overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Imported By</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mode</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wider">Imported</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">Updated</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Skipped</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {history.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(entry.created_at)}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-900 dark:text-white whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3 text-gray-400" />
                      {entry.imported_by}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs">{modeLabel(entry.import_mode)}</td>
                  <td className="px-4 py-2 text-right text-green-600 dark:text-green-400 font-medium">{entry.imported_count}</td>
                  <td className="px-4 py-2 text-right text-blue-600 dark:text-blue-400 font-medium">{entry.updated_count}</td>
                  <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">{entry.skipped_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function ImportStudentsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnTo = searchParams.get('returnTo');
  const preselectedCohortId = searchParams.get('cohortId');

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState(preselectedCohortId || '');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  const [inputMethod, setInputMethod] = useState<'paste' | 'file'>('paste');
  const [pasteData, setPasteData] = useState('');
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([]);

  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'update' | 'import_new'>('skip');
  const [dbDuplicates, setDbDuplicates] = useState<Map<string, { existing_name: string; student_id: string; match_type?: 'email' | 'name' }>>(new Map());

  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [failedExpanded, setFailedExpanded] = useState(false);

  // Drag-and-drop state
  const [draggingOver, setDraggingOver] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  useEffect(() => {
    if (session) fetchCohorts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const fetchCohorts = async () => {
    try {
      const res = await fetch('/api/lab-management/cohorts');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts);
        if (preselectedCohortId && data.cohorts.find((c: Cohort) => c.id === preselectedCohortId)) {
          setSelectedCohort(preselectedCohortId);
        } else if (data.cohorts.length > 0 && !selectedCohort) {
          setSelectedCohort(data.cohorts[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching cohorts:', err);
    }
    setLoading(false);
  };

  const buildCsvDuplicateSet = (lines: { email: string }[]): Set<string> => {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const s of lines) {
      const e = s.email.toLowerCase().trim();
      if (!e) continue;
      if (seen.has(e)) dupes.add(e);
      else seen.add(e);
    }
    return dupes;
  };

  const checkDbDuplicates = useCallback(async (
    emails: string[],
    names: { first_name: string; last_name: string; email?: string }[]
  ) => {
    setCheckingDuplicates(true);
    try {
      const validEmails = emails.filter(e => e && isValidEmail(e));
      const res = await fetch('/api/lab-management/students/check-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: validEmails, names }),
      });
      const data = await res.json();
      const map = new Map<string, { existing_name: string; student_id: string; match_type?: 'email' | 'name' }>();
      for (const d of data.duplicates || []) {
        map.set(d.email.toLowerCase(), {
          existing_name: d.existing_name,
          student_id: d.student_id,
          match_type: d.match_type,
        });
      }
      setDbDuplicates(map);
      return map;
    } catch (err) {
      console.error('Error checking duplicates:', err);
      return new Map<string, { existing_name: string; student_id: string; match_type?: 'email' | 'name' }>();
    } finally {
      setCheckingDuplicates(false);
    }
  }, []);

  const processInput = useCallback(async (text: string) => {
    if (!text.trim()) {
      setParsedStudents([]);
      setDbDuplicates(new Map());
      return;
    }

    // First pass: rough parse to extract emails/names for DB check
    const roughParsed = parseCSV(text, new Set(), new Map());
    const emails = roughParsed.map(s => s.email).filter(Boolean);
    const names = roughParsed.map(s => ({
      first_name: s.first_name,
      last_name: s.last_name,
      email: s.email,
    }));
    const csvDupes = buildCsvDuplicateSet(roughParsed);

    const dbDupeMap = await checkDbDuplicates(emails, names);

    // Second pass: full parse with duplicate info
    const students = parseCSV(text, csvDupes, dbDupeMap);
    setParsedStudents(students);
    setImportResult(null);
  }, [checkDbDuplicates]);

  const handlePasteChange = (value: string) => {
    setPasteData(value);
    processInput(value);
  };

  const handleFileLoad = (text: string) => {
    setPasteData(text);
    processInput(text);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => handleFileLoad(event.target?.result as string);
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => handleFileLoad(event.target?.result as string);
    reader.readAsText(file);
  };

  const toggleRow = (index: number) => {
    setParsedStudents(prev =>
      prev.map((s, i) => i === index ? { ...s, selected: !s.selected } : s)
    );
  };

  const selectAllValid = () => {
    setParsedStudents(prev =>
      prev.map(s => ({ ...s, selected: s.validation.status !== 'error' }))
    );
  };

  const deselectAll = () => {
    setParsedStudents(prev => prev.map(s => ({ ...s, selected: false })));
  };

  const removeRow = (index: number) => {
    setParsedStudents(prev => prev.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    if (!selectedCohort) {
      alert('Please select a cohort');
      return;
    }

    const toImport = parsedStudents.filter(s => s.selected && s.validation.status !== 'error');
    if (toImport.length === 0) {
      alert('No valid rows selected for import');
      return;
    }

    setImporting(true);
    try {
      const res = await fetch('/api/lab-management/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cohort_id: selectedCohort,
          duplicate_mode: duplicateMode,
          students: toImport.map(s => ({
            row: s.row,
            first_name: s.first_name,
            last_name: s.last_name,
            email: s.email || undefined,
            phone: s.phone || undefined,
            agency: s.agency || undefined,
            emergency_contact_name: s.emergency_contact_name || undefined,
            emergency_contact_phone: s.emergency_contact_phone || undefined,
            learning_style: s.learning_style || undefined,
            notes: s.notes || undefined,
          })),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setImportResult({ results: data.results, summary: data.summary });
        setParsedStudents([]);
        setPasteData('');
      } else {
        alert('Import failed: ' + data.error);
      }
    } catch (err) {
      console.error('Error importing:', err);
      alert('Import failed');
    }
    setImporting(false);
  };

  const downloadFailedRows = () => {
    if (!importResult) return;
    const failed = importResult.results.filter(r => r.status === 'failed');
    if (failed.length === 0) return;
    const header = 'row,error';
    const rows = failed.map(r => `${r.row},"${(r.error || '').replace(/"/g, '""')}"`);
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'failed-import-rows.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Counts
  const errorCount = parsedStudents.filter(s => s.validation.status === 'error').length;
  const warningCount = parsedStudents.filter(s => s.validation.status === 'warning').length;
  const validCount = parsedStudents.filter(s => s.validation.status === 'valid').length;
  const selectedCount = parsedStudents.filter(s => s.selected && s.validation.status !== 'error').length;
  const selectedCohortData = cohorts.find(c => c.id === selectedCohort);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
            <Link href="/lab-management" className="hover:text-blue-600 dark:hover:text-blue-400">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/students" className="hover:text-blue-600 dark:hover:text-blue-400">Students</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="dark:text-gray-300">Import</span>
          </div>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import Students</h1>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download CSV Template
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* Import Result */}
        {importResult && (
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-green-800 dark:text-green-300 mb-2">Import Complete</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  <div className="bg-white dark:bg-green-900/40 rounded-lg px-3 py-2 text-center">
                    <div className="text-2xl font-bold text-green-700 dark:text-green-300">{importResult.summary.imported}</div>
                    <div className="text-xs text-green-600 dark:text-green-400">Imported</div>
                  </div>
                  <div className="bg-white dark:bg-green-900/40 rounded-lg px-3 py-2 text-center">
                    <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{importResult.summary.updated}</div>
                    <div className="text-xs text-blue-600 dark:text-blue-400">Updated</div>
                  </div>
                  <div className="bg-white dark:bg-green-900/40 rounded-lg px-3 py-2 text-center">
                    <div className="text-2xl font-bold text-gray-600 dark:text-gray-300">{importResult.summary.skipped}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Skipped</div>
                  </div>
                  <div className="bg-white dark:bg-green-900/40 rounded-lg px-3 py-2 text-center">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{importResult.summary.failed}</div>
                    <div className="text-xs text-red-500 dark:text-red-400">Failed</div>
                  </div>
                </div>

                {importResult.summary.failed > 0 && (
                  <div className="mt-2">
                    <button
                      onClick={() => setFailedExpanded(v => !v)}
                      className="flex items-center gap-1 text-sm text-red-700 dark:text-red-400 hover:underline"
                    >
                      {failedExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {failedExpanded ? 'Hide' : 'Show'} failed row details
                    </button>
                    {failedExpanded && (
                      <ul className="mt-2 space-y-1">
                        {importResult.results.filter(r => r.status === 'failed').map(r => (
                          <li key={r.row} className="text-sm text-red-700 dark:text-red-400">
                            Row {r.row}: {r.error || 'Unknown error'}
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      onClick={downloadFailedRows}
                      className="mt-2 flex items-center gap-1 text-sm text-red-700 dark:text-red-400 hover:underline"
                    >
                      <Download className="w-3 h-3" />
                      Export failed rows as CSV
                    </button>
                  </div>
                )}

                <div className="mt-3 flex gap-3">
                  <Link
                    href={returnTo || '/lab-management/students'}
                    className="text-green-800 dark:text-green-300 font-medium hover:underline text-sm"
                  >
                    {returnTo ? 'Return to Cohort' : 'View Students'} &rarr;
                  </Link>
                  <button
                    onClick={() => setImportResult(null)}
                    className="text-sm text-gray-600 dark:text-gray-400 hover:underline"
                  >
                    Import more students
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Cohort Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Step 1 — Select Cohort</h2>
          <select
            value={selectedCohort}
            onChange={(e) => setSelectedCohort(e.target.value)}
            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
          >
            <option value="">Choose a cohort...</option>
            {cohorts.map(cohort => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.program.abbreviation} Group {cohort.cohort_number}
              </option>
            ))}
          </select>
        </div>

        {/* Step 2: Duplicate Mode */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Step 2 — Duplicate Handling</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Duplicates are detected by exact email match OR by case-insensitive first + last name match.
          </p>
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="radio"
                name="duplicateMode"
                value="skip"
                checked={duplicateMode === 'skip'}
                onChange={() => setDuplicateMode('skip')}
                className="mt-0.5 text-blue-600"
              />
              <div>
                <span className="font-medium text-gray-800 dark:text-gray-200">Skip existing students</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">Don&apos;t modify existing records. Duplicate rows will be skipped.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="radio"
                name="duplicateMode"
                value="update"
                checked={duplicateMode === 'update'}
                onChange={() => setDuplicateMode('update')}
                className="mt-0.5 text-blue-600"
              />
              <div>
                <span className="font-medium text-gray-800 dark:text-gray-200">Update existing students</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">Overwrite fields for existing students with data from the CSV.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="radio"
                name="duplicateMode"
                value="import_new"
                checked={duplicateMode === 'import_new'}
                onChange={() => setDuplicateMode('import_new')}
                className="mt-0.5 text-blue-600"
              />
              <div>
                <span className="font-medium text-gray-800 dark:text-gray-200">Import as new (allow duplicates)</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">Always create new records, even if a matching student exists.</p>
              </div>
            </label>
          </div>
        </div>

        {/* Step 3: Input Method */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Step 3 — Add Student Data</h2>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setInputMethod('paste')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                inputMethod === 'paste'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Paste Data
            </button>
            <button
              onClick={() => setInputMethod('file')}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                inputMethod === 'file'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Upload File
            </button>
          </div>

          {inputMethod === 'paste' ? (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Paste data from Excel or a spreadsheet. Supported columns: first_name, last_name, email, phone, agency, emergency_contact_name, emergency_contact_phone, learning_style, notes
              </p>
              <textarea
                value={pasteData}
                onChange={(e) => handlePasteChange(e.target.value)}
                placeholder={`first_name,last_name,email,phone,agency,emergency_contact_name,emergency_contact_phone,learning_style,notes\nJohn,Doe,john@example.com,555-1234,AMR,Jane Doe,555-5678,visual,Good student`}
                rows={8}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Upload a CSV or TXT file with student data. Drag and drop or click to select.
              </p>
              <label
                className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                  draggingOver
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
                onDragLeave={() => setDraggingOver(false)}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <FileSpreadsheet className={`w-10 h-10 mb-2 ${draggingOver ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'}`} />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {draggingOver ? 'Drop file here' : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">CSV, TXT, or TSV</p>
                </div>
                <input
                  type="file"
                  accept=".csv,.txt,.tsv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {pasteData && (
                <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                  File loaded — {parsedStudents.length} student{parsedStudents.length !== 1 ? 's' : ''} parsed
                </p>
              )}
            </div>
          )}
        </div>

        {/* Step 4: Preview Table */}
        {parsedStudents.length > 0 && (
          <>
            {/* Checking indicator */}
            {checkingDuplicates && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 px-1">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                Checking for duplicates in database...
              </div>
            )}

            {/* Summary + actions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-4 border-b dark:border-gray-700 flex flex-wrap items-center gap-3 justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    Step 4 — Review &amp; Select Rows
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {validCount > 0 && (
                      <span className="text-green-600 dark:text-green-400 font-medium">{validCount} new</span>
                    )}
                    {warningCount > 0 && (
                      <>{validCount > 0 ? ', ' : ''}<span className="text-amber-600 dark:text-amber-400 font-medium">{warningCount} duplicate{warningCount !== 1 ? 's' : ''}</span></>
                    )}
                    {errorCount > 0 && (
                      <>, <span className="text-red-600 dark:text-red-400 font-medium">{errorCount} error{errorCount !== 1 ? 's' : ''}</span></>
                    )}
                    <span className="text-gray-400 dark:text-gray-500"> &bull; {selectedCount} selected for import</span>
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={selectAllValid}
                    className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Select All Valid
                  </button>
                  <button
                    onClick={deselectAll}
                    className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Deselect All
                  </button>
                  <button
                    onClick={() => { setParsedStudents([]); setPasteData(''); }}
                    className="text-xs px-3 py-1.5 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="overflow-auto max-h-[500px]">
                <table className="w-full text-sm min-w-[900px]">
                  <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-2 w-8"></th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-10">#</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-8">St.</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">First</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phone</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Agency</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">EC Name</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">EC Phone</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Style</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notes</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {parsedStudents.map((student, index) => {
                      const { status: rowStatus, errors, warnings, cellErrors, cellWarnings } = student.validation;
                      const isError = rowStatus === 'error';
                      const isWarning = rowStatus === 'warning';

                      const rowBg = isError
                        ? 'bg-red-50 dark:bg-red-900/10'
                        : isWarning
                        ? 'bg-amber-50 dark:bg-amber-900/10'
                        : index % 2 === 0
                        ? 'bg-white dark:bg-gray-800'
                        : 'bg-gray-50/50 dark:bg-gray-800/50';

                      const tooltip = [...errors, ...warnings].join('\n');

                      return (
                        <tr key={index} className={`${rowBg} transition-colors`}>
                          <td className="px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={student.selected && !isError}
                              disabled={isError}
                              onChange={() => toggleRow(index)}
                              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 disabled:opacity-40"
                            />
                          </td>
                          <td className="px-2 py-2 text-gray-400 dark:text-gray-500 text-xs">{student.row}</td>
                          <td className="px-2 py-2">
                            {isError ? (
                              <Tooltip text={tooltip}>
                                <AlertCircle className="w-4 h-4 text-red-500" />
                              </Tooltip>
                            ) : isWarning ? (
                              <Tooltip text={tooltip}>
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                              </Tooltip>
                            ) : (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                          </td>
                          <DataCell value={student.first_name} errorMsg={cellErrors.first_name} warningMsg={cellWarnings.first_name} />
                          <DataCell value={student.last_name} errorMsg={cellErrors.last_name} warningMsg={cellWarnings.last_name} />
                          <DataCell value={student.email} errorMsg={cellErrors.email} warningMsg={cellWarnings.email} />
                          <DataCell value={student.phone} errorMsg={cellErrors.phone} warningMsg={cellWarnings.phone} />
                          <DataCell value={student.agency} errorMsg={cellErrors.agency} warningMsg={cellWarnings.agency} />
                          <DataCell value={student.emergency_contact_name} errorMsg={cellErrors.emergency_contact_name} warningMsg={cellWarnings.emergency_contact_name} />
                          <DataCell value={student.emergency_contact_phone} errorMsg={cellErrors.emergency_contact_phone} warningMsg={cellWarnings.emergency_contact_phone} />
                          <DataCell value={student.learning_style} errorMsg={cellErrors.learning_style} warningMsg={cellWarnings.learning_style} />
                          <DataCell value={student.notes} errorMsg={cellErrors.notes} warningMsg={cellWarnings.notes} />
                          <td className="px-1 py-2">
                            <button
                              onClick={() => removeRow(index)}
                              className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                              title="Remove row"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Import Button */}
            <div className="flex flex-wrap gap-3 items-center">
              <Link
                href={returnTo || '/lab-management/students'}
                className="px-6 py-3 border dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </Link>
              <button
                onClick={handleImport}
                disabled={importing || !selectedCohort || selectedCount === 0}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {importing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Import {selectedCount} Student{selectedCount !== 1 ? 's' : ''}
                    {selectedCohortData && ` to ${selectedCohortData.program.abbreviation} G${selectedCohortData.cohort_number}`}
                  </>
                )}
              </button>
              {!selectedCohort && (
                <span className="text-sm text-amber-600 dark:text-amber-400">Please select a cohort first</span>
              )}
            </div>
          </>
        )}

        {/* Import History */}
        <ImportHistorySection />

        {/* Help Text */}
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">Tips for importing</h3>
          <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
            <li>Download the CSV template for the correct column order and example data</li>
            <li>Copy and paste directly from Excel, Google Sheets, or any spreadsheet</li>
            <li>Headers are auto-detected — include a header row for best results</li>
            <li>Required: first_name, last_name. Optional: email, phone, agency, emergency_contact_name, emergency_contact_phone, learning_style, notes</li>
            <li>Valid values for learning_style: visual, auditory, kinesthetic, reading</li>
            <li>Duplicates are detected by email (exact) or name (case-insensitive)</li>
            <li>Rows with errors are deselected by default — fix them in the source or remove them</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

export default function ImportStudentsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <ImportStudentsContent />
    </Suspense>
  );
}
