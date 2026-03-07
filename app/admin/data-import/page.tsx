'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  X,
  Download,
  ChevronRight,
  Clock,
  Users,
  Activity,
  ClipboardCheck,
  CalendarDays,
  Loader2,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import Breadcrumbs from '@/components/Breadcrumbs';
import { PageLoader } from '@/components/ui';

// ── Types ─────────────────────────────────────────────────────────────────────

type ImportType = 'students' | 'clinical_hours' | 'skill_evaluations' | 'attendance';

type Step = 'upload' | 'mapping' | 'preview' | 'import' | 'done';

interface ColumnMapping {
  csvColumn: string;
  dbField: string;
}

interface MatchResult {
  row: Record<string, string>;
  rowIndex: number;
  matched: boolean;
  matchedId?: string;
  matchedName?: string;
  matchType?: string;
  issues: string[];
  warnings: string[];
}

interface ImportRowResult {
  rowIndex: number;
  status: 'imported' | 'updated' | 'skipped' | 'failed';
  message?: string;
}

interface ImportSummary {
  imported: number;
  updated: number;
  failed: number;
  skipped: number;
  total: number;
}

interface ImportHistoryEntry {
  id: string;
  import_type: string;
  file_name: string;
  records_total: number;
  records_imported: number;
  records_failed: number;
  error_log: { row: number; message: string }[] | null;
  imported_by: string;
  created_at: string;
}

// ── Tab Configuration ─────────────────────────────────────────────────────────

interface TabConfig {
  id: ImportType;
  label: string;
  icon: typeof Users;
  description: string;
  dbFields: { key: string; label: string; required?: boolean }[];
  templateHeaders: string[];
  templateRows: string[];
}

const TABS: TabConfig[] = [
  {
    id: 'students',
    label: 'Student Roster',
    icon: Users,
    description: 'Import or update student records from CSV. Matches existing students by email or name.',
    dbFields: [
      { key: 'first_name', label: 'First Name', required: true },
      { key: 'last_name', label: 'Last Name', required: true },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'agency', label: 'Agency' },
      { key: 'cohort_number', label: 'Cohort Number' },
      { key: 'status', label: 'Status' },
    ],
    templateHeaders: ['first_name', 'last_name', 'email', 'phone', 'agency', 'cohort_number', 'status'],
    templateRows: [
      'John,Doe,john.doe@example.com,555-1234,AMR,42,active',
      'Jane,Smith,jane.smith@example.com,555-5678,Fire Dept,42,active',
    ],
  },
  {
    id: 'clinical_hours',
    label: 'Clinical Hours',
    icon: Activity,
    description: 'Import clinical rotation hours from Platinum Planner or similar exports. Matches students by email or name.',
    dbFields: [
      { key: 'student_name', label: 'Student Name' },
      { key: 'email', label: 'Email' },
      { key: 'ed_hours', label: 'ED Hours' },
      { key: 'icu_hours', label: 'ICU Hours' },
      { key: 'ob_hours', label: 'OB Hours' },
      { key: 'or_hours', label: 'OR Hours' },
      { key: 'psych_hours', label: 'Psych Hours' },
      { key: 'peds_ed_hours', label: 'Peds ED Hours' },
      { key: 'peds_icu_hours', label: 'Peds ICU Hours' },
      { key: 'ems_field_hours', label: 'EMS Field Hours' },
      { key: 'cardiology_hours', label: 'Cardiology Hours' },
      { key: 'ems_ridealong_hours', label: 'EMS Ridealong Hours' },
      { key: 'total_hours', label: 'Total Hours' },
      { key: 'total_shifts', label: 'Total Shifts' },
    ],
    templateHeaders: ['student_name', 'email', 'ed_hours', 'icu_hours', 'ob_hours', 'or_hours', 'psych_hours', 'peds_ed_hours', 'peds_icu_hours', 'ems_field_hours', 'cardiology_hours', 'ems_ridealong_hours'],
    templateRows: [
      'John Doe,john.doe@example.com,24,16,8,8,8,4,4,40,8,12',
      'Jane Smith,jane.smith@example.com,20,12,6,6,8,4,4,36,8,10',
    ],
  },
  {
    id: 'skill_evaluations',
    label: 'Skill Evaluations',
    icon: ClipboardCheck,
    description: 'Import skill sign-off records. Matches students and skills by name with fuzzy matching.',
    dbFields: [
      { key: 'student_name', label: 'Student Name', required: true },
      { key: 'skill_name', label: 'Skill Name', required: true },
      { key: 'date', label: 'Date' },
      { key: 'evaluator', label: 'Evaluator' },
      { key: 'score', label: 'Score' },
      { key: 'pass_fail', label: 'Pass/Fail' },
    ],
    templateHeaders: ['student_name', 'skill_name', 'date', 'evaluator', 'score', 'pass_fail'],
    templateRows: [
      'John Doe,IV Insertion,2025-09-15,Dr. Smith,95,pass',
      'Jane Smith,Intubation,2025-09-16,Dr. Jones,88,pass',
    ],
  },
  {
    id: 'attendance',
    label: 'Attendance',
    icon: CalendarDays,
    description: 'Import lab day attendance records. Matches students by name and lab days by date.',
    dbFields: [
      { key: 'student_name', label: 'Student Name', required: true },
      { key: 'date', label: 'Date', required: true },
      { key: 'status', label: 'Status (present/absent/late/excused)', required: true },
    ],
    templateHeaders: ['student_name', 'date', 'status'],
    templateRows: [
      'John Doe,2025-09-15,present',
      'Jane Smith,2025-09-15,absent',
      'Bob Wilson,2025-09-15,late',
    ],
  },
];

