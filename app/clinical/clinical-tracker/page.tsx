'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight,
  Briefcase,
  FileCheck,
  Printer,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import { openPrintWindow, printHeader, printFooter, escapeHtml } from '@/lib/print-utils';

// ── Types ────────────────────────────────────────────────────────────────────

type ThreeState = 'ordered' | 'in_progress' | 'complete' | null;
type FluStatus = 'received' | 'declined' | null;

interface Cohort {
  id: string;
  cohort_number: number;
  name: string;
  student_count?: number;
  program?: { id: string; name: string; abbreviation: string } | null;
}

// Full program label used across ~15 other cohort selectors in the app
// (e.g. app/api/clinical/site-visits/route.ts, request-coverage,
// lab-day-roles): "<ABBREVIATION> G<cohort_number>" (e.g. "PM G14",
// "AEMT G2"). Falls back to the bare name/number if the embedded program
// row is missing on some row so a data gap here never crashes the page.
function cohortLabel(c: Cohort): string {
  const abbr = c.program?.abbreviation;
  if (abbr) return `${abbr} G${c.cohort_number}`;
  return c.name || `Cohort ${c.cohort_number}`;
}

interface ComplioRow {
  student_id: string;
  first_name: string;
  last_name: string;
  complio_complete: boolean;
  mce_complete: boolean;
  mmr_complete: boolean;
  vzv_complete: boolean;
  hep_b_complete: boolean;
  hep_b_declination: boolean;
  tdap_complete: boolean;
  covid_complete: boolean;
  covid_exemption: boolean;
  tb_test_1_complete: boolean;
  tb_test_2_complete: boolean;
  tb_questionnaire: boolean;
  physical_complete: boolean;
  health_insurance_complete: boolean;
  bls_complete: boolean;
  flu_shot_complete: boolean;
  flu_shot_status: FluStatus;
  flu_declination: boolean;
  hospital_orientation_complete: boolean;
  exhibit_complete: boolean;
  background_check_status: ThreeState;
  drug_test_status: ThreeState;
  attestation_complete: boolean;
  docs_shared_with_sites: boolean;
  chh_receipt_complete: boolean;
  chh_approval_complete: boolean;
  complio_notes: string;
}

interface MceRow {
  student_id: string;
  first_name: string;
  last_name: string;
  bg_check_status: ThreeState;
  drug_test_status: ThreeState;
  physical: boolean;
  insurance: boolean;
  photo: boolean;
  tb: boolean;
  mmr: boolean;
  flu: boolean;
  hep_b: boolean;
  tdap: boolean;
  vzv: boolean;
  covid: boolean;
  bls: boolean;
  confidentiality: boolean;
  flu_declination: boolean;
  hep_b_declination: boolean;
  mmr_declination: boolean;
  tdap_declination: boolean;
  vzv_declination: boolean;
  nsp: boolean;
  cultural_competency: boolean;
  parking: boolean;
  eta_module: boolean;
  attestation_lgs: boolean;
  wpvp: boolean;
  orientation: boolean;
  conduct: boolean;
  // New (Rae 2026-08-11, §3.a.ii)
  cs_attestation: boolean;
  cs_orientation: boolean;
  wpvp_curriculum: boolean;
  orientation_exam: boolean;
  mce_notes: string;
}

// ── mCE column layout (Rae 2026-08-11, brief §3.a.ii) ─────────────────────────
// Data-driven so the grid, the completion-overview aggregate, and the student
// print stay in lockstep. Sections render with header bands + thick separators;
// left-to-right order matches Rae's list exactly. `nsp` is intentionally absent
// (older layout — column kept in DB, just not shown). `full` = the full item
// name used on the student print-out.
type MceColKind = 'check' | 'threestate';
interface MceCol {
  key: keyof MceRow;
  short: string;
  full: string;
  kind: MceColKind;
}
interface MceSection {
  name: string;
  cols: MceCol[];
}
const MCE_SECTIONS: MceSection[] = [
  {
    name: 'Compliance',
    cols: [
      { key: 'bg_check_status', short: 'BG', full: 'Background check', kind: 'threestate' },
      { key: 'drug_test_status', short: 'DT', full: 'Drug test', kind: 'threestate' },
      { key: 'physical', short: 'Phys', full: 'Physical exam', kind: 'check' },
      { key: 'insurance', short: 'Ins', full: 'Liability insurance', kind: 'check' },
      { key: 'photo', short: 'Photo', full: 'Student photograph', kind: 'check' },
      { key: 'tb', short: 'TB', full: 'TB clearance', kind: 'check' },
      { key: 'mmr', short: 'MMR', full: 'MMR', kind: 'check' },
      { key: 'flu', short: 'Flu', full: 'Influenza vaccine', kind: 'check' },
      { key: 'hep_b', short: 'Hep B', full: 'Hepatitis B', kind: 'check' },
      { key: 'tdap', short: 'Tdap', full: 'Tdap', kind: 'check' },
      { key: 'vzv', short: 'VZV', full: 'Varicella', kind: 'check' },
      { key: 'covid', short: 'COVID', full: 'COVID-19 vaccine', kind: 'check' },
      { key: 'bls', short: 'BLS', full: 'AHA BLS Provider', kind: 'check' },
    ],
  },
  {
    name: 'Documents',
    cols: [
      { key: 'cs_attestation', short: 'CS Att', full: 'CommonSpirit Attestation of Student Orientation', kind: 'check' },
      { key: 'confidentiality', short: 'Confid', full: 'Confidentiality Statement', kind: 'check' },
      { key: 'flu_declination', short: 'Flu Dec', full: 'Flu declination', kind: 'check' },
      { key: 'hep_b_declination', short: 'Hep B Dec', full: 'Hep B declination', kind: 'check' },
      { key: 'mmr_declination', short: 'MMR Dec', full: 'MMR declination', kind: 'check' },
      { key: 'tdap_declination', short: 'Tdap Dec', full: 'Tdap declination', kind: 'check' },
      { key: 'vzv_declination', short: 'VZV Dec', full: 'Varicella declination', kind: 'check' },
      { key: 'cultural_competency', short: 'Cult', full: 'NV cultural competency certificate', kind: 'check' },
      { key: 'parking', short: 'Parking', full: 'Siena parking', kind: 'check' },
      { key: 'eta_module', short: 'ETA 4/5', full: 'Educational Training Agreement parts IV/V', kind: 'check' },
      { key: 'attestation_lgs', short: 'Att LGS', full: 'Attestation and Letter of Good Standing (LGS)', kind: 'check' },
      { key: 'wpvp', short: 'WPVP Att', full: 'WPVP training attestation', kind: 'check' },
    ],
  },
  {
    name: 'Modules',
    cols: [
      { key: 'cs_orientation', short: 'CS Ori', full: 'CS clinical student orientation', kind: 'check' },
      { key: 'orientation', short: 'DH Ori', full: 'Dignity Health (DH) orientation', kind: 'check' },
      { key: 'conduct', short: 'Conduct', full: 'Standards of conduct', kind: 'check' },
      { key: 'wpvp_curriculum', short: 'WPVP Tr', full: 'Workplace Violence Prevention training curriculum', kind: 'check' },
    ],
  },
  {
    name: 'Exam',
    cols: [
      { key: 'orientation_exam', short: 'Exam', full: 'Orientation exam', kind: 'check' },
    ],
  },
];
const MCE_COLS: MceCol[] = MCE_SECTIONS.flatMap(s => s.cols);

