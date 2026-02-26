'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Home,
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Award,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import type { CurrentUserMinimal } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 1 | 2 | 3 | 4;

interface CsvRow {
  [key: string]: string;
}

interface MappedRecord {
  rowIndex: number;
  email: string;
  cert_type: string;
  cert_name: string;
  expiration_date: string;
  cert_number: string;
  issuing_authority: string;
  issues: string[];
  excluded: boolean;
}

interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

type FieldKey =
  | 'email'
  | 'cert_type'
  | 'cert_name'
  | 'expiration_date'
  | 'cert_number'
  | 'issuing_authority';

const FIELD_LABELS: Record<FieldKey, string> = {
  email: 'Instructor Email',
  cert_type: 'Certification Type',
  cert_name: 'Certification Name',
  expiration_date: 'Expiration Date',
  cert_number: 'Certificate Number',
  issuing_authority: 'Issuing Authority',
};

const FIELD_REQUIRED: Record<FieldKey, boolean> = {
  email: true,
  cert_type: false,
  cert_name: false,
  expiration_date: false,
  cert_number: false,
  issuing_authority: false,
};

// Common column name aliases for auto-detection
const COLUMN_ALIASES: Record<FieldKey, string[]> = {
  email: ['email', 'e-mail', 'instructor email', 'instructor_email', 'user email', 'user_email', 'address'],
  cert_type: ['cert type', 'cert_type', 'certification type', 'certification_type', 'type'],
  cert_name: ['cert name', 'cert_name', 'certification name', 'certification_name', 'name', 'certification', 'certificate name'],
  expiration_date: ['expiration', 'expiration date', 'expiration_date', 'exp date', 'exp_date', 'expires', 'expiry', 'expiry date', 'valid through', 'valid_through'],
  cert_number: ['cert number', 'cert_number', 'certificate number', 'certificate_number', 'number', 'cert #', 'id', 'license number', 'license_number'],
  issuing_authority: ['issuing authority', 'issuing_authority', 'authority', 'issued by', 'issued_by', 'issuer', 'organization'],
};

// ---------------------------------------------------------------------------
// CSV parser (handles quoted fields with commas)
// ---------------------------------------------------------------------------

function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 1) return { headers: [], rows: [] };

  const rawHeaders = lines[0].replace(/^\uFEFF/, '');
  const headers = splitCsvLine(rawHeaders).map(h => h.trim());

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = splitCsvLine(line);
    const row: CsvRow = {};
    headers.forEach((header, idx) => {
      row[header] = (values[idx] || '').trim();
    });
    rows.push(row);
  }

  return { headers, rows };
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}

// ---------------------------------------------------------------------------
// Auto-detect column mapping
// ---------------------------------------------------------------------------

function autoDetectMapping(headers: string[]): Record<FieldKey, string> {
  const mapping: Record<FieldKey, string> = {
    email: '',
    cert_type: '',
    cert_name: '',
    expiration_date: '',
    cert_number: '',
    issuing_authority: '',
  };

  for (const field of Object.keys(COLUMN_ALIASES) as FieldKey[]) {
    const aliases = COLUMN_ALIASES[field];
    for (const header of headers) {
      if (aliases.includes(header.toLowerCase())) {
        mapping[field] = header;
        break;
      }
    }
  }

  return mapping;
}

// ---------------------------------------------------------------------------
// Date validation
// ---------------------------------------------------------------------------

function isValidDate(value: string): boolean {
  if (!value.trim()) return true; // empty is OK (optional field)
  // ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return true;
  // MM/DD/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value.trim())) return true;
  // MM-DD-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(value.trim())) return true;
  // Try Date parse
  return !isNaN(new Date(value.trim()).getTime());
}

// ---------------------------------------------------------------------------
// Map rows using the selected column mapping
// ---------------------------------------------------------------------------

