'use client';

import { useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  Upload,
  FileJson,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ClipboardPaste,
  ArrowLeft,
  Database,
  ChevronDown,
  ChevronRight,
  Flag,
  Eye,
  Users,
} from 'lucide-react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SkillDef {
  name: string;
  platinum_skill?: boolean;
  min_attempts?: number;
}

interface StationDef {
  station_type: string;
  station_name: string;
  skills?: SkillDef[];
  scenario_title?: string;
  difficulty?: string;
  format_notes?: string;
}

interface TemplateDef {
  week_number: number;
  day_number: number;
  title: string;
  category: string;
  instructor_count: number;
  is_anchor: boolean;
  anchor_type: string | null;
  requires_review: boolean;
  review_notes: string | null;
  stations: StationDef[];
}

interface ImportPayload {
  program: string;
  semester: number;
  templates: TemplateDef[];
}

interface ImportResult {
  success: boolean;
  summary: {
    program?: string;
    semester?: number;
    templates_created?: number;
    templates_updated?: number;
    stations_created?: number;
    total_templates?: number;
    total_stations?: number;
    errors?: string[];
    files?: Array<{
      file: string;
      templates: number;
      stations: number;
      errors: string[];
    }>;
  };
}

// ---------------------------------------------------------------------------
// Category badge colors
// ---------------------------------------------------------------------------
const categoryColors: Record<string, string> = {
  orientation: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  skills_lab: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  scenario_lab: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  assessment: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  capstone: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  certification: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  mixed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  other: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default function LabTemplateImportPage() {
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'upload' | 'paste'>('upload');
  const [jsonText, setJsonText] = useState('');
  const [parsed, setParsed] = useState<ImportPayload | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<ImportResult | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  // Parse JSON input
  const parseJson = useCallback((text: string) => {
    setJsonText(text);
    setParseError(null);
    setParsed(null);
    setResult(null);

    if (!text.trim()) return;

    try {
      const data = JSON.parse(text);

      // Validate structure
      if (!data.program || data.semester === undefined || !Array.isArray(data.templates)) {
        setParseError('JSON must have { program, semester, templates[] } structure');
        return;
      }

      setParsed(data);
    } catch (e) {
      setParseError(`Invalid JSON: ${e instanceof Error ? e.message : 'Parse error'}`);
    }
  }, []);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      parseJson(text);
    };
    reader.readAsText(file);
  };

  // Import parsed data
  const handleImport = async () => {
    if (!parsed) return;
    setImporting(true);
    setResult(null);

    try {
      const res = await fetch('/api/admin/lab-templates/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({
        success: false,
        summary: { errors: [err instanceof Error ? err.message : 'Import failed'] },
      });
    } finally {
      setImporting(false);
    }
  };

  // Seed from embedded files
  const handleSeed = async () => {
    setSeeding(true);
    setSeedResult(null);

    try {
      const res = await fetch('/api/admin/lab-templates/seed', {
        method: 'POST',
      });

      const data = await res.json();
      setSeedResult(data);
    } catch (err) {
      setSeedResult({
        success: false,
        summary: { errors: [err instanceof Error ? err.message : 'Seed failed'] },
      });
    } finally {
      setSeeding(false);
    }
  };

  // Toggle week expansion
  const toggleWeek = (key: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin h-8 w-8 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/lab-templates"
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Import Lab Templates
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Import lab day templates from JSON files or seed from embedded data
          </p>
        </div>
      </div>

      {/* Seed from embedded data */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start gap-4">
          <Database className="h-6 w-6 text-indigo-500 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Seed Paramedic Templates
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Import all Semester 1 &amp; 2 lab templates from the embedded JSON files.
              This will create or update templates and their stations.
            </p>
            <div className="mt-4 flex items-center gap-4">
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {seeding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Database className="h-4 w-4" />
                )}
                {seeding ? 'Seeding...' : 'Seed All Templates'}
              </button>
              {seedResult && (
                <div
                  className={`flex items-center gap-2 text-sm ${
                    seedResult.success
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {seedResult.success ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <span>
                    {seedResult.success
                      ? `${seedResult.summary.total_templates} templates, ${seedResult.summary.total_stations} stations`
                      : 'Seed failed'}
                  </span>
                </div>
              )}
            </div>
            {seedResult?.summary?.files && (
              <div className="mt-3 space-y-1">
                {seedResult.summary.files.map((f, i) => (
                  <div key={i} className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-mono">{f.file}</span>: {f.templates} templates,{' '}
                    {f.stations} stations
                    {f.errors.length > 0 && (
                      <span className="text-red-500 ml-2">({f.errors.length} errors)</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200 dark:border-gray-700" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-gray-50 dark:bg-gray-900 px-4 text-sm text-gray-500 dark:text-gray-400">
            or import manually
          </span>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('upload')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'upload'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <Upload className="h-4 w-4" />
          Upload File
        </button>
        <button
          onClick={() => setMode('paste')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'paste'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <ClipboardPaste className="h-4 w-4" />
          Paste JSON
        </button>
      </div>

      {/* Input area */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        {mode === 'upload' ? (
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
            >
              <FileJson className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600 dark:text-gray-300">
                Click to select a JSON file
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Expected format: {'{ program, semester, templates[] }'}
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-4">
            <textarea
              value={jsonText}
              onChange={(e) => parseJson(e.target.value)}
              placeholder='Paste JSON here: { "program": "paramedic", "semester": 1, "templates": [...] }'
              className="w-full h-64 px-4 py-3 font-mono text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
            />
          </div>
        )}

        {/* Parse error */}
        {parseError && (
          <div className="mt-4 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
            <XCircle className="h-4 w-4 flex-shrink-0" />
            <span>{parseError}</span>
          </div>
        )}
      </div>

      {/* Preview table */}
      {parsed && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Preview: {parsed.program} — Semester {parsed.semester}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {parsed.templates.length} templates,{' '}
                {parsed.templates.reduce((s, t) => s + (t.stations?.length || 0), 0)} stations
              </p>
            </div>
            <button
              onClick={handleImport}
              disabled={importing}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium transition-colors"
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {importing ? 'Importing...' : 'Import All'}
            </button>
          </div>

          {/* Template list */}
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {parsed.templates.map((tmpl, idx) => {
              const key = `${tmpl.week_number}-${tmpl.day_number}`;
              const isExpanded = expandedWeeks.has(key);

              return (
                <div key={idx}>
                  <button
                    onClick={() => toggleWeek(key)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-750 text-left transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )}
                    <span className="text-xs font-mono text-gray-400 w-16 flex-shrink-0">
                      W{tmpl.week_number}D{tmpl.day_number}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white flex-1 truncate">
                      {tmpl.title}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        categoryColors[tmpl.category] || categoryColors.other
                      }`}
                    >
                      {tmpl.category}
                    </span>
                    {tmpl.is_anchor && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 flex items-center gap-1">
                        <Flag className="h-3 w-3" />
                        {tmpl.anchor_type}
                      </span>
                    )}
                    {tmpl.requires_review && (
                      <Eye className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    )}
                    <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
                      <Users className="h-3 w-3" />
                      {tmpl.instructor_count}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {tmpl.stations?.length || 0} stations
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pl-14">
                      {tmpl.requires_review && tmpl.review_notes && (
                        <div className="mb-3 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                          <span>{tmpl.review_notes}</span>
                        </div>
                      )}
                      {tmpl.stations && tmpl.stations.length > 0 ? (
                        <div className="space-y-2">
                          {tmpl.stations.map((s, si) => (
                            <div
                              key={si}
                              className="flex items-start gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg"
                            >
                              <span
                                className={`text-xs px-2 py-0.5 rounded mt-0.5 ${
                                  s.station_type === 'scenario'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                                }`}
                              >
                                {s.station_type}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {s.station_name}
                                </div>
                                {s.scenario_title && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Scenario: {s.scenario_title}
                                    {s.difficulty && (
                                      <span className="ml-2 text-gray-400">
                                        ({s.difficulty})
                                      </span>
                                    )}
                                  </div>
                                )}
                                {s.skills && s.skills.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {s.skills.map((sk, ski) => (
                                      <span
                                        key={ski}
                                        className={`text-xs px-1.5 py-0.5 rounded ${
                                          sk.platinum_skill
                                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                            : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                        }`}
                                      >
                                        {sk.name}
                                        {sk.min_attempts && sk.min_attempts > 1
                                          ? ` (×${sk.min_attempts})`
                                          : ''}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {s.format_notes && (
                                  <div className="mt-1 text-xs text-gray-400 dark:text-gray-500 italic">
                                    {s.format_notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">
                          No stations — content pending
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Import result */}
      {result && (
        <div
          className={`p-4 rounded-lg border ${
            result.success
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            )}
            <span
              className={`font-medium ${
                result.success
                  ? 'text-green-800 dark:text-green-200'
                  : 'text-red-800 dark:text-red-200'
              }`}
            >
              {result.success ? 'Import successful!' : 'Import failed'}
            </span>
          </div>
          {result.summary && (
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 space-y-1">
              {result.summary.templates_created !== undefined && (
                <p>Templates created: {result.summary.templates_created}</p>
              )}
              {result.summary.templates_updated !== undefined &&
                result.summary.templates_updated > 0 && (
                  <p>Templates updated: {result.summary.templates_updated}</p>
                )}
              {result.summary.stations_created !== undefined && (
                <p>Stations created: {result.summary.stations_created}</p>
              )}
              {result.summary.errors && result.summary.errors.length > 0 && (
                <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                  <p className="font-medium">Errors:</p>
                  {result.summary.errors.map((e, i) => (
                    <p key={i}>• {e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
