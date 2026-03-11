'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle,
  XCircle, ArrowRight, ArrowLeft, Loader2, Shield,
  UserCheck, UserX, HelpCircle, RefreshCw,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface GradeEntry {
  assessmentColumn: string;
  matchedAssessmentId: string;
  matchedAssessmentTitle: string;
  scoreRaw: string;
  scoreParsed: number | null;
  conflict: boolean;
  existingScore: number | null;
}

interface PreviewStudent {
  rowIndex: number;
  csvName: string;
  csvEmail: string | null;
  csvEmstestingId: string | null;
  matched: boolean;
  matchedStudentId: string | null;
  matchedStudentName: string | null;
  matchType: string | null;
  grades: GradeEntry[];
}

interface PreviewSummary {
  totalStudents: number;
  matchedStudents: number;
  unmatchedStudents: number;
  totalGrades: number;
  conflicts: number;
  assessmentsFound: number;
  assessmentsUnmatched: string[];
  fileName: string;
}

interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
}

type WizardStep = 'upload' | 'preview' | 'confirming' | 'results';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function GradeImportPage() {
  const { data: session } = useSession();
  const [step, setStep] = useState<WizardStep>('upload');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<PreviewStudent[]>([]);
  const [summary, setSummary] = useState<PreviewSummary | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  // Handle file upload
  const handleFile = useCallback((file: File) => {
    setError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      setCsvText(e.target?.result as string || '');
    };
    reader.onerror = () => setError('Failed to read file');
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      handleFile(file);
    } else {
      setError('Please upload a .csv file');
    }
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // Step 1 → 2: Preview
  const handlePreview = async () => {
    if (!csvText) {
      setError('No CSV file loaded');
      return;
    }
    setPreviewLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/lvfr-aemt/grades/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText, fileName }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to parse CSV');
        setPreviewLoading(false);
        return;
      }

      setStudents(data.preview.students);
      setSummary(data.preview.summary);
      setStep('preview');
    } catch {
      setError('Network error — please try again');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Step 2 → 3 → 4: Confirm import
  const handleConfirm = async () => {
    setStep('confirming');
    setError(null);

    const matchedStudents = students.filter(s => s.matched);
    const grades = matchedStudents.flatMap(s =>
      s.grades
        .filter(g => g.scoreParsed !== null)
        .filter(g => updateExisting || !g.conflict)
        .map(g => ({
          student_id: s.matchedStudentId,
          assessment_id: g.matchedAssessmentId,
          score_percent: g.scoreParsed,
        }))
    );

    // Build emstesting_id mappings for backfill
    const studentIdMappings = matchedStudents
      .filter(s => s.csvEmstestingId && s.matchedStudentId)
      .map(s => ({
        csvId: s.csvEmstestingId!,
        studentId: s.matchedStudentId!,
      }));

    try {
      const res = await fetch('/api/lvfr-aemt/grades/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grades, updateExisting, studentIdMappings }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Import failed');
        setStep('preview');
        return;
      }

      setResult(data.summary);
      setStep('results');
    } catch {
      setError('Network error during import');
      setStep('preview');
    }
  };

  const resetWizard = () => {
    setStep('upload');
    setCsvText('');
    setFileName('');
    setError(null);
    setStudents([]);
    setSummary(null);
    setResult(null);
    setUpdateExisting(false);
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-700 to-red-900 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Breadcrumbs className="mb-3 [&_*]:!text-red-200 [&_a:hover]:!text-white" />
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Import Grades from CSV</h1>
              <p className="text-red-200 text-sm mt-0.5">EMSTesting.com grade export</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[
            { key: 'upload', label: '1. Upload' },
            { key: 'preview', label: '2. Preview' },
            { key: 'confirming', label: '3. Import' },
            { key: 'results', label: '4. Results' },
          ].map((s, i) => {
            const steps: WizardStep[] = ['upload', 'preview', 'confirming', 'results'];
            const currentIdx = steps.indexOf(step);
            const stepIdx = steps.indexOf(s.key as WizardStep);
            const isActive = stepIdx === currentIdx;
            const isComplete = stepIdx < currentIdx;

            return (
              <div key={s.key} className="flex items-center gap-2">
                {i > 0 && <div className={`w-8 h-0.5 ${isComplete ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                  isActive
                    ? 'bg-red-600 text-white'
                    : isComplete
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  {isComplete && <CheckCircle2 className="w-3 h-3" />}
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-red-400 dark:hover:border-red-600 transition-colors"
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">
                Drag & drop a CSV file here
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                or click to browse
              </p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium cursor-pointer transition-colors">
                <FileSpreadsheet className="w-4 h-4" />
                Choose File
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </label>
            </div>

            {fileName && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-green-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{fileName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {csvText.split('\n').length - 1} data rows detected
                  </p>
                </div>
                <button
                  onClick={handlePreview}
                  disabled={previewLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {previewLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                  Preview Import
                </button>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700 dark:text-blue-400">
                  <p className="font-medium mb-1">CSV Format Instructions</p>
                  <ul className="list-disc list-inside space-y-0.5 text-xs">
                    <li>Export your grades from EMSTesting.com as CSV</li>
                    <li>File should have student identifier columns (Name, Email, or Student ID)</li>
                    <li>Assessment columns are matched automatically by title</li>
                    <li>Scores can be percentages (85%), fractions (34/40), or plain numbers (85)</li>
                    <li>Empty cells are skipped — only rows with scores are imported</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && summary && (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard
                label="Students Matched"
                value={summary.matchedStudents}
                total={summary.totalStudents}
                color={summary.unmatchedStudents === 0 ? 'green' : 'yellow'}
              />
              <SummaryCard
                label="Grades to Import"
                value={summary.totalGrades}
                color="blue"
              />
              <SummaryCard
                label="Assessments Found"
                value={summary.assessmentsFound}
                color="purple"
              />
              <SummaryCard
                label="Conflicts"
                value={summary.conflicts}
                color={summary.conflicts > 0 ? 'yellow' : 'green'}
              />
            </div>

            {/* Unmatched assessment warnings */}
            {summary.assessmentsUnmatched.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-700 dark:text-yellow-400">
                    <p className="font-medium">Unrecognized columns (skipped):</p>
                    <p className="text-xs mt-0.5">{summary.assessmentsUnmatched.join(', ')}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Student Matching Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white">Student Matching</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">CSV Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Matched To</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Match Type</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Grades</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {students.map((s) => (
                      <tr key={s.rowIndex} className={!s.matched ? 'bg-red-50/50 dark:bg-red-900/10' : ''}>
                        <td className="px-4 py-2">
                          {s.matched ? (
                            s.matchType === 'name_fuzzy' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs">
                                <AlertTriangle className="w-3 h-3" /> Fuzzy
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">
                                <UserCheck className="w-3 h-3" /> Matched
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">
                              <UserX className="w-3 h-3" /> Unmatched
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-900 dark:text-white font-medium">
                          {s.csvName}
                          {s.csvEmail && (
                            <span className="block text-xs text-gray-500 dark:text-gray-400">{s.csvEmail}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                          {s.matchedStudentName || '—'}
                        </td>
                        <td className="px-4 py-2">
                          {s.matchType ? (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {s.matchType === 'emstesting_id' ? 'EMSTesting ID' :
                               s.matchType === 'email' ? 'Email' :
                               s.matchType === 'name_exact' ? 'Exact Name' :
                               s.matchType === 'name_fuzzy' ? 'Fuzzy Name' : s.matchType}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className="text-gray-900 dark:text-white font-medium">{s.grades.length}</span>
                          {s.grades.some(g => g.conflict) && (
                            <span className="ml-1 text-xs text-yellow-600 dark:text-yellow-400">
                              ({s.grades.filter(g => g.conflict).length} conflict{s.grades.filter(g => g.conflict).length !== 1 ? 's' : ''})
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Overwrite checkbox */}
            {summary.conflicts > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={e => setUpdateExisting(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Overwrite existing grades
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {summary.conflicts} grade{summary.conflicts !== 1 ? 's' : ''} already exist with different scores.
                      Check this to update them with the CSV values.
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setStep('upload'); setError(null); }}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <div className="flex items-center gap-3">
                {summary.unmatchedStudents > 0 && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    {summary.unmatchedStudents} unmatched student{summary.unmatchedStudents !== 1 ? 's' : ''} will be skipped
                  </p>
                )}
                <button
                  onClick={handleConfirm}
                  disabled={summary.matchedStudents === 0}
                  className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm Import ({summary.totalGrades - (updateExisting ? 0 : summary.conflicts)} grade{summary.totalGrades - (updateExisting ? 0 : summary.conflicts) !== 1 ? 's' : ''})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Confirming */}
        {step === 'confirming' && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-red-600" />
            <p className="text-lg font-medium text-gray-900 dark:text-white">Importing grades...</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">This may take a moment</p>
          </div>
        )}

        {/* Step 4: Results */}
        {step === 'results' && result && (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-green-800 dark:text-green-300 mb-1">
                Import Complete
              </h2>
              <p className="text-sm text-green-700 dark:text-green-400">
                Grades have been successfully imported from {summary?.fileName}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard label="Imported" value={result.imported} color="green" />
              <SummaryCard label="Updated" value={result.updated} color="blue" />
              <SummaryCard label="Skipped" value={result.skipped} color="gray" />
              <SummaryCard label="Failed" value={result.failed} color={result.failed > 0 ? 'red' : 'gray'} />
            </div>

            <div className="flex items-center justify-center gap-3 pt-4">
              <Link
                href="/lvfr-aemt/grades"
                className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Shield className="w-4 h-4" />
                Back to Gradebook
              </Link>
              <button
                onClick={resetWizard}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Import Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function SummaryCard({ label, value, total, color }: {
  label: string;
  value: number;
  total?: number;
  color: 'green' | 'blue' | 'purple' | 'yellow' | 'red' | 'gray';
}) {
  const colorMap = {
    green: 'text-green-600 bg-green-50 dark:bg-green-900/20',
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
    purple: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20',
    yellow: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
    red: 'text-red-600 bg-red-50 dark:bg-red-900/20',
    gray: 'text-gray-600 bg-gray-50 dark:bg-gray-800',
  };

  return (
    <div className={`rounded-lg p-3 ${colorMap[color]}`}>
      <p className="text-xs font-medium opacity-75">{label}</p>
      <p className="text-2xl font-bold">
        {value}
        {total !== undefined && (
          <span className="text-sm font-normal opacity-75"> / {total}</span>
        )}
      </p>
    </div>
  );
}