function mapRows(
  rows: CsvRow[],
  mapping: Record<FieldKey, string>
): MappedRecord[] {
  return rows.map((row, idx) => {
    const email = mapping.email ? (row[mapping.email] || '').trim().toLowerCase() : '';
    const cert_type = mapping.cert_type ? (row[mapping.cert_type] || '').trim() : '';
    const cert_name = mapping.cert_name ? (row[mapping.cert_name] || '').trim() : '';
    const expiration_date = mapping.expiration_date ? (row[mapping.expiration_date] || '').trim() : '';
    const cert_number = mapping.cert_number ? (row[mapping.cert_number] || '').trim() : '';
    const issuing_authority = mapping.issuing_authority ? (row[mapping.issuing_authority] || '').trim() : '';

    const issues: string[] = [];

    if (!email || !email.includes('@')) {
      issues.push('Missing or invalid email');
    }
    if (!cert_name && !cert_type) {
      issues.push('Missing certification name/type');
    }
    if (expiration_date && !isValidDate(expiration_date)) {
      issues.push(`Invalid date format: "${expiration_date}"`);
    }

    return {
      rowIndex: idx + 2, // 1-based + header row
      email,
      cert_type,
      cert_name,
      expiration_date,
      cert_number,
      issuing_authority,
      issues,
      excluded: false,
    };
  });
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS = [
  { num: 1, label: 'Upload' },
  { num: 2, label: 'Map Columns' },
  { num: 3, label: 'Preview' },
  { num: 4, label: 'Import' },
];

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((step, idx) => (
        <div key={step.num} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                current === step.num
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : current > step.num
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500'
              }`}
            >
              {current > step.num ? <CheckCircle className="w-5 h-5" /> : step.num}
            </div>
            <span
              className={`mt-1 text-xs font-medium ${
                current >= step.num
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {step.label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div
              className={`w-16 h-0.5 mx-1 mb-5 transition-colors ${
                current > step.num
                  ? 'bg-green-500'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function CertificationsImportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUserMinimal | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [step, setStep] = useState<Step>(1);

  // Step 1 state
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [parseError, setParseError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 state
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({
    email: '',
    cert_type: '',
    cert_name: '',
    expiration_date: '',
    cert_number: '',
    issuing_authority: '',
  });

  // Step 3 state
  const [mappedRecords, setMappedRecords] = useState<MappedRecord[]>([]);
  const [showIssuesOnly, setShowIssuesOnly] = useState(false);

  // Step 4 state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState('');

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
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
          router.push('/');
          return;
        }
        setCurrentUser(data.user);
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
    setLoadingUser(false);
  };

  // ---------------------------------------------------------------------------
  // File handling
  // ---------------------------------------------------------------------------

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      setParseError('Please upload a CSV file (.csv extension required).');
      return;
    }
    setParseError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCsv(text);

      if (headers.length === 0) {
        setParseError('Could not parse CSV headers. Please ensure the first row contains column names.');
        return;
      }
      if (rows.length === 0) {
        setParseError('CSV file has no data rows.');
        return;
      }

      setCsvHeaders(headers);
      setCsvRows(rows);
      setMapping(autoDetectMapping(headers));
    };
    reader.readAsText(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  // ---------------------------------------------------------------------------
  // Step navigation
  // ---------------------------------------------------------------------------

  const goToStep2 = () => {
    if (!csvRows.length) return;
    setStep(2);
  };

  const goToStep3 = () => {
    const mapped = mapRows(csvRows, mapping);
    setMappedRecords(mapped);
    setShowIssuesOnly(false);
    setStep(3);
  };

  const goToStep4 = () => {
    setImportResult(null);
    setImportError('');
    setStep(4);
  };

  const goBack = () => {
    if (step > 1) setStep((s) => (s - 1) as Step);
  };

  // ---------------------------------------------------------------------------
  // Step 3 helpers
  // ---------------------------------------------------------------------------

  const toggleExclude = (rowIndex: number) => {
    setMappedRecords(prev =>
      prev.map(r =>
        r.rowIndex === rowIndex ? { ...r, excluded: !r.excluded } : r
      )
    );
  };

  const readyRecords = mappedRecords.filter(r => !r.excluded && r.issues.length === 0);
  const issueRecords = mappedRecords.filter(r => r.issues.length > 0);
  const displayedRecords = showIssuesOnly
    ? mappedRecords.filter(r => r.issues.length > 0)
    : mappedRecords;

  // ---------------------------------------------------------------------------
  // Step 4: Import
  // ---------------------------------------------------------------------------

  const runImport = async () => {
    setImporting(true);
    setImportError('');
    setImportResult(null);

    const toImport = mappedRecords.filter(r => !r.excluded && r.issues.length === 0);
    if (toImport.length === 0) {
      setImportError('No valid records to import.');
      setImporting(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/certifications/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: toImport.map(r => ({
            email: r.email,
            cert_type: r.cert_type,
            cert_name: r.cert_name,
            expiration_date: r.expiration_date,
            cert_number: r.cert_number,
            issuing_authority: r.issuing_authority,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setImportError(data.error || 'Import failed. Please try again.');
      } else {
        setImportResult({
          imported: data.imported ?? 0,
          updated: data.updated ?? 0,
          skipped: data.skipped ?? 0,
          errors: data.errors ?? [],
        });
      }
    } catch (err) {
      console.error('Import error:', err);
      setImportError('Network error. Please check your connection and try again.');
    }

    setImporting(false);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (status === 'loading' || loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  if (!session || !currentUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1">
              <Home className="w-3 h-3" />
              Home
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400">
              Admin
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 dark:text-white">Certifications Import</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Award className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Certifications Bulk Import
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Import instructor certifications from a CSV file
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Step Indicator */}
        <StepIndicator current={step} />

        {/* ---------------------------------------------------------------- */}
        {/* Step 1: Upload                                                    */}
        {/* ---------------------------------------------------------------- */}
        {step === 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Upload CSV File
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Select or drag-and-drop a .csv file. The first row must be a header row.
              </p>
            </div>

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-10 cursor-pointer transition-colors ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : fileName
                  ? 'border-green-400 bg-green-50 dark:bg-green-900/10'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="sr-only"
              />
              {fileName ? (
                <>
                  <FileText className="w-10 h-10 text-green-500 dark:text-green-400" />
                  <div className="text-center">
                    <p className="font-medium text-green-700 dark:text-green-400">{fileName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {csvRows.length} data row{csvRows.length !== 1 ? 's' : ''} detected,{' '}
                      {csvHeaders.length} column{csvHeaders.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFileName('');
                      setCsvHeaders([]);
                      setCsvRows([]);
                      setParseError('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                  <div className="text-center">
                    <p className="font-medium text-gray-700 dark:text-gray-300">
                      Click to select or drag-and-drop
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">CSV files only</p>
                  </div>
                </>
              )}
            </div>

            {/* Parse error */}
            {parseError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                {parseError}
              </div>
            )}

            {/* Preview first 5 rows */}
            {csvRows.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Preview (first {Math.min(5, csvRows.length)} rows)
                </h3>
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700/50">
                        {csvHeaders.map(h => (
                          <th
                            key={h}
                            className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {csvRows.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="bg-white dark:bg-gray-800">
                          {csvHeaders.map(h => (
                            <td
                              key={h}
                              className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis"
                            >
                              {row[h] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Hint */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-300">
              <strong>Tip:</strong> Your CSV should include at minimum an email column and a
              certification name or type column. Column names will be mapped in the next step.
            </div>

            {/* Actions */}
            <div className="flex justify-end">
              <button
                onClick={goToStep2}
                disabled={!csvRows.length}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
              >
                Next: Map Columns
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Step 2: Column Mapping                                           */}
        {/* ---------------------------------------------------------------- */}
        {step === 2 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Map Columns
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Match each CSV column to the corresponding field. Fields marked{' '}
                <span className="text-red-500 font-medium">*</span> are required.
              </p>
            </div>

            <div className="space-y-4">
              {(Object.keys(FIELD_LABELS) as FieldKey[]).map(field => (
                <div key={field} className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <label className="sm:w-52 text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">
                    {FIELD_LABELS[field]}
                    {FIELD_REQUIRED[field] && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </label>
                  <select
                    value={mapping[field]}
                    onChange={(e) => setMapping(prev => ({ ...prev, [field]: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">-- Not mapped --</option>
                    {csvHeaders.map(h => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  {mapping[field] && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 italic sm:w-48 shrink-0 truncate">
                      e.g. &quot;{csvRows[0]?.[mapping[field]] || '...'}&quot;
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Mapping validation note */}
            {!mapping.email && (
              <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-400">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                Instructor Email is required for matching records to users.
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between">
              <button
                onClick={goBack}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={goToStep3}
                disabled={!mapping.email}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
              >
                Next: Preview
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Step 3: Preview                                                   */}
        {/* ---------------------------------------------------------------- */}
        {step === 3 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Preview Import
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Review the mapped data. Rows with issues are highlighted. You can exclude
                individual rows before importing.
              </p>
            </div>

            {/* Summary bar */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg text-sm font-medium text-green-700 dark:text-green-400">
                <CheckCircle className="w-4 h-4" />
                {readyRecords.length} ready to import
              </div>
              {issueRecords.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  <AlertTriangle className="w-4 h-4" />
                  {issueRecords.length} have issues
                </div>
              )}
              {mappedRecords.filter(r => r.excluded).length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400">
                  {mappedRecords.filter(r => r.excluded).length} excluded
                </div>
              )}
            </div>

            {/* Filter toggle */}
            {issueRecords.length > 0 && (
              <button
                onClick={() => setShowIssuesOnly(v => !v)}
                className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {showIssuesOnly ? (
                  <>
                    <Eye className="w-4 h-4" />
                    Show all rows
                  </>
                ) : (
                  <>
                    <EyeOff className="w-4 h-4" />
                    Show only rows with issues
                  </>
                )}
              </button>
            )}

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-600 dark:text-gray-400">
                    <th className="px-3 py-2 text-left font-medium">Row</th>
                    <th className="px-3 py-2 text-left font-medium">Email</th>
                    <th className="px-3 py-2 text-left font-medium">Cert Name</th>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-left font-medium">Expires</th>
                    <th className="px-3 py-2 text-left font-medium">Cert #</th>
                    <th className="px-3 py-2 text-left font-medium">Issues</th>
                    <th className="px-3 py-2 text-left font-medium">Exclude</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {displayedRecords.map(r => (
                    <tr
                      key={r.rowIndex}
                      className={`${
                        r.excluded
                          ? 'opacity-40 bg-gray-50 dark:bg-gray-800/50 line-through'
                          : r.issues.length > 0
                          ? 'bg-red-50 dark:bg-red-900/10'
                          : 'bg-white dark:bg-gray-800'
                      }`}
                    >
                      <td className="px-3 py-2 text-gray-400 dark:text-gray-500 text-xs">
                        {r.rowIndex}
                      </td>
                      <td className="px-3 py-2 text-gray-900 dark:text-white font-mono text-xs truncate max-w-[160px]">
                        {r.email || <span className="text-red-500">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 truncate max-w-[140px]">
                        {r.cert_name || '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400 truncate max-w-[120px]">
                        {r.cert_type || '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {r.expiration_date || '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {r.cert_number || '—'}
                      </td>
                      <td className="px-3 py-2">
                        {r.issues.length > 0 ? (
                          <ul className="space-y-0.5">
                            {r.issues.map((iss, i) => (
                              <li
                                key={i}
                                className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1"
                              >
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                {iss}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            OK
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => toggleExclude(r.rowIndex)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            r.excluded
                              ? 'bg-gray-400 border-gray-400 text-white'
                              : 'border-gray-300 dark:border-gray-600 hover:border-red-400'
                          }`}
                          title={r.excluded ? 'Include this row' : 'Exclude this row'}
                        >
                          {r.excluded && <X className="w-3 h-3" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {readyRecords.length === 0 && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-400 text-center">
                No valid rows to import. Please go back and fix the issues or adjust your column mapping.
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-2">
              <button
                onClick={goBack}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={goToStep4}
                disabled={readyRecords.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
              >
                Import {readyRecords.length} Record{readyRecords.length !== 1 ? 's' : ''}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Step 4: Import                                                    */}
        {/* ---------------------------------------------------------------- */}
        {step === 4 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Import Certifications
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {importResult
                  ? 'Import complete. Review the results below.'
                  : `Ready to import ${readyRecords.length} certification record${readyRecords.length !== 1 ? 's' : ''}.`}
              </p>
            </div>

            {/* Pre-import summary */}
            {!importResult && !importing && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Import Summary</p>
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                  <li>{readyRecords.length} records will be processed</li>
                  <li>
                    Existing certifications (matched by email + cert name) will be{' '}
                    <strong>updated</strong>
                  </li>
                  <li>
                    New certifications will be <strong>inserted</strong>
                  </li>
                  <li>
                    {mappedRecords.filter(r => r.issues.length > 0).length +
                      mappedRecords.filter(r => r.excluded).length}{' '}
                    rows will be skipped (issues or excluded)
                  </li>
                </ul>
              </div>
            )}

            {/* Progress spinner */}
            {importing && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-spin" />
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Importing {readyRecords.length} record{readyRecords.length !== 1 ? 's' : ''}...
                </p>
              </div>
            )}

            {/* Import error */}
            {importError && (
              <div className="flex items-start gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Import failed</p>
                  <p>{importError}</p>
                </div>
              </div>
            )}

            {/* Results */}
            {importResult && (
              <div className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                      {importResult.imported}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">New</p>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                      {importResult.updated}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-500 mt-0.5">Updated</p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-center">
                    <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                      {importResult.skipped}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Skipped</p>
                  </div>
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-center">
                    <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                      {importResult.errors.length}
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">Errors</p>
                  </div>
                </div>

                {/* Error list */}
                {importResult.errors.length > 0 && (
                  <div className="border border-red-200 dark:border-red-800 rounded-lg overflow-hidden">
                    <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                      <p className="text-sm font-medium text-red-700 dark:text-red-400">
                        Import Errors ({importResult.errors.length})
                      </p>
                    </div>
                    <ul className="divide-y divide-red-100 dark:divide-red-800/50 max-h-64 overflow-y-auto">
                      {importResult.errors.map((err, idx) => (
                        <li
                          key={idx}
                          className="px-4 py-2 text-xs text-red-600 dark:text-red-400 flex items-start gap-2"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          {err}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Success message */}
                {importResult.imported + importResult.updated > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-400">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    Successfully processed {importResult.imported + importResult.updated} certification
                    record{importResult.imported + importResult.updated !== 1 ? 's' : ''}.
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap justify-between gap-3 pt-2">
              {!importResult && (
                <button
                  onClick={goBack}
                  disabled={importing}
                  className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              )}
              {importResult && (
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/admin/certifications/compliance"
                    className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                  >
                    View Compliance
                  </Link>
                  <button
                    onClick={() => {
                      setStep(1);
                      setFileName('');
                      setCsvHeaders([]);
                      setCsvRows([]);
                      setMappedRecords([]);
                      setImportResult(null);
                      setImportError('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                  >
                    Import Another File
                  </button>
                </div>
              )}
              {!importResult && (
                <button
                  onClick={runImport}
                  disabled={importing || readyRecords.length === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Run Import
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
