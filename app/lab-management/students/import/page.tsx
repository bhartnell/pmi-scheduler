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
} from 'lucide-react';

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
  /** Cell-level issues: field name -> message */
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
  selected: boolean;
  validation: RowValidation;
  /** Existing student info if a DB duplicate was found */
  duplicateInfo?: { existing_name: string; student_id: string };
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function downloadTemplate() {
  const header = 'first_name,last_name,email,phone,agency';
  const rows = [
    'John,Doe,john.doe@example.com,555-1234,AMR',
    'Jane,Smith,jane.smith@example.com,555-5678,Fire Dept',
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
  dbDuplicates: Map<string, { existing_name: string; student_id: string }>
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
  if (student.email && csvDuplicateEmails.has(student.email.toLowerCase())) {
    warnings.push('Email appears more than once in this CSV');
    cellWarnings.email = 'Duplicate within CSV';
  }
  if (student.email && dbDuplicates.has(student.email.toLowerCase())) {
    const info = dbDuplicates.get(student.email.toLowerCase())!;
    warnings.push(`Email already exists (${info.existing_name})`);
    cellWarnings.email = `Exists: ${info.existing_name}`;
  }

  const status: RowStatus =
    errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid';

  return { status, errors, warnings, cellErrors, cellWarnings };
}

// ── CSV Parser ────────────────────────────────────────────────────────────────

function parseCSV(
  text: string,
  csvDuplicateEmails: Set<string>,
  dbDuplicates: Map<string, { existing_name: string; student_id: string }>
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
    firstLineLower.includes('agency');

  // Detect column order from header
  let colFirst = 0, colLast = 1, colEmail = 2, colPhone = 3, colAgency = 4;
  if (hasHeader) {
    const headerParts = lines[0].split(delimiter).map(p => p.trim().toLowerCase().replace(/^["']|["']$/g, ''));
    headerParts.forEach((h, i) => {
      if (h.includes('first')) colFirst = i;
      else if (h.includes('last')) colLast = i;
      else if (h.includes('email')) colEmail = i;
      else if (h.includes('phone')) colPhone = i;
      else if (h.includes('agency')) colAgency = i;
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

      if (hasHeader) {
        // Use detected column positions
        first_name = parts[colFirst] || '';
        last_name = parts[colLast] || '';
        email = parts[colEmail] || '';
        phone = parts[colPhone] || '';
        agency = parts[colAgency] || '';
      } else if (parts.length >= 2) {
        // Positional parsing for headerless data
        first_name = parts[0] || '';
        last_name = parts[1] || '';
        // Heuristic: check if part 2 looks like email
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
      };

      const validation = buildValidation(base, csvDuplicateEmails, dbDuplicates);

      return {
        ...base,
        selected: validation.status !== 'error',
        validation,
        duplicateInfo: email ? dbDuplicates.get(email.toLowerCase()) : undefined,
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

// ── Cell component ────────────────────────────────────────────────────────────

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
    <td className="px-3 py-2 text-sm">
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
  const [dbDuplicates, setDbDuplicates] = useState<Map<string, { existing_name: string; student_id: string }>>(new Map());

  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [failedExpanded, setFailedExpanded] = useState(false);

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

  // Build the set of CSV-internal duplicate emails
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

  const checkDbDuplicates = useCallback(async (emails: string[]) => {
    const validEmails = emails.filter(e => e && isValidEmail(e));
    if (validEmails.length === 0) {
      setDbDuplicates(new Map());
      return new Map<string, { existing_name: string; student_id: string }>();
    }
    setCheckingDuplicates(true);
    try {
      const res = await fetch('/api/lab-management/students/check-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: validEmails }),
      });
      const data = await res.json();
      const map = new Map<string, { existing_name: string; student_id: string }>();
      for (const d of data.duplicates || []) {
        map.set(d.email.toLowerCase(), { existing_name: d.existing_name, student_id: d.student_id });
      }
      setDbDuplicates(map);
      return map;
    } catch (err) {
      console.error('Error checking duplicates:', err);
      return new Map<string, { existing_name: string; student_id: string }>();
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

    // First pass: rough parse to extract emails for DB check
    const roughParsed = parseCSV(text, new Set(), new Map());
    const emails = roughParsed.map(s => s.email).filter(Boolean);
    const csvDupes = buildCsvDuplicateSet(roughParsed);

    // Check DB duplicates
    const dbDupeMap = await checkDbDuplicates(emails);

    // Second pass: full parse with all duplicate info
    const students = parseCSV(text, csvDupes, dbDupeMap);
    setParsedStudents(students);
    setImportResult(null);
  }, [checkDbDuplicates]);

  const handlePasteChange = (value: string) => {
    setPasteData(value);
    processInput(value);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setPasteData(text);
      processInput(text);
    };
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

  // Computed counts
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
        <div className="max-w-5xl mx-auto px-4 py-6">
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

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

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

        {/* Cohort Selection */}
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

        {/* Input Method */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Step 2 — Add Student Data</h2>

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
                Paste data from Excel or a spreadsheet. Columns: first_name, last_name, email, phone, agency
              </p>
              <textarea
                value={pasteData}
                onChange={(e) => handlePasteChange(e.target.value)}
                placeholder={`first_name,last_name,email,phone,agency\nJohn,Doe,john@example.com,555-1234,AMR\nJane,Smith`}
                rows={8}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Upload a CSV or TXT file with student data.
              </p>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <FileSpreadsheet className="w-10 h-10 text-gray-400 dark:text-gray-500 mb-2" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">Click to upload CSV or TXT file</p>
                </div>
                <input
                  type="file"
                  accept=".csv,.txt,.tsv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>

        {/* Duplicate Handling + Preview */}
        {parsedStudents.length > 0 && (
          <>
            {/* Duplicate Config */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    When duplicates found:
                  </label>
                  <select
                    value={duplicateMode}
                    onChange={(e) => setDuplicateMode(e.target.value as 'skip' | 'update' | 'import_new')}
                    className="px-3 py-1.5 border dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                  >
                    <option value="skip">Skip (don&apos;t import duplicate)</option>
                    <option value="update">Update existing student record</option>
                    <option value="import_new">Import as new (allow duplicates)</option>
                  </select>
                </div>
                {checkingDuplicates && (
                  <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                    Checking for duplicates...
                  </span>
                )}
              </div>
            </div>

            {/* Preview Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="p-4 border-b dark:border-gray-700 flex flex-wrap items-center gap-3 justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    Step 3 — Review &amp; Select Rows
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    <span className="text-green-600 dark:text-green-400 font-medium">{validCount} valid</span>
                    {warningCount > 0 && (
                      <>, <span className="text-amber-600 dark:text-amber-400 font-medium">{warningCount} warning{warningCount !== 1 ? 's' : ''}</span></>
                    )}
                    {errorCount > 0 && (
                      <>, <span className="text-red-600 dark:text-red-400 font-medium">{errorCount} error{errorCount !== 1 ? 's' : ''}</span></>
                    )}
                    <span className="text-gray-400 dark:text-gray-500"> &bull; {selectedCount} selected for import</span>
                  </p>
                </div>
                <div className="flex gap-2">
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
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 w-8"></th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-10">#</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-8">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">First Name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phone</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Agency</th>
                      <th className="px-3 py-2 w-8"></th>
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
                          {/* Checkbox */}
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={student.selected && !isError}
                              disabled={isError}
                              onChange={() => toggleRow(index)}
                              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 disabled:opacity-40"
                            />
                          </td>
                          {/* Row number */}
                          <td className="px-3 py-2 text-gray-400 dark:text-gray-500 text-xs">{student.row}</td>
                          {/* Status icon */}
                          <td className="px-3 py-2">
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
                          {/* Data cells */}
                          <DataCell value={student.first_name} errorMsg={cellErrors.first_name} warningMsg={cellWarnings.first_name} />
                          <DataCell value={student.last_name} errorMsg={cellErrors.last_name} warningMsg={cellWarnings.last_name} />
                          <DataCell value={student.email} errorMsg={cellErrors.email} warningMsg={cellWarnings.email} />
                          <DataCell value={student.phone} errorMsg={cellErrors.phone} warningMsg={cellWarnings.phone} />
                          <DataCell value={student.agency} errorMsg={cellErrors.agency} warningMsg={cellWarnings.agency} />
                          {/* Remove button */}
                          <td className="px-2 py-2">
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

            {/* Import Controls */}
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

        {/* Help Text */}
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-medium text-blue-800 dark:text-blue-300 mb-2">Tips for importing</h3>
          <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
            <li>• Download the CSV template above for the correct column order</li>
            <li>• Copy and paste directly from Excel, Google Sheets, or any spreadsheet</li>
            <li>• Headers are auto-detected — include a header row for best results</li>
            <li>• Minimum required: First Name and Last Name (email, phone, agency are optional)</li>
            <li>• Supports comma-separated, tab-separated, or &quot;First Last&quot; formats</li>
            <li>• Rows with errors are deselected by default — fix them in the source or remove them</li>
            <li>• Duplicate emails show as warnings — configure handling in the dropdown above the table</li>
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
