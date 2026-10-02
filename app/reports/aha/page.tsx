'use client';

/**
 * AHA Results Export — picker. Choose cohort, form, and signing instructor, then
 * open the autofilled, print-to-PDF form set (per-cohort). Megacode autofills
 * from scored attempts; skills sheets (Airway, Adult BLS) auto-complete as PASS.
 * Output opens in a new tab with a Print / Save-as-PDF button.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, ExternalLink, Loader2, Info, Download, FileArchive } from 'lucide-react';
import { useToast } from '@/components/Toast';

interface CohortOpt { id: string; label: string }
interface InstructorOpt { id: string; name: string; ahaNumber: string | null }

const TEMPLATES = [
  { id: 'megacode', label: 'Megacode Testing Checklist', note: 'Autofills from each student’s best scored megacode attempt → matching AHA variant.' },
  { id: 'airway', label: 'Airway Management Skills', note: 'Auto-completed as PASS (verified live; not scored in-app).' },
  { id: 'adult_bls', label: 'Adult High-Quality BLS Skills', note: 'Auto-completed as PASS (verified live; not scored in-app).' },
  { id: 'infant_cpr', label: 'Infant CPR Skills', note: 'Auto-completed as PASS (verified live; not scored in-app).' },
];

export default function AhaExportPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [cohorts, setCohorts] = useState<CohortOpt[]>([]);
  const [instructors, setInstructors] = useState<InstructorOpt[]>([]);
  const [cohortId, setCohortId] = useState('');
  const [template, setTemplate] = useState('megacode');
  const [instructorId, setInstructorId] = useState('');
  const [grouping, setGrouping] = useState<'student' | 'section'>('student');

  useEffect(() => {
    fetch('/api/reports/aha/options')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) { setCohorts(d.cohorts || []); setInstructors(d.instructors || []); }
        else toast.error(d.error || 'Failed to load options');
      })
      .catch(() => toast.error('Failed to load options'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  interface FlaggedAttempt { id: string; date: string | null; team_lead: string | null; scenario: string | null; overall_result: string; flags: string[]; segments_unmarked: number }
  const [flagged, setFlagged] = useState<FlaggedAttempt[] | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Resolve-at-export: list incomplete/contradictory megacode records first and
  // offer proceed-anyway. Never blocks: a failed check just proceeds.
  async function withRecordCheck(action: () => void) {
    if (!cohortId) return toast.error('Pick a cohort');
    try {
      const d = await (await fetch(`/api/adv-cert/record-flags?cohortId=${cohortId}`)).json();
      if (d.success && d.flagged?.length) { setFlagged(d.flagged); setPendingAction(() => action); return; }
    } catch { /* proceed */ }
    action();
  }

  function open(print: boolean) {
    if (!cohortId) return toast.error('Pick a cohort');
    const p = new URLSearchParams({ template, cohortId });
    if (instructorId) p.set('instructorId', instructorId);
    if (print) p.set('print', '1');
    const url = `/api/reports/aha?${p.toString()}`;
    const w = window.open(url, '_blank');
    if (!w) window.location.href = url;
  }

  function downloadZip() {
    if (!cohortId) return toast.error('Pick a cohort');
    const p = new URLSearchParams({ cohortId, grouping });
    if (instructorId) p.set('instructorId', instructorId);
    toast.success('Building ZIP… this can take ~30–60s for a full cohort.');
    window.location.href = `/api/reports/aha/zip?${p.toString()}`;
  }

  const activeTpl = TEMPLATES.find((t) => t.id === template);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <Link href="/reports" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Reports
      </Link>
      <div className="flex items-center gap-3 mb-1">
        <div className="p-2 bg-red-600 rounded-lg text-white"><FileText className="w-6 h-6" /></div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AHA Results Export</h1>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Generate the completed AHA form set for a cohort — autofilled, document-formatted, downloadable as PDF.
        Print &amp; sign (or use a saved signature) is a post-step; move the PDF to the shared drive manually.
      </p>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Cohort</label>
            <select value={cohortId} onChange={(e) => setCohortId(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm">
              <option value="">Select a cohort…</option>
              {cohorts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Form</label>
            <select value={template} onChange={(e) => setTemplate(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm">
              {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Signing instructor (optional)</label>
            <select value={instructorId} onChange={(e) => setInstructorId(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm">
              <option value="">— blank (wet-sign) —</option>
              {instructors.map((i) => <option key={i.id} value={i.id}>{i.name}{i.ahaNumber ? ` (#${i.ahaNumber})` : ''}</option>)}
            </select>
          </div>
        </div>

        {activeTpl && (
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {activeTpl.note}
          </p>
        )}
        {instructors.length === 0 && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            No instructors have AHA credentials on file yet — set them under <Link href="/settings/aha-credentials" className="underline">AHA Credentials</Link> to fill the sign-off line.
          </p>
        )}

        <p className="mt-4 text-xs font-medium text-gray-500 dark:text-gray-400">View / print one form (single document):</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => (template === 'megacode' ? withRecordCheck(() => open(true)) : open(true))} disabled={!cohortId}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-md text-sm font-medium">
            <ExternalLink className="w-4 h-4" /> Open &amp; Print
          </button>
          <button type="button" onClick={() => (template === 'megacode' ? withRecordCheck(() => open(false)) : open(false))} disabled={!cohortId}
            className="inline-flex items-center gap-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 px-5 py-2.5 rounded-md text-sm font-medium">
            <FileText className="w-4 h-4" /> Open (no auto-print)
          </button>
        </div>
      </div>

      {/* ZIP of pre-separated PDFs — the student-files workflow */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 mt-4">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
          <FileArchive className="w-5 h-5 text-green-600" /> Download all 4 forms as a ZIP
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Pre-separated PDFs — unzip and drag each into the student’s folder. No Adobe extraction. Uses the cohort + signing instructor selected above.
        </p>
        <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Grouping</label>
            <select value={grouping} onChange={(e) => setGrouping(e.target.value as 'student' | 'section')}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm">
              <option value="student">By student — one combined PDF per student (recommended)</option>
              <option value="section">By section — one PDF per form type (AHA records)</option>
            </select>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          {grouping === 'student'
            ? 'Files: LastName_FirstName_ACLS_Results.pdf (megacode + airway + adult BLS + infant CPR combined). Excused/no-attempt students are omitted.'
            : 'Files: one PDF per form type (all students).'}
        </p>
        <div className="mt-4">
          <button type="button" onClick={() => withRecordCheck(downloadZip)} disabled={!cohortId}
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-md text-sm font-medium">
            <Download className="w-4 h-4" /> Download ZIP
          </button>
          <span className="ml-3 text-xs text-gray-400">~30–60s for a full cohort (PDFs render server-side).</span>
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p><strong>Megacode:</strong> each student’s best scored attempt fills the form by rhythm section (Brady/VF/pVT/PEA/Asystole/Tachy/PCAC share the same criteria, so practice scenarios are valid testing cases per AHA). Named AHA variants show the scenario number; others are labeled by their rhythm chain. Students with no attempt (e.g. excused) are omitted.</p>
        <p><strong>Per-form instructor:</strong> pick the signing instructor per form export (re-select and re-open for a different signer) — keeps a recerting instructor’s signature off their own form.</p>
      </div>

      {flagged && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-5 max-h-[80vh] overflow-y-auto">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {flagged.length} megacode record{flagged.length === 1 ? '' : 's'} need attention
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Incomplete = result set but sections unmarked. Contradictory = overall pass with a failed section.
              Resolve them on the ACLS hub, or export anyway.
            </p>
            <ul className="mt-3 divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              {flagged.map((f) => (
                <li key={f.id} className="py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium text-gray-900 dark:text-white">{f.team_lead || 'Unknown lead'}</span>
                  <span className="text-gray-500">{f.scenario || ''} {f.date || ''}</span>
                  {f.flags.includes('incomplete') && <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800">Incomplete ({f.segments_unmarked} unmarked)</span>}
                  {f.flags.includes('contradictory') && <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-800">Contradictory</span>}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2 justify-end">
              <Link href="/labs/acls-hub" className="px-4 py-2 min-h-[44px] inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 text-sm">Resolve on ACLS hub</Link>
              <button type="button" onClick={() => { const a = pendingAction; setFlagged(null); setPendingAction(null); a?.(); }}
                className="px-4 py-2 min-h-[44px] rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">Export anyway</button>
              <button type="button" onClick={() => { setFlagged(null); setPendingAction(null); }}
                className="px-4 py-2 min-h-[44px] rounded-md border border-gray-300 dark:border-gray-600 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
