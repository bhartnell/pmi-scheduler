'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Upload,
  FileJson,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ClipboardPaste,
  Loader2,
} from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';

// Mirrors the import endpoint's accepted shapes.
// See app/api/admin/skill-drills/import/route.ts.

interface DrillPreview {
  title: string;
  program: string;
  semester: number | null;
  has_concept: boolean;
  setup_count: number;
  step_count: number;
  equipment_count: number;
}

interface ImportResultRow {
  index: number;
  title: string;
  id?: string;
  action?: 'inserted' | 'updated';
  error?: string;
}

interface ImportResponse {
  success: boolean;
  message?: string;
  total?: number;
  insertedCount?: number;
  updatedCount?: number;
  failedCount?: number;
  results?: ImportResultRow[];
  error?: string;
}

export default function SkillDrillImportPage() {
  const [mode, setMode] = useState<'upload' | 'paste'>('upload');
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<DrillPreview[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function parseInput(raw: string) {
    setText(raw);
    setResult(null);
    setParsed(null);
    setParseError(null);
    if (!raw.trim()) return;

    try {
      const data = JSON.parse(raw);
      // Accept single object, array, or { drills: [...] }
      let arr: unknown[];
      if (Array.isArray(data)) arr = data;
      else if (data && typeof data === 'object' && Array.isArray((data as { drills?: unknown }).drills)) {
        arr = (data as { drills: unknown[] }).drills;
      } else if (data && typeof data === 'object') {
        arr = [data];
      } else {
        setParseError('Expected a drill object, an array, or { drills: [...] }.');
        return;
      }

      const previews: DrillPreview[] = arr.map((d) => {
        const x = d as Record<string, unknown>;
        return {
          title: String(x.title ?? x.name ?? '(no title)'),
          program: String(x.program ?? ''),
          semester: typeof x.semester === 'number' ? x.semester : null,
          has_concept: typeof x.concept === 'string' && x.concept.trim().length > 0,
          setup_count: Array.isArray(x.setups) ? x.setups.length : 0,
          step_count: Array.isArray(x.run_steps) ? x.run_steps.length : 0,
          equipment_count: Array.isArray(x.equipment) ? x.equipment.length : 0,
        };
      });
      setParsed(previews);
    } catch (e) {
      setParseError(`Invalid JSON: ${e instanceof Error ? e.message : 'parse error'}`);
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => parseInput(ev.target?.result as string);
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!parsed || parsed.length === 0) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/skill-drills/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text,
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : 'Import failed' });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <Breadcrumbs />
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import Skill Drills</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Upload a JSON file or paste JSON to create/update skill drills. Upserts on
            <code className="ml-1 px-1 bg-gray-100 dark:bg-gray-800 rounded">title + program + semester</code>.
            See <a href="/docs/Skill_Drill_Webapp_Brief.md" className="text-blue-600 dark:text-blue-400 hover:underline">the brief</a> for the schema.
          </p>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg ${mode === 'upload'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
          >
            <Upload className="w-4 h-4 inline mr-1" /> Upload file
          </button>
          <button
            type="button"
            onClick={() => setMode('paste')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg ${mode === 'paste'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
          >
            <ClipboardPaste className="w-4 h-4 inline mr-1" /> Paste JSON
          </button>
        </div>

        {mode === 'upload' ? (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFile}
              className="block w-full text-sm text-gray-600 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100"
            />
          </div>
        ) : (
          <textarea
            value={text}
            onChange={(e) => parseInput(e.target.value)}
            rows={14}
            placeholder='{ "title": "...", "program": "paramedic", "semester": 2, "concept": "...", "run_steps": [ ... ] }'
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        )}

        {parseError && (
          <div className="mt-3 p-3 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
            <XCircle className="w-4 h-4" /> {parseError}
          </div>
        )}
      </div>

      {/* Preview */}
      {parsed && parsed.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Preview: {parsed.length} drill{parsed.length === 1 ? '' : 's'}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Upsert by title + program + semester.</p>
            </div>
            <button
              onClick={handleImport}
              disabled={importing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? 'Importing…' : 'Import'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Title</th>
                  <th className="text-left px-4 py-2 font-medium">Program</th>
                  <th className="text-left px-4 py-2 font-medium">Sem</th>
                  <th className="text-left px-4 py-2 font-medium">Concept</th>
                  <th className="text-left px-4 py-2 font-medium">Steps</th>
                  <th className="text-left px-4 py-2 font-medium">Setups</th>
                  <th className="text-left px-4 py-2 font-medium">Equipment</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((d, i) => (
                  <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{d.title}</td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{d.program}</td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{d.semester ?? '—'}</td>
                    <td className="px-4 py-2">
                      {d.has_concept ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                    </td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{d.step_count}</td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{d.setup_count}</td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{d.equipment_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`rounded-lg border p-4 ${result.success
          ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
          : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'}`}
        >
          <div className="flex items-start gap-2">
            {result.success
              ? <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              : <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
            }
            <div className="flex-1">
              <div className="font-semibold text-gray-900 dark:text-white">{result.message ?? (result.success ? 'Import complete' : 'Import failed')}</div>
              {result.error && <div className="text-sm text-red-700 dark:text-red-300 mt-1">{result.error}</div>}
              {result.results && result.results.length > 0 && (
                <ul className="mt-2 text-sm space-y-0.5">
                  {result.results.map((r) => (
                    <li key={r.index} className="text-gray-700 dark:text-gray-300">
                      <span className="font-medium">{r.title}</span>{' '}
                      {r.error
                        ? <span className="text-red-600 dark:text-red-400">— error: {r.error}</span>
                        : <span className="text-green-700 dark:text-green-400">— {r.action}</span>}
                      {r.id && (
                        <Link href={`/labs/skill-drills/${r.id}`} className="ml-2 text-blue-600 dark:text-blue-400 hover:underline text-xs">
                          view →
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