// ── CSV Parser ────────────────────────────────────────────────────────────────

function parseCSVText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split('\n').filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const delimiter = lines[0].includes('\t') ? '\t' : ',';

  // Parse a single line handling quoted fields
  function parseLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === delimiter) {
          fields.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    fields.push(current.trim());
    return fields;
  }

  const headers = parseLine(lines[0]);

  // Detect if first row is a header
  const firstLower = headers.map((h) => h.toLowerCase());
  const likelyHeader = firstLower.some(
    (h) =>
      h.includes('name') ||
      h.includes('email') ||
      h.includes('date') ||
      h.includes('status') ||
      h.includes('hours') ||
      h.includes('first') ||
      h.includes('last') ||
      h.includes('skill') ||
      h.includes('student')
  );

  const dataLines = likelyHeader ? lines.slice(1) : lines;
  const finalHeaders = likelyHeader
    ? headers.map((h) => h.replace(/^["']|["']$/g, ''))
    : headers.map((_, i) => `Column ${i + 1}`);

  const rows = dataLines.map((line) => {
    const fields = parseLine(line);
    const obj: Record<string, string> = {};
    finalHeaders.forEach((h, i) => {
      obj[h] = fields[i] || '';
    });
    return obj;
  });

  return { headers: finalHeaders, rows };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function autoDetectMappings(csvHeaders: string[], dbFields: { key: string; label: string }[]): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];
  const usedCsvCols = new Set<string>();

  for (const field of dbFields) {
    const key = field.key.toLowerCase();
    const label = field.label.toLowerCase();

    // Try exact match on key or label
    let match = csvHeaders.find(
      (h) => {
        const hn = h.toLowerCase().replace(/[^a-z0-9]/g, '');
        const kn = key.replace(/[^a-z0-9]/g, '');
        const ln = label.replace(/[^a-z0-9]/g, '');
        return (hn === kn || hn === ln) && !usedCsvCols.has(h);
      }
    );

    // Try partial match
    if (!match) {
      match = csvHeaders.find(
        (h) => {
          const hn = h.toLowerCase();
          return (hn.includes(key) || key.includes(hn) || hn.includes(label) || label.includes(hn)) &&
            !usedCsvCols.has(h);
        }
      );
    }

    if (match) {
      usedCsvCols.add(match);
      mappings.push({ csvColumn: match, dbField: field.key });
    } else {
      mappings.push({ csvColumn: '', dbField: field.key });
    }
  }

  return mappings;
}

function downloadTemplate(tab: TabConfig) {
  const csv = [tab.templateHeaders.join(','), ...tab.templateRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${tab.id}-import-template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DataImportPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  // Auth state
  const [currentUser, setCurrentUser] = useState<{ role: string; email: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Active tab
  const [activeTab, setActiveTab] = useState<ImportType>('students');

  // Import workflow state
  const [step, setStep] = useState<Step>('upload');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [previewResults, setPreviewResults] = useState<MatchResult[]>([]);
  const [previewStats, setPreviewStats] = useState({ total: 0, matched: 0, issues: 0 });
  const [importResults, setImportResults] = useState<ImportRowResult[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  // History
  const [history, setHistory] = useState<ImportHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeTabConfig = TABS.find((t) => t.id === activeTab)!;

  // ── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/');
    }
  }, [authStatus, router]);

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
    } catch (error) {
      console.error('Error fetching user:', error);
    }
    setLoading(false);
  };

  // ── History ─────────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/data-import/history?importType=${activeTab}&limit=10`);
      const data = await res.json();
      if (data.success) {
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  }, [activeTab]);

  useEffect(() => {
    if (currentUser) {
      fetchHistory();
    }
  }, [currentUser, activeTab, fetchHistory]);

  // ── Reset ─────────────────────────────────────────────────────────────

  const resetWorkflow = useCallback(() => {
    setStep('upload');
    setCsvHeaders([]);
    setCsvRows([]);
    setFileName('');
    setColumnMappings([]);
    setPreviewResults([]);
    setPreviewStats({ total: 0, matched: 0, issues: 0 });
    setImportResults([]);
    setImportSummary(null);
    setImporting(false);
    setPreviewing(false);
  }, []);

  // Reset when tab changes
  useEffect(() => {
    resetWorkflow();
  }, [activeTab, resetWorkflow]);

  // ── File Upload ─────────────────────────────────────────────────────────

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith('.csv') && !file.name.endsWith('.tsv') && !file.name.endsWith('.txt')) {
        alert('Please upload a CSV file');
        return;
      }

      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const { headers, rows } = parseCSVText(text);
        if (rows.length === 0) {
          alert('No data rows found in the file');
          return;
        }
        setCsvHeaders(headers);
        setCsvRows(rows);
        const mappings = autoDetectMappings(headers, activeTabConfig.dbFields);
        setColumnMappings(mappings);
        setStep('mapping');
      };
      reader.readAsText(file);
    },
    [activeTabConfig]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // ── Preview ─────────────────────────────────────────────────────────────

  const runPreview = async () => {
    setPreviewing(true);
    try {
      const res = await fetch('/api/admin/data-import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importType: activeTab,
          rows: csvRows,
          headers: csvHeaders,
          columnMappings,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewResults(data.allResults || []);
        setPreviewStats({
          total: data.totalRows || 0,
          matched: data.matchedCount || 0,
          issues: data.issueCount || 0,
        });
        setStep('preview');
      } else {
        alert(data.error || 'Preview failed');
      }
    } catch (error) {
      console.error('Preview error:', error);
      alert('Failed to preview import data');
    }
    setPreviewing(false);
  };

  // ── Execute Import ──────────────────────────────────────────────────────

  const executeImport = async () => {
    if (!confirm(`Import ${csvRows.length} records as ${activeTabConfig.label}? This action will modify the database.`)) {
      return;
    }

    setImporting(true);
    setStep('import');
    try {
      const res = await fetch('/api/admin/data-import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importType: activeTab,
          rows: csvRows,
          columnMappings,
          fileName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setImportResults(data.results || []);
        setImportSummary(data.summary || null);
        setStep('done');
        fetchHistory();
      } else {
        alert(data.error || 'Import failed');
        setStep('preview');
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to execute import');
      setStep('preview');
    }
    setImporting(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────

  if (authStatus === 'loading' || loading) {
    return <PageLoader />;
  }

  if (!session || !currentUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Breadcrumbs className="mb-2" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/admin"
                className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </Link>
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
                <Upload className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Data Import</h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Import historical student data from CSV files
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-700 dark:text-gray-300"
            >
              <Clock className="w-4 h-4" />
              Import History
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    isActive
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Description */}
          <div className="px-5 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">{activeTabConfig.description}</p>
          </div>

          {/* Step Progress */}
          <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-xs">
              {(['upload', 'mapping', 'preview', 'import'] as const).map((s, i) => {
                const labels: Record<typeof s, string> = { upload: 'Upload', mapping: 'Map Columns', preview: 'Preview', import: 'Import' };
                const stepOrder = ['upload', 'mapping', 'preview', 'import', 'done'];
                const currentIdx = stepOrder.indexOf(step);
                const thisIdx = stepOrder.indexOf(s);
                const isComplete = thisIdx < currentIdx;
                const isCurrent = s === step || (step === 'done' && s === 'import');
                return (
                  <div key={s} className="flex items-center gap-2">
                    {i > 0 && <ChevronRight className="w-3 h-3 text-gray-300 dark:text-gray-600" />}
                    <div
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${
                        isComplete
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                          : isCurrent
                          ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {isComplete && <CheckCircle className="w-3 h-3" />}
                      <span className="font-medium">{labels[s]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Content Area */}
          <div className="p-5">
            {/* Step 1: Upload */}
            {step === 'upload' && (
              <div className="space-y-4">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-750'
                  }`}
                >
                  <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    Drop your CSV file here
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    or click to browse. Supports CSV and TSV files.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.tsv,.txt"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={() => downloadTemplate(activeTabConfig)}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-700 dark:text-gray-300"
                  >
                    <Download className="w-4 h-4" />
                    Download Template
                  </button>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Expected columns: {activeTabConfig.dbFields.map((f) => f.label).join(', ')}
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Column Mapping */}
            {step === 'mapping' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Column Mapping
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      <FileSpreadsheet className="w-4 h-4 inline mr-1" />
                      {fileName} &mdash; {csvRows.length} rows, {csvHeaders.length} columns
                    </p>
                  </div>
                  <button
                    onClick={resetWorkflow}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Start Over
                  </button>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Map your CSV columns to the expected database fields. Auto-detection has been applied.
                </p>

                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-3">
                  {activeTabConfig.dbFields.map((field) => {
                    const mapping = columnMappings.find((m) => m.dbField === field.key);
                    return (
                      <div key={field.key} className="flex items-center gap-3">
                        <div className="w-48 flex-shrink-0">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-0.5">*</span>}
                          </label>
                        </div>
                        <ArrowLeft className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <select
                          value={mapping?.csvColumn || ''}
                          onChange={(e) => {
                            setColumnMappings((prev) =>
                              prev.map((m) =>
                                m.dbField === field.key
                                  ? { ...m, csvColumn: e.target.value }
                                  : m
                              )
                            );
                          }}
                          className="flex-1 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">-- Not mapped --</option>
                          {csvHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                        {mapping?.csvColumn && (
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Sample data preview */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Sample Data (first 3 rows)
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border border-gray-200 dark:border-gray-700">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-900/50">
                          {csvHeaders.map((h) => (
                            <th
                              key={h}
                              className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvRows.slice(0, 3).map((row, i) => (
                          <tr
                            key={i}
                            className="border-b border-gray-100 dark:border-gray-700/50"
                          >
                            {csvHeaders.map((h) => (
                              <td
                                key={h}
                                className="px-3 py-1.5 text-gray-800 dark:text-gray-200"
                              >
                                {row[h] || ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={resetWorkflow}
                    className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={runPreview}
                    disabled={previewing}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {previewing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                    Preview Matches
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Preview */}
            {step === 'preview' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Import Preview
                  </h3>
                  <button
                    onClick={resetWorkflow}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Start Over
                  </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {previewStats.total}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">Total Rows</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {previewStats.matched}
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300">Matched</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {previewStats.issues}
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-300">Issues</p>
                  </div>
                </div>

                {/* Preview Table */}
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-xs border border-gray-200 dark:border-gray-700">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/80 z-10">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                          #
                        </th>
                        {activeTabConfig.dbFields.slice(0, 4).map((f) => (
                          <th
                            key={f.key}
                            className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700"
                          >
                            {f.label}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                          Match Status
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                          Issues
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewResults.slice(0, 50).map((result) => {
                        const hasIssues = result.issues.length > 0;
                        const hasWarnings = result.warnings.length > 0;
                        return (
                          <tr
                            key={result.rowIndex}
                            className={`border-b border-gray-100 dark:border-gray-700/50 ${
                              hasIssues
                                ? 'bg-red-50 dark:bg-red-900/10'
                                : hasWarnings
                                ? 'bg-amber-50 dark:bg-amber-900/10'
                                : ''
                            }`}
                          >
                            <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">
                              {result.rowIndex + 1}
                            </td>
                            {activeTabConfig.dbFields.slice(0, 4).map((f) => (
                              <td
                                key={f.key}
                                className="px-3 py-1.5 text-gray-800 dark:text-gray-200"
                              >
                                {result.row[f.key] || '-'}
                              </td>
                            ))}
                            <td className="px-3 py-1.5">
                              {result.matched ? (
                                <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
                                  <CheckCircle className="w-3 h-3" />
                                  {result.matchType}
                                  {result.matchedName && (
                                    <span className="text-gray-500 dark:text-gray-400">
                                      ({result.matchedName})
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-gray-500 dark:text-gray-400">
                                  {result.matchType || 'No match'}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-1.5">
                              {hasIssues && (
                                <div className="flex items-start gap-1 text-red-600 dark:text-red-400">
                                  <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                  <span>{result.issues.join('; ')}</span>
                                </div>
                              )}
                              {hasWarnings && (
                                <div className="flex items-start gap-1 text-amber-600 dark:text-amber-400">
                                  <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                  <span>{result.warnings.join('; ')}</span>
                                </div>
                              )}
                              {!hasIssues && !hasWarnings && (
                                <span className="text-green-600 dark:text-green-400">OK</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {previewResults.length > 50 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 px-3">
                      Showing first 50 of {previewResults.length} rows
                    </p>
                  )}
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setStep('mapping')}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Mapping
                  </button>
                  <button
                    onClick={executeImport}
                    disabled={importing}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {importing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    Execute Import ({previewStats.total} rows)
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Importing */}
            {step === 'import' && importing && (
              <div className="text-center py-12">
                <Loader2 className="w-12 h-12 mx-auto mb-4 text-indigo-500 animate-spin" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  Importing Data...
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Processing {csvRows.length} records. Please wait.
                </p>
              </div>
            )}

            {/* Step 5: Done */}
            {step === 'done' && importSummary && (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Import Complete
                  </h3>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {importSummary.imported}
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300">Imported</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {importSummary.updated}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">Updated</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {importSummary.skipped}
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">Skipped</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {importSummary.failed}
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-300">Failed</p>
                  </div>
                </div>

                {/* Per-row results */}
                {importResults.length > 0 && (
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-xs border border-gray-200 dark:border-gray-700">
                      <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900/80">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                            Row
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                            Status
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                            Details
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResults.map((r) => (
                          <tr
                            key={r.rowIndex}
                            className="border-b border-gray-100 dark:border-gray-700/50"
                          >
                            <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">
                              {r.rowIndex + 1}
                            </td>
                            <td className="px-3 py-1.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                  r.status === 'imported'
                                    ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                                    : r.status === 'updated'
                                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                    : r.status === 'skipped'
                                    ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                                    : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                                }`}
                              >
                                {r.status}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">
                              {r.message || ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex justify-center">
                  <button
                    onClick={resetWorkflow}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Import More Data
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Import History Panel */}
        {showHistory && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Import History ({activeTabConfig.label})
              </h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {history.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                No import history for this type yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50">
                      <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                        Date
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                        File
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                        Imported By
                      </th>
                      <th className="px-4 py-2 text-center font-medium text-gray-600 dark:text-gray-400">
                        Total
                      </th>
                      <th className="px-4 py-2 text-center font-medium text-gray-600 dark:text-gray-400">
                        Success
                      </th>
                      <th className="px-4 py-2 text-center font-medium text-gray-600 dark:text-gray-400">
                        Failed
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-t border-gray-100 dark:border-gray-700/50"
                      >
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {formatDate(entry.created_at)}
                        </td>
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                          {entry.file_name}
                        </td>
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                          {entry.imported_by}
                        </td>
                        <td className="px-4 py-2 text-center text-gray-700 dark:text-gray-300">
                          {entry.records_total}
                        </td>
                        <td className="px-4 py-2 text-center text-green-600 dark:text-green-400 font-medium">
                          {entry.records_imported}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {entry.records_failed > 0 ? (
                            <span className="text-red-600 dark:text-red-400 font-medium">
                              {entry.records_failed}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