// ── Helper components ─────────────────────────────────────────────────────────

const THREE_STATE_LABELS: Record<string, string> = {
  ordered: 'Ordered',
  in_progress: 'In Progress',
  complete: 'Complete',
};

const THREE_STATE_COLORS: Record<string, string> = {
  ordered: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  complete: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
};

// Compact single-letter indicators for the grid cells (Rae, 8/11): the full
// "In Progress"/"Ordered"/"Complete" labels made BG/DT the widest columns and
// forced horizontal scroll. Same color coding as above; the dropdown still
// shows the full labels and a hover tooltip names the state.
const THREE_STATE_LETTERS: Record<string, string> = {
  ordered: 'O',
  in_progress: 'IP',
  complete: 'C',
};

function ThreeStateCell({
  value,
  onChange,
  saving,
}: {
  value: ThreeState;
  onChange: (v: ThreeState) => void;
  saving?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const options: Array<ThreeState> = [null, 'ordered', 'in_progress', 'complete'];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        title={value ? THREE_STATE_LABELS[value] : 'Not set'}
        className={`w-9 h-7 rounded text-xs font-bold text-center border transition-opacity ${
          value ? THREE_STATE_COLORS[value] : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 border-transparent'
        } ${saving ? 'opacity-50' : 'hover:opacity-80'}`}
      >
        {value ? THREE_STATE_LETTERS[value] : '—'}
      </button>
      {open && (
        <div className="absolute z-50 left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg min-w-[120px]">
          {options.map(opt => (
            <button
              key={opt ?? '__none__'}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`block w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg ${
                opt ? THREE_STATE_COLORS[opt] : 'text-gray-500 dark:text-gray-400'
              } ${value === opt ? 'ring-1 ring-inset ring-gray-400' : ''}`}
            >
              {opt ? THREE_STATE_LABELS[opt] : '— Clear —'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CheckCell({
  value,
  onChange,
  saving,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  saving?: boolean;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      disabled={saving}
      className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
        value
          ? 'bg-green-500 border-green-500 text-white'
          : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500'
      } ${saving ? 'opacity-50' : 'hover:opacity-80'}`}
      title={value ? 'Mark incomplete' : 'Mark complete'}
    >
      {value && (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
}

// Flu shot R/D cell (Rae 8/11, item 2.d): single-letter status — R = received
// (green), D = declined (amber). Clicking cycles — → R → D → —. The separate
// "Flu Dec" column (the VHS declination FORM) is required regardless and stays
// its own checkbox.
function FluStatusCell({
  value,
  onChange,
  saving,
}: {
  value: FluStatus;
  onChange: (v: FluStatus) => void;
  saving?: boolean;
}) {
  const next: FluStatus = value === null ? 'received' : value === 'received' ? 'declined' : null;
  const letter = value === 'received' ? 'R' : value === 'declined' ? 'D' : '—';
  const colors =
    value === 'received'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
      : value === 'declined'
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
      : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
  return (
    <button
      onClick={() => onChange(next)}
      disabled={saving}
      title={value === 'received' ? 'Received (click → Declined)' : value === 'declined' ? 'Declined (click → clear)' : 'Not set (click → Received)'}
      className={`w-7 h-7 rounded text-xs font-bold text-center border border-transparent transition-opacity ${colors} ${saving ? 'opacity-50' : 'hover:opacity-80'}`}
    >
      {letter}
    </button>
  );
}

// Display-only "N/A" indicator used when a column is greyed out by another
// field (COVID exemption, TB PPD ↔ QuantiFERON mutual exclusion). It is
// intentionally NON-interactive and does NOT touch the stored value — the
// underlying check is preserved; to "un-grey", clear the controlling field
// (e.g. uncheck QuantiFERON) and the real checkbox returns (Rae, 8/11).
function NaCell({ title }: { title?: string }) {
  return (
    <span
      title={title || 'Not applicable'}
      className="inline-flex items-center justify-center w-6 h-6 rounded text-[9px] font-semibold text-gray-400 bg-gray-100 dark:bg-gray-700/50 dark:text-gray-500 select-none"
    >
      N/A
    </span>
  );
}

function NotesCell({ value, onChange, saving }: { value: string; onChange: (v: string) => void; saving?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  if (editing) {
    return (
      <textarea
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { onChange(draft); setEditing(false); }}
        onKeyDown={e => { if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
        className="w-40 min-h-[60px] text-xs p-1.5 border border-blue-400 rounded resize-y bg-white dark:bg-gray-700 dark:text-white"
        disabled={saving}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`max-w-[140px] text-xs text-left truncate p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
        value ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500 italic'
      }`}
    >
      {value || 'add note…'}
    </button>
  );
}

// ── Aggregation bar ───────────────────────────────────────────────────────────

function AggBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 dark:text-gray-400 w-28 text-right shrink-0">{label}</span>
      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 min-w-[80px]">
        <div
          className={`h-2 rounded-full transition-all ${
            pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-yellow-400'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-16 shrink-0">
        {count}/{total} ({pct}%)
      </span>
    </div>
  );
}

// ── Print view ────────────────────────────────────────────────────────────────
//
// BUG FIX (2026-08-14, Rae — blank student print-out): this used to print via
// `window.print()` on the current page with the preview modal's content
// scoped visible through #print-content. app/globals.css's global print
// stylesheet also has `.fixed { display: none !important }` (added 2026-07-12
// to hide fixed headers/sidebars on other pages) — the modal's own wrapper is
// `className="fixed ..."`, so that rule hid the ENTIRE modal, #print-content
// included, the instant printing started. The per-student isolation rule
// added for the modal never got a chance to apply because its ancestor was
// already `display: none`. Net result: nothing printed but blank pages.
// Fixed by generating the print HTML as a plain string and printing it in an
// isolated new window via lib/print-utils.ts's openPrintWindow — the same
// pattern already used by every other print flow in the app — which can't be
// touched by the main page's print CSS at all.

function printFieldRowHtml(label: string, value: boolean | ThreeState | string): string {
  let text = '—';
  let color = '#9ca3af';
  if (typeof value === 'boolean') {
    text = value ? '✓' : '✗';
    color = value ? '#16a34a' : '#f87171';
  } else if (value === 'complete') { text = 'Complete'; color = '#16a34a'; }
  else if (value === 'in_progress') { text = 'In Progress'; color = '#2563eb'; }
  else if (value === 'ordered') { text = 'Ordered'; color = '#ca8a04'; }
  else if (typeof value === 'string' && value) { text = value; color = '#374151'; }

  return `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f3f4f6;font-size:12px;">
    <span style="color:#374151;">${escapeHtml(label)}</span>
    <span style="font-weight:600;color:${color};">${escapeHtml(text)}</span>
  </div>`;
}

function notesBlockHtml(notes: string): string {
  if (!notes) return '';
  return `<div style="margin-top:12px;padding:8px;background:#f9fafb;border-radius:4px;">
    <p style="font-size:11px;font-weight:600;color:#6b7280;margin-bottom:4px;">Notes</p>
    <p style="font-size:13px;color:#1f2937;">${escapeHtml(notes)}</p>
  </div>`;
}

// TB clearance is one requirement with two accepted paths: two PPDs, or a single
// QuantiFERON. The print-out keys off the path the student actually cleared on so
// the unused path reads "N/A" instead of a misleading ✗ (Rae, 2026-08-14).
// Unlike the editable grid, print does NOT suppress this when all three are on
// file — the grid's `tbConflict` escape hatch exists only so staff can still click
// a greyed-out checkbox to clear the extra entry, which a read-only print can't need.
function tbPrintValues(s: ComplioRow): { ppd1: boolean | string; ppd2: boolean | string; quantiferon: boolean | string } {
  const qPath = s.tb_questionnaire === true;
  const bothPpd = s.tb_test_1_complete === true && s.tb_test_2_complete === true;
  return {
    ppd1: qPath ? 'N/A' : s.tb_test_1_complete,
    ppd2: qPath ? 'N/A' : s.tb_test_2_complete,
    quantiferon: !qPath && bothPpd ? 'N/A' : s.tb_questionnaire,
  };
}

// Mirrors ComplioStudentPrintView's field list/order exactly (full item
// names, package-subscription rows omitted — Rae 1.c.iii/1.c.iv).
function complioPrintHtml(s: ComplioRow): string {
  const tb = tbPrintValues(s);
  const rows: Array<[string, boolean | ThreeState | string]> = [
    ['MMR', s.mmr_complete],
    ['Varicella', s.vzv_complete],
    ['Hepatitis B', s.hep_b_complete],
    ['Tdap', s.tdap_complete],
    ['COVID-19', s.covid_complete],
    ['COVID-19 Exemption', s.covid_exemption],
    ['TB PPD 1', tb.ppd1],
    ['TB PPD 2', tb.ppd2],
    ['QuantiFERON', tb.quantiferon],
    ['Physical exam', s.physical_complete],
    ['Health insurance', s.health_insurance_complete],
    ['AHA BLS Provider card', s.bls_complete],
    ['Flu shot', s.flu_shot_status === 'received' ? 'Received' : s.flu_shot_status === 'declined' ? 'Declined' : ''],
    ['VHS Influenza Declination form', s.flu_declination],
    ['VHS Hospital Orientation form', s.hospital_orientation_complete],
    ['Student Declaration of Responsibilities & Confidentiality (Exhibits A&B)', s.exhibit_complete],
    ['Background check', s.background_check_status],
    ['Drug test', s.drug_test_status],
  ];
  return rows.map(([label, value]) => printFieldRowHtml(label, value)).join('') + notesBlockHtml(s.complio_notes);
}

// Mirrors MceStudentPrintView — data-driven from MCE_SECTIONS so print
// names/order stay in lockstep with the grid (Rae 8/11, §3.a.ii).
function mcePrintHtml(s: MceRow): string {
  const sectionsHtml = MCE_SECTIONS.map(section => {
    const rowsHtml = section.cols.map(col => printFieldRowHtml(col.full, s[col.key] as boolean | ThreeState | string)).join('');
    return `<p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin:10px 0 4px;">${escapeHtml(section.name)}</p>${rowsHtml}`;
  }).join('');
  return sectionsHtml + notesBlockHtml(s.mce_notes);
}

function buildClinicalPrintHtml(opts: {
  studentName: string;
  complio: ComplioRow | null;
  mce: MceRow | null;
}): string {
  const sections: string[] = [];
  if (opts.complio) {
    sections.push(`<div class="section"><h2>Complio Clearance Checklist</h2>${complioPrintHtml(opts.complio)}</div>`);
  }
  if (opts.mce) {
    sections.push(`<div class="section"${sections.length ? ' style="page-break-before: always;"' : ''}><h2>mCE Clearance Checklist</h2>${mcePrintHtml(opts.mce)}</div>`);
  }
  return printHeader('Clinical Clearance Checklist', opts.studentName) + sections.join('') + printFooter();
}

function PrintModal({
  complio,
  mce,
  defaultTab,
  onClose,
}: {
  complio: ComplioRow | null;
  mce: MceRow | null;
  defaultTab: 'complio' | 'mce';
  onClose: () => void;
}) {
  // Which checklist(s) to print. Default to the tab the print button was
  // clicked from; Rae can add the other if a matching row exists (brief 1.c.i).
  const [includeComplio, setIncludeComplio] = useState(defaultTab === 'complio' && !!complio);
  const [includeMce, setIncludeMce] = useState(defaultTab === 'mce' && !!mce);

  const anyRow = complio || mce;
  if (!anyRow) return null;
  const name = `${anyRow.last_name}, ${anyRow.first_name}`;
  const nothingSelected = !((includeComplio && complio) || (includeMce && mce));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto print:bg-white print:p-0">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full mt-8 print:shadow-none print:mt-0">
        <div className="flex items-center justify-between p-4 border-b print:hidden">
          <h2 className="font-semibold text-gray-900 dark:text-white">Print Preview — {name}</h2>
          <div className="flex items-center gap-3">
            {/* One-or-both checklist selection */}
            <div className="flex items-center gap-3 text-sm">
              <label className={`flex items-center gap-1.5 ${complio ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}>
                <input
                  type="checkbox"
                  checked={includeComplio && !!complio}
                  disabled={!complio}
                  onChange={e => setIncludeComplio(e.target.checked)}
                  className="accent-teal-600"
                />
                Complio
              </label>
              <label className={`flex items-center gap-1.5 ${mce ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}>
                <input
                  type="checkbox"
                  checked={includeMce && !!mce}
                  disabled={!mce}
                  onChange={e => setIncludeMce(e.target.checked)}
                  className="accent-teal-600"
                />
                mCE
              </label>
            </div>
            <button
              onClick={() => {
                const html = buildClinicalPrintHtml({
                  studentName: name,
                  complio: includeComplio ? complio : null,
                  mce: includeMce ? mce : null,
                });
                openPrintWindow('Clinical Clearance Checklist', html);
              }}
              disabled={nothingSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-6 text-sm" id="print-content">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold">{name}</h3>
              <p className="text-gray-500 text-xs">Clinical Clearance Checklist</p>
            </div>
            <div className="text-xs text-gray-400">{new Date().toLocaleDateString()}</div>
          </div>

          {nothingSelected && (
            <p className="text-gray-400 italic print:hidden">Select at least one checklist to print.</p>
          )}

          {includeComplio && complio && (
            <section>
              <h4 className="font-semibold text-gray-700 dark:text-gray-200 border-b-2 border-gray-300 pb-1 mb-2">Complio Checklist</h4>
              <ComplioStudentPrintView s={complio} />
            </section>
          )}
          {includeMce && mce && (
            <section className={includeComplio && complio ? 'mt-6 page-break-before' : ''}>
              <h4 className="font-semibold text-gray-700 dark:text-gray-200 border-b-2 border-gray-300 pb-1 mb-2">mCE Checklist</h4>
              <MceStudentPrintView s={mce} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function PrintRow({ label, value }: { label: string; value: boolean | ThreeState | string }) {
  let display = '—';
  let color = 'text-gray-400';
  if (typeof value === 'boolean') {
    display = value ? '✓' : '✗';
    color = value ? 'text-green-600' : 'text-red-400';
  } else if (value === 'complete') { display = 'Complete'; color = 'text-green-600'; }
  else if (value === 'in_progress') { display = 'In Progress'; color = 'text-blue-600'; }
  else if (value === 'ordered') { display = 'Ordered'; color = 'text-yellow-600'; }
  else if (typeof value === 'string' && value) { display = value; color = 'text-gray-700'; }

  return (
    <div className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
      <span className="text-gray-700">{label}</span>
      <span className={`font-medium ${color}`}>{display}</span>
    </div>
  );
}

function ComplioStudentPrintView({ s }: { s: ComplioRow }) {
  // Student-facing print: FULL item names (brief 1.c.iv), and the internal
  // "Complio"/"mCE" package-subscription rows are omitted (1.c.iii). Attestation
  // / Docs Shared / CHH Receipt / CHH Approval / Hep B Declination stay OFF the
  // student print (internal tracking / removed columns) but remain in the admin
  // grid above.
  const tb = tbPrintValues(s);
  return (
    <div className="space-y-1">
      <PrintRow label="MMR" value={s.mmr_complete} />
      <PrintRow label="Varicella" value={s.vzv_complete} />
      <PrintRow label="Hepatitis B" value={s.hep_b_complete} />
      <PrintRow label="Tdap" value={s.tdap_complete} />
      <PrintRow label="COVID-19" value={s.covid_complete} />
      <PrintRow label="COVID-19 Exemption" value={s.covid_exemption} />
      <PrintRow label="TB PPD 1" value={tb.ppd1} />
      <PrintRow label="TB PPD 2" value={tb.ppd2} />
      <PrintRow label="QuantiFERON" value={tb.quantiferon} />
      <PrintRow label="Physical exam" value={s.physical_complete} />
      <PrintRow label="Health insurance" value={s.health_insurance_complete} />
      <PrintRow label="AHA BLS Provider card" value={s.bls_complete} />
      <PrintRow label="Flu shot" value={s.flu_shot_status === 'received' ? 'Received' : s.flu_shot_status === 'declined' ? 'Declined' : ''} />
      <PrintRow label="VHS Influenza Declination form" value={s.flu_declination} />
      <PrintRow label="VHS Hospital Orientation form" value={s.hospital_orientation_complete} />
      <PrintRow label="Student Declaration of Responsibilities & Confidentiality (Exhibits A&B)" value={s.exhibit_complete} />
      <PrintRow label="Background check" value={s.background_check_status} />
      <PrintRow label="Drug test" value={s.drug_test_status} />
      {s.complio_notes && (
        <div className="mt-3 p-2 bg-gray-50 rounded">
          <p className="text-xs font-semibold text-gray-500 mb-1">Notes</p>
          <p className="text-sm text-gray-800">{s.complio_notes}</p>
        </div>
      )}
    </div>
  );
}

function MceStudentPrintView({ s }: { s: MceRow }) {
  // Data-driven from MCE_SECTIONS so print names/order stay in lockstep with
  // the grid — grouped by section with FULL item names (Rae 8/11, §3.a.ii).
  return (
    <div className="space-y-2">
      {MCE_SECTIONS.map(section => (
        <div key={section.name}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mt-2 mb-1">{section.name}</p>
          <div className="space-y-1">
            {section.cols.map(col => (
              <PrintRow key={col.key} label={col.full} value={s[col.key] as boolean | ThreeState | string} />
            ))}
          </div>
        </div>
      ))}
      {s.mce_notes && (
        <div className="mt-3 p-2 bg-gray-50 rounded">
          <p className="text-xs font-semibold text-gray-500 mb-1">Notes</p>
          <p className="text-sm text-gray-800">{s.mce_notes}</p>
        </div>
      )}
    </div>
  );
}

// ── Column header helpers ─────────────────────────────────────────────────────

function TH({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-1.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 whitespace-nowrap border-b border-r border-gray-300 dark:border-gray-600 last:border-r-0 ${className}`}>
      {children}
    </th>
  );
}

function TD({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  // Vertical column separators (border-r, gray-300) are deliberately MORE
  // defined than the horizontal row rules (border-b, gray-100): Rae was
  // mis-marking columns for students lower in the list, so the column
  // boundaries need to read clearly across a wide grid.
  return (
    <td className={`px-1.5 py-1.5 border-b border-gray-100 dark:border-gray-800 border-r border-gray-300 dark:border-gray-600 last:border-r-0 ${className}`}>
      {children}
    </td>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ClinicalTrackerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<'complio' | 'mce'>('complio');
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [cohortId, setCohortId] = useState<string>('');
  const [complioRows, setComplioRows] = useState<ComplioRow[]>([]);
  const [mceRows, setMceRows] = useState<MceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [printStudentId, setPrintStudentId] = useState<string | null>(null);
  const [showAgg, setShowAgg] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
  }, [status, router]);

  // Load cohorts — matches the endpoint every other cohort-selector page in
  // the app uses (/api/cohorts was never a real route; it silently 404'd,
  // leaving the dropdown permanently empty).
  useEffect(() => {
    fetch('/api/lab-management/cohorts?activeOnly=true')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.cohorts) {
          const sorted = [...d.cohorts].sort((a: Cohort, b: Cohort) => b.cohort_number - a.cohort_number);
          setCohorts(sorted);
          // EMT cohorts don't attend hospital rotations (no Complio/mCE), so
          // they're filtered out of the selector (Rae, 8/11). Default selection
          // also skips EMT. Full `cohorts` is kept so a deep-linked EMT cohortId
          // still resolves and shows the existing EMT N/A panel rather than breaking.
          const selectable = sorted.filter((c: Cohort) => c.program?.abbreviation !== 'EMT');
          // Default to the first selectable cohort that actually has students,
          // not just the first in sort order — an empty-cohort default would
          // still look broken (0/0) even once the dropdown is populated.
          const populated = selectable.find((c: Cohort) => (c.student_count ?? 0) > 0);
          const initial = searchParams.get('cohortId') || populated?.id || selectable[0]?.id || '';
          setCohortId(initial);
        }
      })
      .catch(console.error);
  }, []);

  // Fetch both tabs whenever cohort changes
  const fetchData = useCallback(async () => {
    if (!cohortId) return;
    setLoading(true);
    try {
      const [cRes, mRes] = await Promise.all([
        fetch(`/api/clinical/compliance?cohortId=${cohortId}`),
        fetch(`/api/clinical/mce-docs?cohortId=${cohortId}`),
      ]);
      const cData = await cRes.json();
      const mData = await mRes.json();

      if (cData.success) {
        // Build a map from API docs, merging student name fields
        const map = new Map<string, ComplioRow>();
        (cData.docs || []).forEach((d: any) => {
          map.set(d.student_id, {
            student_id: d.student_id,
            first_name: d.first_name || '',
            last_name: d.last_name || '',
            complio_complete: d.complio_complete ?? false,
            mce_complete: d.mce_complete ?? false,
            mmr_complete: d.mmr_complete ?? false,
            vzv_complete: d.vzv_complete ?? false,
            hep_b_complete: d.hep_b_complete ?? false,
            hep_b_declination: d.hep_b_declination ?? false,
            tdap_complete: d.tdap_complete ?? false,
            covid_complete: d.covid_complete ?? false,
            covid_exemption: d.covid_exemption ?? false,
            tb_test_1_complete: d.tb_test_1_complete ?? false,
            tb_test_2_complete: d.tb_test_2_complete ?? false,
            tb_questionnaire: d.tb_questionnaire ?? false,
            physical_complete: d.physical_complete ?? false,
            health_insurance_complete: d.health_insurance_complete ?? false,
            bls_complete: d.bls_complete ?? false,
            flu_shot_complete: d.flu_shot_complete ?? false,
            flu_shot_status: d.flu_shot_status ?? null,
            flu_declination: d.flu_declination ?? false,
            hospital_orientation_complete: d.hospital_orientation_complete ?? false,
            exhibit_complete: d.exhibit_complete ?? false,
            background_check_status: d.background_check_status ?? null,
            drug_test_status: d.drug_test_status ?? null,
            attestation_complete: d.attestation_complete ?? false,
            docs_shared_with_sites: d.docs_shared_with_sites ?? false,
            chh_receipt_complete: d.chh_receipt_complete ?? false,
            chh_approval_complete: d.chh_approval_complete ?? false,
            complio_notes: d.complio_notes ?? '',
          });
        });
        setComplioRows(Array.from(map.values()).sort((a, b) =>
          a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name)
        ));
      }

      if (mData.success) {
        const rows: MceRow[] = (mData.docs || []).map((d: any) => ({
          student_id: d.student_id,
          first_name: d.first_name || '',
          last_name: d.last_name || '',
          bg_check_status: d.bg_check_status ?? null,
          drug_test_status: d.drug_test_status ?? null,
          physical: d.physical ?? false,
          insurance: d.insurance ?? false,
          photo: d.photo ?? false,
          tb: d.tb ?? false,
          mmr: d.mmr ?? false,
          flu: d.flu ?? false,
          hep_b: d.hep_b ?? false,
          tdap: d.tdap ?? false,
          vzv: d.vzv ?? false,
          covid: d.covid ?? false,
          bls: d.bls ?? false,
          confidentiality: d.confidentiality ?? false,
          flu_declination: d.flu_declination ?? false,
          hep_b_declination: d.hep_b_declination ?? false,
          mmr_declination: d.mmr_declination ?? false,
          tdap_declination: d.tdap_declination ?? false,
          vzv_declination: d.vzv_declination ?? false,
          nsp: d.nsp ?? false,
          cultural_competency: d.cultural_competency ?? false,
          parking: d.parking ?? false,
          eta_module: d.eta_module ?? false,
          attestation_lgs: d.attestation_lgs ?? false,
          wpvp: d.wpvp ?? false,
          orientation: d.orientation ?? false,
          conduct: d.conduct ?? false,
          cs_attestation: d.cs_attestation ?? false,
          cs_orientation: d.cs_orientation ?? false,
          wpvp_curriculum: d.wpvp_curriculum ?? false,
          orientation_exam: d.orientation_exam ?? false,
          mce_notes: d.mce_notes ?? '',
        }));
        setMceRows(rows);
      }
    } catch (e) {
      console.error('Error fetching tracker data:', e);
    }
    setLoading(false);
  }, [cohortId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // AEMT students use mCE only — Complio is not applicable to them (Ben,
  // 2026-07-02). If the selected cohort is AEMT and the Complio tab is
  // active, bounce to mCE. Doesn't fire for Paramedic (both tabs apply).
  // EMT uses neither tab (Ben, 2026-07-07) — tab selection there is moot
  // since both are disabled and the body renders the EMT N/A state instead.
  useEffect(() => {
    const cohort = cohorts.find(c => c.id === cohortId);
    if (cohort?.program?.abbreviation === 'AEMT' && tab === 'complio') {
      setTab('mce');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohortId, cohorts]);

  // ── Save helpers ────────────────────────────────────────────────────────────

  const saveComplio = async (studentId: string, field: string, value: unknown) => {
    const key = `complio-${studentId}-${field}`;
    setSaving(s => ({ ...s, [key]: true }));
    try {
      const res = await fetch('/api/clinical/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, field, value }),
      });
      const data = await res.json();
      if (!data.success) console.error('Save error:', data.error);
      else {
        setComplioRows(rows =>
          rows.map(r => r.student_id === studentId ? { ...r, [field]: value } : r)
        );
      }
    } catch (e) {
      console.error('Save failed:', e);
    }
    setSaving(s => { const n = { ...s }; delete n[key]; return n; });
  };

  const saveMce = async (studentId: string, cohortId: string, field: string, value: unknown) => {
    const key = `mce-${studentId}-${field}`;
    setSaving(s => ({ ...s, [key]: true }));
    try {
      const res = await fetch('/api/clinical/mce-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, cohort_id: cohortId, field, value }),
      });
      const data = await res.json();
      if (!data.success) console.error('Save error:', data.error);
      else {
        setMceRows(rows =>
          rows.map(r => r.student_id === studentId ? { ...r, [field]: value } : r)
        );
      }
    } catch (e) {
      console.error('Save failed:', e);
    }
    setSaving(s => { const n = { ...s }; delete n[key]; return n; });
  };

  // ── Aggregation calculations ────────────────────────────────────────────────

  const total = tab === 'complio' ? complioRows.length : mceRows.length;

  const complioAgg = {
    complio: complioRows.filter(r => r.complio_complete).length,
    mce: complioRows.filter(r => r.mce_complete).length,
    mmr: complioRows.filter(r => r.mmr_complete).length,
    vzv: complioRows.filter(r => r.vzv_complete).length,
    hep_b: complioRows.filter(r => r.hep_b_complete || r.hep_b_declination).length,
    tdap: complioRows.filter(r => r.tdap_complete).length,
    covid: complioRows.filter(r => r.covid_complete || r.covid_exemption).length,
    tb: complioRows.filter(r => r.tb_test_1_complete).length,
    physical: complioRows.filter(r => r.physical_complete).length,
    h_ins: complioRows.filter(r => r.health_insurance_complete).length,
    bls: complioRows.filter(r => r.bls_complete).length,
    flu: complioRows.filter(r => r.flu_shot_status === 'received' || r.flu_declination).length,
    h_orient: complioRows.filter(r => r.hospital_orientation_complete).length,
    bg: complioRows.filter(r => r.background_check_status === 'complete').length,
    dt: complioRows.filter(r => r.drug_test_status === 'complete').length,
    attest: complioRows.filter(r => r.attestation_complete).length,
    shared: complioRows.filter(r => r.docs_shared_with_sites).length,
    chh_r: complioRows.filter(r => r.chh_receipt_complete).length,
    chh_a: complioRows.filter(r => r.chh_approval_complete).length,
  };

  // mCE aggregate is data-driven from MCE_SECTIONS so the completion overview
  // always matches the grid's columns (Rae 2026-08-11 redesign).
  const mceColCount = (col: MceCol) =>
    col.kind === 'threestate'
      ? mceRows.filter(r => r[col.key] === 'complete').length
      : mceRows.filter(r => r[col.key] === true).length;

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (!session) return null;

  const currentCohort = cohorts.find(c => c.id === cohortId);
  // Complio is a Paramedic-only requirement; AEMT students only need mCE.
  const isAemtCohort = currentCohort?.program?.abbreviation === 'AEMT';
  // EMT uses NEITHER Complio nor mCE — those are hospital-compliance systems.
  // EMT students do agency ride-alongs (usually AMR) instead, tracked at
  // /clinical/emt-tracking (Ben, 2026-07-02/07). Mirrors the AEMT N/A
  // pattern above but for both tabs.
  const isEmtCohort = currentCohort?.program?.abbreviation === 'EMT';

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 py-5">
          <Breadcrumbs className="mb-2" />
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
              <FileCheck className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clinical Tracker</h1>
              <p className="text-gray-600 dark:text-gray-400">Complio documentation &amp; mCE module checklist</p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-screen-2xl mx-auto px-4 py-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            value={cohortId}
            onChange={e => setCohortId(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            {cohorts
              .filter(c => c.program?.abbreviation !== 'EMT' || c.id === cohortId)
              .map(c => (
                <option key={c.id} value={c.id}>
                  {cohortLabel(c)}
                </option>
              ))}
          </select>

          {/* Tabs */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => { if (!isAemtCohort && !isEmtCohort) setTab('complio'); }}
              disabled={isAemtCohort || isEmtCohort}
              title={
                isEmtCohort
                  ? 'Complio is not applicable for EMT — EMT uses agency ride-alongs'
                  : isAemtCohort
                  ? 'Complio is not applicable for AEMT — mCE only'
                  : undefined
              }
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                isAemtCohort || isEmtCohort
                  ? 'bg-gray-100 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : tab === 'complio'
                  ? 'bg-teal-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Complio{isAemtCohort || isEmtCohort ? ' (N/A)' : ''}
            </button>
            <button
              onClick={() => { if (!isEmtCohort) setTab('mce'); }}
              disabled={isEmtCohort}
              title={isEmtCohort ? 'mCE is not applicable for EMT — EMT uses agency ride-alongs' : undefined}
              className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-200 dark:border-gray-700 ${
                isEmtCohort
                  ? 'bg-gray-100 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : tab === 'mce'
                  ? 'bg-teal-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              mCE Modules{isEmtCohort ? ' (N/A)' : ''}
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            {loading && <span className="animate-pulse">Loading…</span>}
            <span>{total} student{total !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* EMT: neither Complio nor mCE applies — show a clear N/A state
            instead of an empty/misleading tracker (Ben, 2026-07-02/07). */}
        {isEmtCohort ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-10 text-center">
            <p className="text-gray-700 dark:text-gray-300 font-medium mb-2">
              Complio and mCE do not apply to EMT students
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xl mx-auto">
              Complio and mCE are hospital-compliance systems used by Paramedic and AEMT
              students. EMT students complete agency ride-alongs (usually with AMR) instead —
              tracked on the{' '}
              <Link href="/clinical/emt-tracking" className="text-teal-600 dark:text-teal-400 hover:underline">
                EMT Tracking
              </Link>{' '}
              page.
            </p>
          </div>
        ) : (
        <>
        {/* Aggregation panel */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow mb-4 overflow-hidden">
          <button
            onClick={() => setShowAgg(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <span>Completion Overview — {currentCohort ? cohortLabel(currentCohort) : 'Selected Cohort'} ({tab === 'complio' ? 'Complio' : 'mCE'})</span>
            {showAgg ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showAgg && (
            <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-8 gap-y-2 border-t border-gray-100 dark:border-gray-700 pt-3">
              {tab === 'complio' ? (
                <>
                  <AggBar label="Complio" count={complioAgg.complio} total={total} />
                  <AggBar label="mCE" count={complioAgg.mce} total={total} />
                  <AggBar label="MMR" count={complioAgg.mmr} total={total} />
                  <AggBar label="VZV" count={complioAgg.vzv} total={total} />
                  <AggBar label="Hep B" count={complioAgg.hep_b} total={total} />
                  <AggBar label="Tdap" count={complioAgg.tdap} total={total} />
                  <AggBar label="COVID" count={complioAgg.covid} total={total} />
                  <AggBar label="TB Test 1" count={complioAgg.tb} total={total} />
                  <AggBar label="Physical" count={complioAgg.physical} total={total} />
                  <AggBar label="Health Ins." count={complioAgg.h_ins} total={total} />
                  <AggBar label="BLS" count={complioAgg.bls} total={total} />
                  <AggBar label="Flu" count={complioAgg.flu} total={total} />
                  <AggBar label="H. Orient." count={complioAgg.h_orient} total={total} />
                  <AggBar label="BG Check" count={complioAgg.bg} total={total} />
                  <AggBar label="Drug Test" count={complioAgg.dt} total={total} />
                  <AggBar label="Attestation" count={complioAgg.attest} total={total} />
                  <AggBar label="Docs Shared" count={complioAgg.shared} total={total} />
                </>
              ) : (
                <>
                  {MCE_COLS.map(col => (
                    <AggBar key={col.key} label={col.short} count={mceColCount(col)} total={total} />
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-x-auto">
          {tab === 'complio' ? (
            <ComplioTable
              rows={complioRows}
              cohortId={cohortId}
              saving={saving}
              onSave={saveComplio}
              onPrint={s => setPrintStudentId(s.student_id)}
            />
          ) : (
            <MceTable
              rows={mceRows}
              cohortId={cohortId}
              saving={saving}
              onSave={saveMce}
              onPrint={s => setPrintStudentId(s.student_id)}
            />
          )}

          {!loading && total === 0 && (
            <div className="p-10 text-center text-gray-500 dark:text-gray-400">
              No active students found for this cohort.
            </div>
          )}
        </div>
        </>
        )}
      </main>

      {/* Print modal — looks up BOTH checklists for the student so Rae can
          print one or both at once (brief 1.c.i). */}
      {printStudentId && (
        <PrintModal
          complio={complioRows.find(r => r.student_id === printStudentId) || null}
          mce={mceRows.find(r => r.student_id === printStudentId) || null}
          defaultTab={tab}
          onClose={() => setPrintStudentId(null)}
        />
      )}
    </div>
  );
}

// ── Complio table ─────────────────────────────────────────────────────────────

function ComplioTable({
  rows,
  cohortId,
  saving,
  onSave,
  onPrint,
}: {
  rows: ComplioRow[];
  cohortId: string;
  saving: Record<string, boolean>;
  onSave: (studentId: string, field: string, value: unknown) => void;
  onPrint: (row: ComplioRow) => void;
}) {
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-white dark:bg-gray-800 z-10">
        <tr>
          <TH className="sticky left-0 bg-white dark:bg-gray-800 min-w-[130px]">Student</TH>
          <TH>Print</TH>
          <TH>Complio</TH>
          <TH>mCE</TH>
          <TH>MMR</TH>
          <TH>VZV</TH>
          <TH>Hep B</TH>
          <TH>Tdap</TH>
          <TH>COVID</TH>
          <TH>COVID Exmpt</TH>
          <TH>TB1</TH>
          <TH>TB2/Q</TH>
          <TH>Phys</TH>
          <TH>H Ins</TH>
          <TH>BLS</TH>
          <TH>Flu Sh</TH>
          <TH>Flu Dec</TH>
          <TH>H Orient</TH>
          <TH>Exhib</TH>
          <TH>BG</TH>
          <TH>DT</TH>
          <TH>Attest</TH>
          <TH>Shared?</TH>
          <TH>Notes</TH>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => {
          const sk = (f: string) => saving[`complio-${row.student_id}-${f}`];
          // Both TB paths on file at once (e.g. legacy dual entry) used to grey
          // TB1, TB2, AND QuantiFERON to N/A simultaneously — locking all three
          // with no way to un-grey any of them, since the field that would clear
          // the others was itself hidden behind N/A. Skip the grey-out in this
          // conflict case so all three stay real, clickable checkboxes and staff
          // can clear whichever entry is extra (bug: 2026-08-13, Alpuerto + 14 others).
          const tbConflict = row.tb_questionnaire && row.tb_test_1_complete && row.tb_test_2_complete;
          return (
            <tr key={row.student_id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
              <TD className="sticky left-0 bg-white dark:bg-gray-800 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                {row.last_name}, {row.first_name}
              </TD>
              <TD>
                <button
                  onClick={() => onPrint(row)}
                  className="p-1 hover:text-blue-600 text-gray-400"
                  title="Print student view"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
              </TD>
              <TD><CheckCell value={row.complio_complete} onChange={v => onSave(row.student_id, 'complio_complete', v)} saving={sk('complio_complete')} /></TD>
              <TD><CheckCell value={row.mce_complete} onChange={v => onSave(row.student_id, 'mce_complete', v)} saving={sk('mce_complete')} /></TD>
              <TD><CheckCell value={row.mmr_complete} onChange={v => onSave(row.student_id, 'mmr_complete', v)} saving={sk('mmr_complete')} /></TD>
              <TD><CheckCell value={row.vzv_complete} onChange={v => onSave(row.student_id, 'vzv_complete', v)} saving={sk('vzv_complete')} /></TD>
              <TD><CheckCell value={row.hep_b_complete} onChange={v => onSave(row.student_id, 'hep_b_complete', v)} saving={sk('hep_b_complete')} /></TD>
              <TD><CheckCell value={row.tdap_complete} onChange={v => onSave(row.student_id, 'tdap_complete', v)} saving={sk('tdap_complete')} /></TD>
              {/* COVID greys to N/A when a COVID exemption is on file (display only). */}
              <TD>
                {row.covid_exemption
                  ? <NaCell title="COVID-19 exemption on file — vaccine N/A" />
                  : <CheckCell value={row.covid_complete} onChange={v => onSave(row.student_id, 'covid_complete', v)} saving={sk('covid_complete')} />}
              </TD>
              <TD><CheckCell value={row.covid_exemption} onChange={v => onSave(row.student_id, 'covid_exemption', v)} saving={sk('covid_exemption')} /></TD>
              {/* TB PPD 1/2 ↔ QuantiFERON mutual exclusion (display only):
                  QuantiFERON on file → both PPDs N/A; both PPDs done → QuantiFERON N/A.
                  Suppressed when tbConflict (all three on file) — see note above. */}
              <TD>
                {row.tb_questionnaire && !tbConflict
                  ? <NaCell title="QuantiFERON on file — TB PPD not required" />
                  : <CheckCell value={row.tb_test_1_complete} onChange={v => onSave(row.student_id, 'tb_test_1_complete', v)} saving={sk('tb_test_1_complete')} />}
              </TD>
              <TD>
                <div className="flex gap-1" title={tbConflict ? 'TB PPD 1/2 and QuantiFERON are all on file — clear whichever is extra' : undefined}>
                  {row.tb_questionnaire && !tbConflict
                    ? <NaCell title="QuantiFERON on file — TB PPD not required" />
                    : <CheckCell value={row.tb_test_2_complete} onChange={v => onSave(row.student_id, 'tb_test_2_complete', v)} saving={sk('tb_test_2_complete')} />}
                  {(row.tb_test_1_complete && row.tb_test_2_complete) && !tbConflict
                    ? <NaCell title="Two TB PPDs on file — QuantiFERON not required" />
                    : <CheckCell value={row.tb_questionnaire} onChange={v => onSave(row.student_id, 'tb_questionnaire', v)} saving={sk('tb_questionnaire')} />}
                </div>
              </TD>
              <TD><CheckCell value={row.physical_complete} onChange={v => onSave(row.student_id, 'physical_complete', v)} saving={sk('physical_complete')} /></TD>
              <TD><CheckCell value={row.health_insurance_complete} onChange={v => onSave(row.student_id, 'health_insurance_complete', v)} saving={sk('health_insurance_complete')} /></TD>
              <TD><CheckCell value={row.bls_complete} onChange={v => onSave(row.student_id, 'bls_complete', v)} saving={sk('bls_complete')} /></TD>
              <TD><FluStatusCell value={row.flu_shot_status} onChange={v => onSave(row.student_id, 'flu_shot_status', v)} saving={sk('flu_shot_status')} /></TD>
              <TD><CheckCell value={row.flu_declination} onChange={v => onSave(row.student_id, 'flu_declination', v)} saving={sk('flu_declination')} /></TD>
              <TD><CheckCell value={row.hospital_orientation_complete} onChange={v => onSave(row.student_id, 'hospital_orientation_complete', v)} saving={sk('hospital_orientation_complete')} /></TD>
              <TD><CheckCell value={row.exhibit_complete} onChange={v => onSave(row.student_id, 'exhibit_complete', v)} saving={sk('exhibit_complete')} /></TD>
              <TD>
                <ThreeStateCell
                  value={row.background_check_status}
                  onChange={v => onSave(row.student_id, 'background_check_status', v)}
                  saving={sk('background_check_status')}
                />
              </TD>
              <TD>
                <ThreeStateCell
                  value={row.drug_test_status}
                  onChange={v => onSave(row.student_id, 'drug_test_status', v)}
                  saving={sk('drug_test_status')}
                />
              </TD>
              <TD><CheckCell value={row.attestation_complete} onChange={v => onSave(row.student_id, 'attestation_complete', v)} saving={sk('attestation_complete')} /></TD>
              <TD><CheckCell value={row.docs_shared_with_sites} onChange={v => onSave(row.student_id, 'docs_shared_with_sites', v)} saving={sk('docs_shared_with_sites')} /></TD>
              <TD>
                <NotesCell
                  value={row.complio_notes}
                  onChange={v => onSave(row.student_id, 'complio_notes', v)}
                  saving={sk('complio_notes')}
                />
              </TD>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── mCE Modules table ─────────────────────────────────────────────────────────

function MceTable({
  rows,
  cohortId,
  saving,
  onSave,
  onPrint,
}: {
  rows: MceRow[];
  cohortId: string;
  saving: Record<string, boolean>;
  onSave: (studentId: string, cohortId: string, field: string, value: unknown) => void;
  onPrint: (row: MceRow) => void;
}) {
  // Thick separator marking each section boundary (Rae 8/11 redesign).
  const sectionBorder = 'border-l-2 border-gray-400 dark:border-gray-500';
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-white dark:bg-gray-800 z-10">
        {/* Section header bands: Compliance / Documents / Modules / Exam */}
        <tr>
          <th
            rowSpan={2}
            className="sticky left-0 z-10 bg-white dark:bg-gray-800 px-1.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-r border-gray-300 dark:border-gray-600 min-w-[130px] align-bottom"
          >
            Student
          </th>
          <th
            rowSpan={2}
            className="bg-white dark:bg-gray-800 px-1.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-r border-gray-300 dark:border-gray-600 align-bottom"
          >
            Print
          </th>
          {MCE_SECTIONS.map(section => (
            <th
              key={section.name}
              colSpan={section.cols.length}
              className={`px-1.5 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/40 border-b-2 border-gray-300 dark:border-gray-600 ${sectionBorder}`}
            >
              {section.name}
            </th>
          ))}
          <th
            rowSpan={2}
            className={`bg-white dark:bg-gray-800 px-1.5 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-r border-gray-300 dark:border-gray-600 align-bottom ${sectionBorder}`}
          >
            Notes
          </th>
        </tr>
        {/* Column headers */}
        <tr>
          {MCE_SECTIONS.flatMap(section =>
            section.cols.map((col, i) => (
              <TH key={col.key} className={i === 0 ? sectionBorder : ''}>{col.short}</TH>
            )),
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map(row => {
          const sk = (f: string) => saving[`mce-${row.student_id}-${f}`];
          const save = (f: string, v: unknown) => onSave(row.student_id, cohortId, f, v);
          return (
            <tr key={row.student_id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
              <TD className="sticky left-0 bg-white dark:bg-gray-800 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                {row.last_name}, {row.first_name}
              </TD>
              <TD>
                <button
                  onClick={() => onPrint(row)}
                  className="p-1 hover:text-blue-600 text-gray-400"
                  title="Print student view"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
              </TD>
              {MCE_SECTIONS.flatMap(section =>
                section.cols.map((col, i) => (
                  <TD key={col.key} className={i === 0 ? sectionBorder : ''}>
                    {col.kind === 'threestate' ? (
                      <ThreeStateCell
                        value={row[col.key] as ThreeState}
                        onChange={v => save(col.key as string, v)}
                        saving={sk(col.key as string)}
                      />
                    ) : (
                      <CheckCell
                        value={row[col.key] as boolean}
                        onChange={v => save(col.key as string, v)}
                        saving={sk(col.key as string)}
                      />
                    )}
                  </TD>
                )),
              )}
              <TD className={sectionBorder}>
                <NotesCell
                  value={row.mce_notes}
                  onChange={v => save('mce_notes', v)}
                  saving={sk('mce_notes')}
                />
              </TD>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
