'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';

interface ParsedTemplate {
  name: string;
  unit_number: string;
  day_of_week: number;
  shift_type: string;
  start_time: string;
  end_time: string;
  preceptor_name: string;
}

interface ParsedAvailability {
  email: string;
  firstName: string;
  lastName: string;
  available_days: Record<string, boolean>;
  preferred_shift_type: string[];
  notes: string | null;
}

interface ParsedShift {
  date: string;
  dayName: string;
  unit: string;
  preceptor: string;
  startTime: string;
  endTime: string;
  shiftType: string;
  studentName: string;
  notes: string | null;
}

interface Preview {
  templates: ParsedTemplate[];
  availability: ParsedAvailability[];
  shifts: ParsedShift[];
  warnings: string[];
}

interface ImportResults {
  templatesCreated: number;
  templatesUpdated: number;
  availabilityImported: number;
  availabilitySkipped: number;
  shiftsCreated: number;
  assignmentsCreated: number;
  assignmentsSkipped: number;
  warnings: string[];
}

const DAY_NAMES: Record<number, string> = { 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' };

export default function RideAlongImportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [results, setResults] = useState<ImportResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showTemplates, setShowTemplates] = useState(true);
  const [showAvailability, setShowAvailability] = useState(true);
  const [showShifts, setShowShifts] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setPreview(null);
    setResults(null);
    setError(null);
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('action', 'preview');

      const res = await fetch('/api/clinical/ride-alongs/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Preview failed');
      setPreview(data.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('action', 'import');

      const res = await fetch('/api/clinical/ride-alongs/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Import failed');
      setResults(data.results);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setResults(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Breadcrumbs />

        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/clinical/ride-alongs"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Import Ride-Along Schedule
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Upload an XLSX spreadsheet to import ride-along templates, availability, shifts, and assignments.
            </p>
          </div>
        </div>

        {/* File Upload */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Upload Spreadsheet
          </h2>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
              <Upload className="h-4 w-4" />
              <span>Choose File</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>

            {file && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <FileSpreadsheet className="h-4 w-4 text-green-500" />
                <span>{file.name}</span>
                <span className="text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            )}
          </div>

          {file && !preview && !results && (
            <div className="mt-4">
              <button
                onClick={handlePreview}
                disabled={loading}
                className="px-4 py-2 bg-gray-800 dark:bg-gray-600 text-white rounded-lg hover:bg-gray-900 dark:hover:bg-gray-500 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Parsing...
                  </span>
                ) : (
                  'Preview Data'
                )}
              </button>
            </div>
          )}

          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Expected sheets: <strong>Units</strong> (templates), <strong>Form Responses 1</strong> (availability),
            <strong> Master Schedule</strong> (shifts + assignments)
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Error</span>
            </div>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
          </div>
        )}

        {/* Preview */}
        {preview && (
          <>
            {/* Warnings */}
            {preview.warnings.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200 mb-2">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">Warnings ({preview.warnings.length})</span>
                </div>
                <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                  {preview.warnings.map((w, i) => (
                    <li key={i}>- {w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Summary */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Preview Summary</h3>
              <div className="grid grid-cols-3 gap-4 text-sm text-blue-800 dark:text-blue-200">
                <div>
                  <span className="font-medium">{preview.templates.length}</span> templates
                </div>
                <div>
                  <span className="font-medium">{preview.availability.length}</span> availability records
                </div>
                <div>
                  <span className="font-medium">{preview.shifts.length}</span> shift assignments
                </div>
              </div>
            </div>

            {/* Templates Preview */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="w-full px-4 py-3 flex items-center justify-between text-left"
              >
                <span className="font-medium text-gray-900 dark:text-white">
                  Templates ({preview.templates.length})
                </span>
                {showTemplates ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              {showTemplates && (
                <div className="px-4 pb-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                        <th className="pb-2 pr-4">Unit</th>
                        <th className="pb-2 pr-4">Day</th>
                        <th className="pb-2 pr-4">Time</th>
                        <th className="pb-2 pr-4">Type</th>
                        <th className="pb-2">Preceptor</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700 dark:text-gray-300">
                      {preview.templates.map((t, i) => (
                        <tr key={i} className="border-b dark:border-gray-700 last:border-0">
                          <td className="py-2 pr-4 font-mono">{t.unit_number}</td>
                          <td className="py-2 pr-4">{DAY_NAMES[t.day_of_week]}</td>
                          <td className="py-2 pr-4">{t.start_time} - {t.end_time}</td>
                          <td className="py-2 pr-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              t.shift_type === 'day' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                              t.shift_type === 'swing' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
                              'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
                            }`}>
                              {t.shift_type}
                            </span>
                          </td>
                          <td className="py-2">{t.preceptor_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Availability Preview */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
              <button
                onClick={() => setShowAvailability(!showAvailability)}
                className="w-full px-4 py-3 flex items-center justify-between text-left"
              >
                <span className="font-medium text-gray-900 dark:text-white">
                  Availability ({preview.availability.length})
                </span>
                {showAvailability ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              {showAvailability && (
                <div className="px-4 pb-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                        <th className="pb-2 pr-4">Student</th>
                        <th className="pb-2 pr-4">Email</th>
                        <th className="pb-2 pr-4">Days</th>
                        <th className="pb-2 pr-4">Shifts</th>
                        <th className="pb-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700 dark:text-gray-300">
                      {preview.availability.map((a, i) => (
                        <tr key={i} className="border-b dark:border-gray-700 last:border-0">
                          <td className="py-2 pr-4">{a.firstName} {a.lastName}</td>
                          <td className="py-2 pr-4 text-xs">{a.email}</td>
                          <td className="py-2 pr-4">
                            {Object.keys(a.available_days).filter(d => a.available_days[d]).join(', ')}
                          </td>
                          <td className="py-2 pr-4">
                            {a.preferred_shift_type.join(', ')}
                          </td>
                          <td className="py-2 text-xs text-gray-500 max-w-xs truncate">
                            {a.notes || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Shifts Preview */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
              <button
                onClick={() => setShowShifts(!showShifts)}
                className="w-full px-4 py-3 flex items-center justify-between text-left"
              >
                <span className="font-medium text-gray-900 dark:text-white">
                  Shifts + Assignments ({preview.shifts.length})
                </span>
                {showShifts ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              {showShifts && (
                <div className="px-4 pb-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                        <th className="pb-2 pr-4">Date</th>
                        <th className="pb-2 pr-4">Day</th>
                        <th className="pb-2 pr-4">Unit</th>
                        <th className="pb-2 pr-4">Preceptor</th>
                        <th className="pb-2 pr-4">Time</th>
                        <th className="pb-2 pr-4">Student</th>
                        <th className="pb-2">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700 dark:text-gray-300">
                      {preview.shifts.map((s, i) => (
                        <tr key={i} className="border-b dark:border-gray-700 last:border-0">
                          <td className="py-2 pr-4">{s.date}</td>
                          <td className="py-2 pr-4">{s.dayName}</td>
                          <td className="py-2 pr-4 font-mono">{s.unit}</td>
                          <td className="py-2 pr-4">{s.preceptor}</td>
                          <td className="py-2 pr-4">{s.startTime}-{s.endTime}</td>
                          <td className="py-2 pr-4 font-medium">{s.studentName}</td>
                          <td className="py-2 text-xs text-gray-500 max-w-xs truncate">
                            {s.notes || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleImport}
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Importing...
                  </span>
                ) : (
                  'Confirm Import'
                )}
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {/* Results */}
        {results && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Import Complete</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {results.templatesCreated + results.templatesUpdated}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Templates ({results.templatesCreated} new, {results.templatesUpdated} updated)
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {results.availabilityImported}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Availability Records
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {results.shiftsCreated}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Shifts Created
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {results.assignmentsCreated}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Assignments Created
                </div>
              </div>
            </div>

            {(results.availabilitySkipped > 0 || results.assignmentsSkipped > 0) && (
              <div className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                Skipped: {results.availabilitySkipped} availability, {results.assignmentsSkipped} assignments (no student match)
              </div>
            )}

            {results.warnings.length > 0 && (
              <div className="mt-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                  Warnings ({results.warnings.length})
                </p>
                <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1 max-h-40 overflow-y-auto">
                  {results.warnings.map((w, i) => (
                    <li key={i}>- {w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex gap-4">
              <Link
                href="/clinical/ride-alongs/shifts"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                View Shifts
              </Link>
              <button
                onClick={handleReset}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
              >
                Import Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
