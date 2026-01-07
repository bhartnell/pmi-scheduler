'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ChevronRight,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Users,
  X
} from 'lucide-react';

interface Cohort {
  id: string;
  cohort_number: number;
  program: { abbreviation: string };
}

interface ParsedStudent {
  first_name: string;
  last_name: string;
  email?: string;
  agency?: string;
  valid: boolean;
  error?: string;
}

export default function ImportStudentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cohortIdParam = searchParams.get('cohortId');

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState(cohortIdParam || '');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  
  const [inputMethod, setInputMethod] = useState<'paste' | 'file'>('paste');
  const [pasteData, setPasteData] = useState('');
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchCohorts();
    }
  }, [session]);

  const fetchCohorts = async () => {
    try {
      const res = await fetch('/api/lab-management/cohorts');
      const data = await res.json();
      if (data.success) {
        setCohorts(data.cohorts);
      }
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
    setLoading(false);
  };

  const parseCSV = (text: string): ParsedStudent[] => {
    const lines = text.trim().split('\n');
    if (lines.length === 0) return [];

    // Detect delimiter (comma or tab)
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    
    // Check if first line is a header
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('first') || firstLine.includes('name') || firstLine.includes('email');
    
    const dataLines = hasHeader ? lines.slice(1) : lines;
    
    return dataLines.map(line => {
      const parts = line.split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));
      
      // Try to parse: could be "First Last" or "First, Last" or "First\tLast\tEmail"
      let first_name = '';
      let last_name = '';
      let email = '';
      let agency = '';

      if (parts.length >= 2) {
        // Assume: first_name, last_name, [email], [agency]
        first_name = parts[0];
        last_name = parts[1];
        if (parts.length >= 3 && parts[2].includes('@')) {
          email = parts[2];
        } else if (parts.length >= 3) {
          agency = parts[2];
        }
        if (parts.length >= 4) {
          agency = parts[3];
        }
      } else if (parts.length === 1 && parts[0].includes(' ')) {
        // Single field with space: "First Last"
        const nameParts = parts[0].split(' ');
        first_name = nameParts[0];
        last_name = nameParts.slice(1).join(' ');
      }

      const valid = first_name.length > 0 && last_name.length > 0;
      
      return {
        first_name,
        last_name,
        email: email || undefined,
        agency: agency || undefined,
        valid,
        error: valid ? undefined : 'Missing first or last name',
      };
    }).filter(s => s.first_name || s.last_name); // Remove completely empty lines
  };

  const handlePasteChange = (value: string) => {
    setPasteData(value);
    if (value.trim()) {
      const parsed = parseCSV(value);
      setParsedStudents(parsed);
    } else {
      setParsedStudents([]);
    }
    setImportResult(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setPasteData(text);
      const parsed = parseCSV(text);
      setParsedStudents(parsed);
      setImportResult(null);
    };
    reader.readAsText(file);
  };

  const removeStudent = (index: number) => {
    const newStudents = parsedStudents.filter((_, i) => i !== index);
    setParsedStudents(newStudents);
  };

  const handleImport = async () => {
    if (!selectedCohort) {
      alert('Please select a cohort');
      return;
    }

    const validStudents = parsedStudents.filter(s => s.valid);
    if (validStudents.length === 0) {
      alert('No valid students to import');
      return;
    }

    setImporting(true);
    try {
      const res = await fetch('/api/lab-management/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cohort_id: selectedCohort,
          students: validStudents.map(s => ({
            first_name: s.first_name,
            last_name: s.last_name,
            email: s.email,
            agency: s.agency,
          })),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setImportResult({
          imported: data.imported,
          skipped: data.skipped,
        });
        setParsedStudents([]);
        setPasteData('');
      } else {
        alert('Import failed: ' + data.error);
      }
    } catch (error) {
      console.error('Error importing:', error);
      alert('Import failed');
    }
    setImporting(false);
  };

  const validCount = parsedStudents.filter(s => s.valid).length;
  const invalidCount = parsedStudents.filter(s => !s.valid).length;
  const selectedCohortData = cohorts.find(c => c.id === selectedCohort);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <Link href="/lab-management" className="hover:text-blue-600">Lab Management</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/lab-management/students" className="hover:text-blue-600">Students</Link>
            <ChevronRight className="w-4 h-4" />
            <span>Import</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Import Students</h1>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Success Message */}
        {importResult && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
            <div>
              <h3 className="font-medium text-green-800">Import Complete!</h3>
              <p className="text-green-700">
                Successfully imported {importResult.imported} student{importResult.imported !== 1 ? 's' : ''}.
                {importResult.skipped > 0 && ` ${importResult.skipped} skipped due to missing data.`}
              </p>
              <Link
                href={`/lab-management/students${selectedCohort ? `?cohortId=${selectedCohort}` : ''}`}
                className="text-green-800 font-medium hover:underline mt-2 inline-block"
              >
                View Students →
              </Link>
            </div>
          </div>
        )}

        {/* Cohort Selection */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Cohort</h2>
          <select
            value={selectedCohort}
            onChange={(e) => setSelectedCohort(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white"
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
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Student Data</h2>
          
          {/* Method Toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setInputMethod('paste')}
              className={`px-4 py-2 rounded-lg font-medium ${
                inputMethod === 'paste' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Paste Data
            </button>
            <button
              onClick={() => setInputMethod('file')}
              className={`px-4 py-2 rounded-lg font-medium ${
                inputMethod === 'file' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Upload File
            </button>
          </div>

          {inputMethod === 'paste' ? (
            <div>
              <p className="text-sm text-gray-600 mb-2">
                Paste student data from Excel or a spreadsheet. Format: First Name, Last Name, Email (optional), Agency (optional)
              </p>
              <textarea
                value={pasteData}
                onChange={(e) => handlePasteChange(e.target.value)}
                placeholder={`John, Doe, john@email.com, AMR\nJane, Smith, jane@email.com\nBob Johnson`}
                rows={8}
                className="w-full px-3 py-2 border rounded-lg text-gray-900 bg-white font-mono text-sm"
              />
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-2">
                Upload a CSV or TXT file with student data.
              </p>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <FileSpreadsheet className="w-10 h-10 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">Click to upload CSV or TXT file</p>
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

        {/* Preview */}
        {parsedStudents.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                Preview ({validCount} valid, {invalidCount} invalid)
              </h2>
              <button
                onClick={() => { setParsedStudents([]); setPasteData(''); }}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Clear All
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">First Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Last Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Agency</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {parsedStudents.map((student, index) => (
                    <tr key={index} className={student.valid ? '' : 'bg-red-50'}>
                      <td className="px-4 py-2">
                        {student.valid ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">{student.first_name || '—'}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{student.last_name || '—'}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{student.email || '—'}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{student.agency || '—'}</td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => removeStudent(index)}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Import Button */}
        {parsedStudents.length > 0 && validCount > 0 && (
          <div className="flex gap-3">
            <Link
              href="/lab-management/students"
              className="px-6 py-3 border text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              onClick={handleImport}
              disabled={importing || !selectedCohort}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {importing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Import {validCount} Student{validCount !== 1 ? 's' : ''}
                  {selectedCohortData && ` to ${selectedCohortData.program.abbreviation} G${selectedCohortData.cohort_number}`}
                </>
              )}
            </button>
          </div>
        )}

        {/* Help Text */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-800 mb-2">Tips for importing</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Copy and paste directly from Excel, Google Sheets, or any spreadsheet</li>
            <li>• Each student should be on a separate line</li>
            <li>• Minimum required: First Name and Last Name</li>
            <li>• Optional fields: Email, Agency</li>
            <li>• Supported formats: comma-separated, tab-separated, or "First Last" on each line</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
