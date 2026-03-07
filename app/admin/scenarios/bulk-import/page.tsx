'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Upload,
  FileText,
  FileJson,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowLeft,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  Info,
  Wand2,
  Eye,
  RefreshCcw,
} from 'lucide-react';
import { canAccessAdmin } from '@/lib/permissions';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PageLoader } from '@/components/ui';
import Breadcrumbs from '@/components/Breadcrumbs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface PreviewScenario {
  index: number;
  title: string;
  category: string | null;
  difficulty: string;
  phaseCount: number;
  criticalActionCount: number;
  valid: boolean;
  errors: string[];
  warnings: string[];
  parsed: Record<string, unknown> | null;
}

interface PreviewResponse {
  success: boolean;
  format: 'json' | 'csv';
  total: number;
  valid: number;
  invalid: number;
  scenarios: PreviewScenario[];
  error?: string;
}

interface CommitResult {
  index: number;
  title: string;
  id?: string;
  error?: string;
}

interface CommitResponse {
  success: boolean;
  message: string;
  total: number;
  importedCount: number;
  failedCount: number;
  imported: CommitResult[];
  failed?: CommitResult[];
  error?: string;
}

type Step = 'upload' | 'preview' | 'results';

// Transform types
interface TransformPreviewScenario {
  id: string;
  title: string;
  needs_transformation: boolean;
  reasons: string[];
  created_at: string;
}

interface TransformPreview {
  total_checked: number;
  needs_transformation: number;
  already_correct: number;
  scenarios: TransformPreviewScenario[];
}

interface TransformResultDetail {
  id: string;
  title: string;
  status: 'transformed' | 'already_correct' | 'error';
  changes?: string[];
  error?: string;
}

interface TransformResults {
  total_checked: number;
  transformed: number;
  already_correct: number;
  errors: number;
  details: TransformResultDetail[];
}

// ---------------------------------------------------------------------------
// Helper: difficulty badge
// ---------------------------------------------------------------------------
function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors: Record<string, string> = {
    beginner: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    intermediate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    advanced: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    expert: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  };
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full capitalize ${colors[difficulty] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
      {difficulty}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sample JSON template
// ---------------------------------------------------------------------------
const SAMPLE_JSON = `[
  {
    "title": "Cardiac Arrest - Witnessed VFib",
    "category": "Cardiac",
    "difficulty": "intermediate",
    "chief_complaint": "Unresponsive male",
    "dispatch_notes": "Respond to a 55-year-old male who collapsed while watching TV",
    "dispatch_location": "Residential home",
    "patient_name": "John Smith",
    "patient_age": "55",
    "patient_sex": "Male",
    "allergies": "NKDA",
    "medications": ["Metoprolol", "Aspirin 81mg"],
    "medical_history": ["HTN", "Previous MI 2019"],
    "signs_symptoms": "Unresponsive, apneic, pulseless",
    "last_oral_intake": "Lunch 2 hours ago",
    "events_leading": "Was watching TV, complained of chest pain, then collapsed",
    "phases": [
      {
        "name": "Initial Assessment",
        "trigger": "On arrival",
        "presentation_notes": "55yo male found supine on living room floor. Wife performing hands-only CPR.",
        "expected_actions": ["Scene safety", "BSI/PPE", "Check responsiveness", "Check pulse - no pulse", "Begin high-quality CPR"],
        "vitals": {
          "hr": "0",
          "bp": "0/0",
          "rr": "0",
          "spo2": "0%",
          "ekg_rhythm": "Ventricular Fibrillation",
          "pupils": "Fixed, dilated",
          "skin": "Cyanotic, cool"
        }
      },
      {
        "name": "Post-Defibrillation",
        "trigger": "After first shock delivered",
        "presentation_notes": "Patient remains pulseless after first defibrillation. Continue CPR.",
        "expected_actions": ["Continue CPR 2 minutes", "Reassess rhythm", "Consider second shock if VFib persists"],
        "vitals": {
          "hr": "0",
          "bp": "0/0",
          "rr": "0",
          "spo2": "0%",
          "ekg_rhythm": "Ventricular Fibrillation"
        }
      }
    ],
    "critical_actions": [
      "Initiate CPR within 30 seconds",
      "Apply AED/defibrillator pads",
      "Deliver shock for VFib",
      "Minimize interruptions in CPR",
      "Request ALS backup"
    ],
    "debrief_points": ["Discuss CPR quality metrics", "Review AED algorithm", "Chain of survival"],
    "learning_objectives": ["Demonstrate high-quality CPR", "Properly operate AED"],
    "applicable_programs": ["EMT", "AEMT", "Paramedic"]
  }
]`;

const SAMPLE_CSV_HEADERS = 'title,category,difficulty,chief_complaint,dispatch_notes,dispatch_location,patient_name,patient_age,patient_sex,allergies,medications,medical_history,critical_actions';
const SAMPLE_CSV_ROW = '"Cardiac Arrest - Witnessed VFib","Cardiac","intermediate","Unresponsive male","55yo male collapsed while watching TV","Residential home","John Smith","55","Male","NKDA","Metoprolol;Aspirin","HTN;Previous MI","Initiate CPR within 30 seconds;Apply AED;Deliver shock"';

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------
export default function BulkImportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<CommitResponse | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [showSampleJson, setShowSampleJson] = useState(false);
  const [showSampleCsv, setShowSampleCsv] = useState(false);
  const [importOnlyValid, setImportOnlyValid] = useState(true);

  // Transform state
  const [transformPreview, setTransformPreview] = useState<TransformPreview | null>(null);
  const [transformLoading, setTransformLoading] = useState(false);
  const [transformRunning, setTransformRunning] = useState(false);
  const [transformResults, setTransformResults] = useState<TransformResults | null>(null);
  const [transformError, setTransformError] = useState<string | null>(null);
  const [transformExpanded, setTransformExpanded] = useState(false);

  // Auth guard
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.email) {
      fetch('/api/instructor/me')
        .then(r => r.json())
        .then(data => {
          if (data.success && data.user) {
            if (!canAccessAdmin(data.user.role)) {
              router.push('/');
              return;
            }
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [session, router]);

  // ---------------------------------------------------------------------------
  // Upload file
  // ---------------------------------------------------------------------------
  const handleFile = useCallback(async (file: File) => {
    setUploadError(null);
    setFileName(file.name);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Auto-detect format from extension
      if (file.name.endsWith('.csv')) {
        formData.append('format', 'csv');
      } else {
        formData.append('format', 'json');
      }

      const res = await fetch('/api/admin/scenarios/bulk-import', {
        method: 'POST',
        body: formData,
      });

      const data: PreviewResponse = await res.json();

      if (!res.ok || !data.success) {
        setUploadError(data.error || 'Failed to parse file');
        return;
      }

      setPreview(data);
      setStep('preview');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ---------------------------------------------------------------------------
  // Commit import
  // ---------------------------------------------------------------------------
  const handleCommit = async () => {
    if (!preview) return;

    const scenariosToImport = importOnlyValid
      ? preview.scenarios.filter(s => s.valid).map(s => s.parsed)
      : preview.scenarios.map(s => s.parsed).filter(Boolean);

    if (scenariosToImport.length === 0) {
      setUploadError('No valid scenarios to import');
      return;
    }

    setCommitting(true);
    setUploadError(null);

    try {
      const res = await fetch('/api/admin/scenarios/bulk-import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarios: scenariosToImport }),
      });

      const data: CommitResponse = await res.json();

      if (!res.ok) {
        setUploadError(data.error || 'Failed to import scenarios');
        return;
      }

      setCommitResult(data);
      setStep('results');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setCommitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------
  const handleReset = () => {
    setStep('upload');
    setFileName(null);
    setPreview(null);
    setCommitResult(null);
    setUploadError(null);
    setExpandedRows(new Set());
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ---------------------------------------------------------------------------
  // Toggle row expansion
  // ---------------------------------------------------------------------------
  const toggleRow = (index: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // Download sample file
  // ---------------------------------------------------------------------------
  const downloadSample = (format: 'json' | 'csv') => {
    let content: string;
    let mimeType: string;
    let ext: string;

    if (format === 'json') {
      content = SAMPLE_JSON;
      mimeType = 'application/json';
      ext = 'json';
    } else {
      content = SAMPLE_CSV_HEADERS + '\n' + SAMPLE_CSV_ROW;
      mimeType = 'text/csv';
      ext = 'csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scenario-import-template.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------------------------------------------------------------------------
  // Transform Legacy Scenarios
  // ---------------------------------------------------------------------------
  const loadTransformPreview = async () => {
    setTransformLoading(true);
    setTransformError(null);
    setTransformResults(null);
    try {
      const res = await fetch('/api/admin/scenarios/transform');
      const data = await res.json();
      if (data.success && data.preview) {
        setTransformPreview(data.preview as TransformPreview);
      } else {
        setTransformError(data.error || 'Failed to load transform preview');
      }
    } catch (err) {
      setTransformError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setTransformLoading(false);
    }
  };

  const runTransform = async () => {
    if (!transformPreview) return;
    setTransformRunning(true);
    setTransformError(null);
    try {
      const res = await fetch('/api/admin/scenarios/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transformAll: true }),
      });
      const data = await res.json();
      if (data.success && data.results) {
        setTransformResults(data.results as TransformResults);
        // Refresh preview to show updated counts
        loadTransformPreview();
      } else {
        setTransformError(data.error || 'Transform failed');
      }
    } catch (err) {
      setTransformError(err instanceof Error ? err.message : 'Transform failed');
    } finally {
      setTransformRunning(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render guards
  // ---------------------------------------------------------------------------
  if (status === 'loading' || loading) return <PageLoader />;
  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Breadcrumbs className="mb-2" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Upload className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bulk Scenario Import</h1>
                <p className="text-gray-600 dark:text-gray-400">Upload JSON or CSV files to import multiple BLS scenarios at once</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/admin/scenarios"
                className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Scenarios
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      <main id="main-content" className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Step indicator */}
        <div className="flex items-center gap-4">
          {(['upload', 'preview', 'results'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className={`h-px w-8 ${step === s || (s === 'results' && step === 'results') || (s === 'preview' && (step === 'preview' || step === 'results')) ? 'bg-emerald-400' : 'bg-gray-300 dark:bg-gray-600'}`} />}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                step === s
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : (s === 'upload' && step !== 'upload') || (s === 'preview' && step === 'results')
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs bg-current/10">
                  {(s === 'upload' && step !== 'upload') || (s === 'preview' && step === 'results')
                    ? <CheckCircle className="w-4 h-4" />
                    : i + 1}
                </span>
                <span className="capitalize">{s}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Error banner */}
        {uploadError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 dark:text-red-300 font-medium">Error</p>
              <p className="text-red-700 dark:text-red-400 text-sm">{uploadError}</p>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 1: Upload */}
        {/* ============================================================== */}
        {step === 'upload' && (
          <div className="space-y-6">
            {/* Format Info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">Supported Formats</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300">
                    <li><strong>JSON</strong> - Full scenario data including phases, vitals, and SAMPLE history</li>
                    <li><strong>CSV</strong> - Simplified format with one scenario per row (no nested phases)</li>
                  </ul>
                  <p className="mt-2">Download a sample template below, fill in your scenarios, then upload. All scenarios are previewed before import.</p>
                </div>
              </div>
            </div>

            {/* Drop zone */}
            <div
              className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
                dragOver
                  ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv"
                className="hidden"
                onChange={handleFileInput}
              />
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
                  <p className="text-gray-600 dark:text-gray-400">Parsing {fileName}...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                  <div>
                    <p className="text-lg font-medium text-gray-900 dark:text-white">
                      Drop a file here or click to browse
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Accepts .json or .csv files (up to 200 scenarios)
                    </p>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                      <FileJson className="w-4 h-4" /> JSON
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                      <FileText className="w-4 h-4" /> CSV
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sample templates */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* JSON template */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <FileJson className="w-4 h-4 text-blue-500" />
                    <span className="font-medium text-gray-900 dark:text-white text-sm">JSON Template</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowSampleJson(!showSampleJson); }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      {showSampleJson ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {showSampleJson ? 'Hide' : 'Show'} sample
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadSample('json'); }}
                      className="flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-1 rounded hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors"
                    >
                      <Download className="w-3 h-3" /> Download
                    </button>
                  </div>
                </div>
                {showSampleJson && (
                  <div className="p-4 max-h-80 overflow-y-auto">
                    <pre className="text-xs text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap">{SAMPLE_JSON}</pre>
                  </div>
                )}
                {!showSampleJson && (
                  <div className="px-4 py-3">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Full-featured format supporting phases with vitals, SAMPLE history, critical actions, and all scenario fields.
                    </p>
                  </div>
                )}
              </div>

              {/* CSV template */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-green-500" />
                    <span className="font-medium text-gray-900 dark:text-white text-sm">CSV Template</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowSampleCsv(!showSampleCsv); }}
                      className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
                    >
                      {showSampleCsv ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {showSampleCsv ? 'Hide' : 'Show'} sample
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadSample('csv'); }}
                      className="flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-1 rounded hover:bg-green-200 dark:hover:bg-green-800/40 transition-colors"
                    >
                      <Download className="w-3 h-3" /> Download
                    </button>
                  </div>
                </div>
                {showSampleCsv && (
                  <div className="p-4 max-h-80 overflow-y-auto">
                    <pre className="text-xs text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap">{SAMPLE_CSV_HEADERS + '\n' + SAMPLE_CSV_ROW}</pre>
                  </div>
                )}
                {!showSampleCsv && (
                  <div className="px-4 py-3">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Simplified flat format. One row per scenario. Use semicolons (;) within cells to separate list items like medications or critical actions.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Transform Legacy Scenarios Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-100 dark:border-gray-700">
              <button
                onClick={() => {
                  setTransformExpanded(!transformExpanded);
                  if (!transformExpanded && !transformPreview && !transformLoading) {
                    loadTransformPreview();
                  }
                }}
                className="w-full flex items-center justify-between px-4 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Wand2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Transform Legacy Scenarios</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Convert old-format scenarios to the new phase-based structure
                    </p>
                  </div>
                </div>
                {transformExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {transformExpanded && (
                <div className="px-4 pb-4 border-t dark:border-gray-700 space-y-4">
                  {/* Transform error */}
                  {transformError && (
                    <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span className="text-sm text-red-700 dark:text-red-300">{transformError}</span>
                    </div>
                  )}

                  {/* Loading */}
                  {transformLoading && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                      <span className="ml-2 text-gray-500 dark:text-gray-400">Scanning scenarios...</span>
                    </div>
                  )}

                  {/* Preview */}
                  {transformPreview && !transformLoading && (
                    <div className="mt-3 space-y-3">
                      {/* Summary stats */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3 text-center">
                          <div className="text-xl font-bold text-gray-900 dark:text-white">{transformPreview.total_checked}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
                          <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{transformPreview.needs_transformation}</div>
                          <div className="text-xs text-amber-600 dark:text-amber-400">Needs Transform</div>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                          <div className="text-xl font-bold text-green-600 dark:text-green-400">{transformPreview.already_correct}</div>
                          <div className="text-xs text-green-600 dark:text-green-400">Already Correct</div>
                        </div>
                      </div>

                      {/* Scenarios needing transform */}
                      {transformPreview.needs_transformation > 0 ? (
                        <>
                          <div className="max-h-48 overflow-y-auto border dark:border-gray-700 rounded-lg divide-y dark:divide-gray-700">
                            {transformPreview.scenarios
                              .filter(s => s.needs_transformation)
                              .map(s => (
                                <div key={s.id} className="px-3 py-2">
                                  <div className="text-sm font-medium text-gray-900 dark:text-white">{s.title}</div>
                                  <div className="mt-0.5 space-y-0.5">
                                    {s.reasons.map((r, i) => (
                                      <div key={i} className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                        {r}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              onClick={runTransform}
                              disabled={transformRunning}
                              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                            >
                              {transformRunning ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Transforming...
                                </>
                              ) : (
                                <>
                                  <Wand2 className="w-4 h-4" />
                                  Transform All ({transformPreview.needs_transformation})
                                </>
                              )}
                            </button>
                            <button
                              onClick={loadTransformPreview}
                              disabled={transformLoading}
                              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                            >
                              <RefreshCcw className="w-3.5 h-3.5" />
                              Refresh
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                          <span className="text-sm text-green-800 dark:text-green-300">All scenarios are already in the correct format.</span>
                        </div>
                      )}

                      {/* Transform results */}
                      {transformResults && (
                        <div className="border dark:border-gray-700 rounded-lg p-3 space-y-2">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <Wand2 className="w-4 h-4 text-purple-500" />
                            Transform Results
                          </h4>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-green-600 dark:text-green-400">{transformResults.transformed} transformed</span>
                            <span className="text-gray-500 dark:text-gray-400">{transformResults.already_correct} already correct</span>
                            {transformResults.errors > 0 && (
                              <span className="text-red-600 dark:text-red-400">{transformResults.errors} errors</span>
                            )}
                          </div>
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {transformResults.details
                              .filter(d => d.status === 'transformed' || d.status === 'error')
                              .map((d, i) => (
                                <div key={d.id || i} className="text-xs">
                                  <span className={`font-medium ${d.status === 'transformed' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {d.title}
                                  </span>
                                  {d.changes && d.changes.length > 0 && (
                                    <span className="text-gray-500 dark:text-gray-400 ml-1">
                                      - {d.changes.join('; ')}
                                    </span>
                                  )}
                                  {d.error && (
                                    <span className="text-red-500 dark:text-red-400 ml-1">- {d.error}</span>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 2: Preview */}
        {/* ============================================================== */}
        {step === 'preview' && preview && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{preview.total}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total scenarios</div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{preview.valid}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Valid</div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{preview.invalid}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Invalid</div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4 flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  {preview.format === 'json' ? <FileJson className="w-5 h-5 text-purple-600 dark:text-purple-400" /> : <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 uppercase">{preview.format}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Format</div>
                </div>
              </div>
            </div>

            {/* File info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <FileText className="w-4 h-4" />
                <span>{fileName}</span>
              </div>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Start Over
              </button>
            </div>

            {/* Scenario list */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 border-b dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">Parsed Scenarios</h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {preview.valid} of {preview.total} ready to import
                </span>
              </div>

              <div className="divide-y dark:divide-gray-700 max-h-[600px] overflow-y-auto">
                {preview.scenarios.map((scenario) => (
                  <div key={scenario.index}>
                    {/* Row header */}
                    <button
                      onClick={() => toggleRow(scenario.index)}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-left ${
                        !scenario.valid ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                      }`}
                    >
                      {/* Status icon */}
                      <div className="flex-shrink-0">
                        {scenario.valid ? (
                          scenario.warnings.length > 0 ? (
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                          ) : (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          )
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                      </div>

                      {/* Title & metadata */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {scenario.title}
                          </span>
                          <DifficultyBadge difficulty={scenario.difficulty} />
                          {scenario.category && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                              {scenario.category}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                          <span>{scenario.phaseCount} phase{scenario.phaseCount !== 1 ? 's' : ''}</span>
                          <span>{scenario.criticalActionCount} critical action{scenario.criticalActionCount !== 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      {/* Error/warning count */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {scenario.errors.length > 0 && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                            {scenario.errors.length} error{scenario.errors.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {scenario.warnings.length > 0 && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                            {scenario.warnings.length} warning{scenario.warnings.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {expandedRows.has(scenario.index) ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {/* Expanded details */}
                    {expandedRows.has(scenario.index) && (
                      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/40 border-t dark:border-gray-700">
                        {/* Errors */}
                        {scenario.errors.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">Errors:</p>
                            {scenario.errors.map((err, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                                <XCircle className="w-3 h-3 flex-shrink-0" />
                                {err}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Warnings */}
                        {scenario.warnings.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Warnings:</p>
                            {scenario.warnings.map((warn, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                {warn}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Parsed data summary */}
                        {scenario.parsed && (() => {
                          const p = scenario.parsed as Record<string, unknown>;
                          const chiefComplaint = p.chief_complaint as string | null;
                          const dispatchNotes = p.dispatch_notes as string | null;
                          const patientName = p.patient_name as string | null;
                          const patientAge = p.patient_age as string | null;
                          const patientSex = p.patient_sex as string | null;
                          const programs = p.applicable_programs as string[] | null;
                          const critActions = p.critical_actions as { description: string }[] | null;
                          return (
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                              {chiefComplaint && (
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">Chief Complaint: </span>
                                  <span className="text-gray-900 dark:text-white">{chiefComplaint}</span>
                                </div>
                              )}
                              {dispatchNotes && (
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">Dispatch: </span>
                                  <span className="text-gray-900 dark:text-white">{dispatchNotes}</span>
                                </div>
                              )}
                              {patientName && (
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">Patient: </span>
                                  <span className="text-gray-900 dark:text-white">
                                    {patientName}
                                    {patientAge ? `, ${patientAge}` : ''}
                                    {patientSex ? ` ${patientSex}` : ''}
                                  </span>
                                </div>
                              )}
                              {Array.isArray(programs) && programs.length > 0 && (
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">Programs: </span>
                                  <span className="text-gray-900 dark:text-white">{programs.join(', ')}</span>
                                </div>
                              )}
                              {Array.isArray(critActions) && critActions.length > 0 && (
                                <div className="col-span-2 mt-1">
                                  <span className="text-gray-500 dark:text-gray-400">Critical Actions: </span>
                                  <span className="text-gray-900 dark:text-white">
                                    {critActions.map(a => a.description).join(' | ')}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Upload Different File
              </button>

              <div className="flex items-center gap-4">
                {preview.invalid > 0 && (
                  <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <input
                      type="checkbox"
                      checked={importOnlyValid}
                      onChange={(e) => setImportOnlyValid(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Skip invalid scenarios
                  </label>
                )}
                <button
                  onClick={handleCommit}
                  disabled={committing || preview.valid === 0}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {committing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Import {importOnlyValid ? preview.valid : preview.total} Scenario{(importOnlyValid ? preview.valid : preview.total) !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STEP 3: Results */}
        {/* ============================================================== */}
        {step === 'results' && commitResult && (
          <div className="space-y-6">
            {/* Result summary */}
            <div className={`rounded-lg p-6 flex items-start gap-4 ${
              commitResult.success
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700'
                : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700'
            }`}>
              {commitResult.success ? (
                <CheckCircle className="w-8 h-8 text-green-500 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-amber-500 flex-shrink-0" />
              )}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{commitResult.message}</h2>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="text-green-700 dark:text-green-400">
                    {commitResult.importedCount} imported
                  </span>
                  {commitResult.failedCount > 0 && (
                    <span className="text-red-700 dark:text-red-400">
                      {commitResult.failedCount} failed
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Imported list */}
            {commitResult.imported.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="px-4 py-3 border-b dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Imported Successfully ({commitResult.imported.length})
                  </h3>
                </div>
                <div className="divide-y dark:divide-gray-700 max-h-80 overflow-y-auto">
                  {commitResult.imported.map((item) => (
                    <div key={item.id || item.index} className="px-4 py-2.5 flex items-center justify-between">
                      <span className="text-sm text-gray-900 dark:text-white">{item.title}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{item.id?.slice(0, 8)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Failed list */}
            {commitResult.failed && commitResult.failed.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="px-4 py-3 border-b dark:border-gray-700">
                  <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    Failed ({commitResult.failed.length})
                  </h3>
                </div>
                <div className="divide-y dark:divide-gray-700 max-h-60 overflow-y-auto">
                  {commitResult.failed.map((item) => (
                    <div key={item.index} className="px-4 py-2.5">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{item.title}</div>
                      <div className="text-xs text-red-600 dark:text-red-400 mt-0.5">{item.error}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Import More
              </button>
              <Link
                href="/lab-management/scenarios"
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
              >
                <FileText className="w-4 h-4" />
                View Scenario Library
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
