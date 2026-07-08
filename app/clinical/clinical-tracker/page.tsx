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

// ── Types ────────────────────────────────────────────────────────────────────

type ThreeState = 'ordered' | 'in_progress' | 'complete' | null;

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
  mce_notes: string;
}

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
        className={`min-w-[90px] px-2 py-1 rounded text-xs font-medium text-left flex items-center gap-1 border transition-opacity ${
          value ? THREE_STATE_COLORS[value] : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 border-transparent'
        } ${saving ? 'opacity-50' : 'hover:opacity-80'}`}
      >
        <span className="flex-1">{value ? THREE_STATE_LABELS[value] : '—'}</span>
        <ChevronDown className="w-3 h-3 flex-shrink-0" />
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

function PrintModal({
  student,
  tab,
  onClose,
}: {
  student: ComplioRow | MceRow;
  tab: 'complio' | 'mce';
  onClose: () => void;
}) {
  const name = `${student.last_name}, ${student.first_name}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto print:bg-white print:p-0">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full mt-8 print:shadow-none print:mt-0">
        <div className="flex items-center justify-between p-4 border-b print:hidden">
          <h2 className="font-semibold text-gray-900 dark:text-white">Print Preview — {name}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
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
              <p className="text-gray-500 text-xs">Clinical {tab === 'complio' ? 'Complio' : 'mCE'} Checklist</p>
            </div>
            <div className="text-xs text-gray-400">{new Date().toLocaleDateString()}</div>
          </div>

          {tab === 'complio' ? (
            <ComplioStudentPrintView s={student as ComplioRow} />
          ) : (
            <MceStudentPrintView s={student as MceRow} />
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
  return (
    <div className="space-y-1">
      <PrintRow label="Complio" value={s.complio_complete} />
      <PrintRow label="mCE" value={s.mce_complete} />
      <PrintRow label="MMR" value={s.mmr_complete} />
      <PrintRow label="VZV" value={s.vzv_complete} />
      <PrintRow label="Hep B" value={s.hep_b_complete} />
      <PrintRow label="Hep B Declination" value={s.hep_b_declination} />
      <PrintRow label="Tdap" value={s.tdap_complete} />
      <PrintRow label="COVID" value={s.covid_complete} />
      <PrintRow label="COVID Exemption" value={s.covid_exemption} />
      <PrintRow label="TB Test 1" value={s.tb_test_1_complete} />
      <PrintRow label="TB Test 2 / Questionnaire" value={s.tb_test_2_complete || s.tb_questionnaire} />
      <PrintRow label="Physical" value={s.physical_complete} />
      <PrintRow label="Health Insurance" value={s.health_insurance_complete} />
      <PrintRow label="BLS" value={s.bls_complete} />
      <PrintRow label="Flu Shot" value={s.flu_shot_complete} />
      <PrintRow label="Flu Declination" value={s.flu_declination} />
      <PrintRow label="Hospital Orientation" value={s.hospital_orientation_complete} />
      <PrintRow label="Exhibit" value={s.exhibit_complete} />
      <PrintRow label="Background Check" value={s.background_check_status} />
      <PrintRow label="Drug Test" value={s.drug_test_status} />
      {/* Attestation / Docs Shared / CHH Receipt / CHH Approval are
          intentionally omitted from the STUDENT print-out (Rae, feedback
          8ac4ace6) — they're internal tracking fields and stay visible
          in the admin table above. */}
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
  return (
    <div className="space-y-1">
      <PrintRow label="Background Check" value={s.bg_check_status} />
      <PrintRow label="Drug Test" value={s.drug_test_status} />
      <PrintRow label="Physical" value={s.physical} />
      <PrintRow label="Insurance" value={s.insurance} />
      <PrintRow label="Photo" value={s.photo} />
      <PrintRow label="TB" value={s.tb} />
      <PrintRow label="MMR" value={s.mmr} />
      <PrintRow label="Flu" value={s.flu} />
      <PrintRow label="Hep B" value={s.hep_b} />
      <PrintRow label="Tdap" value={s.tdap} />
      <PrintRow label="VZV" value={s.vzv} />
      <PrintRow label="COVID" value={s.covid} />
      <PrintRow label="BLS" value={s.bls} />
      <PrintRow label="Confidentiality" value={s.confidentiality} />
      <PrintRow label="Flu Declination" value={s.flu_declination} />
      <PrintRow label="Hep B Declination" value={s.hep_b_declination} />
      <PrintRow label="MMR Declination" value={s.mmr_declination} />
      <PrintRow label="Tdap Declination" value={s.tdap_declination} />
      <PrintRow label="VZV Declination" value={s.vzv_declination} />
      <PrintRow label="NSP" value={s.nsp} />
      <PrintRow label="Cultural Competency" value={s.cultural_competency} />
      <PrintRow label="Parking" value={s.parking} />
      <PrintRow label="ETA Module" value={s.eta_module} />
      <PrintRow label="Attestation LGS" value={s.attestation_lgs} />
      <PrintRow label="WPVP" value={s.wpvp} />
      <PrintRow label="Orientation" value={s.orientation} />
      <PrintRow label="Conduct" value={s.conduct} />
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
    <th className={`px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 whitespace-nowrap border-b border-gray-200 dark:border-gray-700 ${className}`}>
      {children}
    </th>
  );
}

function TD({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-2 py-1.5 border-b border-gray-100 dark:border-gray-800 ${className}`}>
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
  const [printStudent, setPrintStudent] = useState<ComplioRow | MceRow | null>(null);
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
          // Default to the first cohort that actually has students, not just
          // the first in sort order — an empty-cohort default would still
          // look broken (0/0) even once the dropdown itself is populated.
          const populated = sorted.find(c => (c.student_count ?? 0) > 0);
          const initial = searchParams.get('cohortId') || populated?.id || sorted[0]?.id || '';
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
    flu: complioRows.filter(r => r.flu_shot_complete || r.flu_declination).length,
    h_orient: complioRows.filter(r => r.hospital_orientation_complete).length,
    bg: complioRows.filter(r => r.background_check_status === 'complete').length,
    dt: complioRows.filter(r => r.drug_test_status === 'complete').length,
    attest: complioRows.filter(r => r.attestation_complete).length,
    shared: complioRows.filter(r => r.docs_shared_with_sites).length,
    chh_r: complioRows.filter(r => r.chh_receipt_complete).length,
    chh_a: complioRows.filter(r => r.chh_approval_complete).length,
  };

  const mceAgg = {
    bg: mceRows.filter(r => r.bg_check_status === 'complete').length,
    dt: mceRows.filter(r => r.drug_test_status === 'complete').length,
    physical: mceRows.filter(r => r.physical).length,
    insurance: mceRows.filter(r => r.insurance).length,
    photo: mceRows.filter(r => r.photo).length,
    tb: mceRows.filter(r => r.tb).length,
    mmr: mceRows.filter(r => r.mmr || r.mmr_declination).length,
    flu: mceRows.filter(r => r.flu || r.flu_declination).length,
    hep_b: mceRows.filter(r => r.hep_b || r.hep_b_declination).length,
    tdap: mceRows.filter(r => r.tdap || r.tdap_declination).length,
    vzv: mceRows.filter(r => r.vzv || r.vzv_declination).length,
    covid: mceRows.filter(r => r.covid).length,
    bls: mceRows.filter(r => r.bls).length,
    confid: mceRows.filter(r => r.confidentiality).length,
    nsp: mceRows.filter(r => r.nsp).length,
    cult: mceRows.filter(r => r.cultural_competency).length,
    parking: mceRows.filter(r => r.parking).length,
    eta: mceRows.filter(r => r.eta_module).length,
    attest_lgs: mceRows.filter(r => r.attestation_lgs).length,
    wpvp: mceRows.filter(r => r.wpvp).length,
    orient: mceRows.filter(r => r.orientation).length,
    conduct: mceRows.filter(r => r.conduct).length,
  };

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
            {cohorts.map(c => (
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
                  <AggBar label="CHH Receipt" count={complioAgg.chh_r} total={total} />
                  <AggBar label="CHH Approval" count={complioAgg.chh_a} total={total} />
                </>
              ) : (
                <>
                  <AggBar label="BG Check" count={mceAgg.bg} total={total} />
                  <AggBar label="Drug Test" count={mceAgg.dt} total={total} />
                  <AggBar label="Physical" count={mceAgg.physical} total={total} />
                  <AggBar label="Insurance" count={mceAgg.insurance} total={total} />
                  <AggBar label="Photo" count={mceAgg.photo} total={total} />
                  <AggBar label="TB" count={mceAgg.tb} total={total} />
                  <AggBar label="MMR" count={mceAgg.mmr} total={total} />
                  <AggBar label="Flu" count={mceAgg.flu} total={total} />
                  <AggBar label="Hep B" count={mceAgg.hep_b} total={total} />
                  <AggBar label="Tdap" count={mceAgg.tdap} total={total} />
                  <AggBar label="VZV" count={mceAgg.vzv} total={total} />
                  <AggBar label="COVID" count={mceAgg.covid} total={total} />
                  <AggBar label="BLS" count={mceAgg.bls} total={total} />
                  <AggBar label="Confidentiality" count={mceAgg.confid} total={total} />
                  <AggBar label="NSP" count={mceAgg.nsp} total={total} />
                  <AggBar label="Cultural Comp." count={mceAgg.cult} total={total} />
                  <AggBar label="Parking" count={mceAgg.parking} total={total} />
                  <AggBar label="ETA Module" count={mceAgg.eta} total={total} />
                  <AggBar label="Attest LGS" count={mceAgg.attest_lgs} total={total} />
                  <AggBar label="WPVP" count={mceAgg.wpvp} total={total} />
                  <AggBar label="Orientation" count={mceAgg.orient} total={total} />
                  <AggBar label="Conduct" count={mceAgg.conduct} total={total} />
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
              onPrint={s => setPrintStudent(s)}
            />
          ) : (
            <MceTable
              rows={mceRows}
              cohortId={cohortId}
              saving={saving}
              onSave={saveMce}
              onPrint={s => setPrintStudent(s)}
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

      {/* Print modal */}
      {printStudent && (
        <PrintModal
          student={printStudent}
          tab={tab}
          onClose={() => setPrintStudent(null)}
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
          <TH>Hep B Dec</TH>
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
          <TH>CHH Rcpt</TH>
          <TH>CHH Appr</TH>
          <TH>Notes</TH>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => {
          const sk = (f: string) => saving[`complio-${row.student_id}-${f}`];
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
              <TD><CheckCell value={row.hep_b_declination} onChange={v => onSave(row.student_id, 'hep_b_declination', v)} saving={sk('hep_b_declination')} /></TD>
              <TD><CheckCell value={row.tdap_complete} onChange={v => onSave(row.student_id, 'tdap_complete', v)} saving={sk('tdap_complete')} /></TD>
              <TD><CheckCell value={row.covid_complete} onChange={v => onSave(row.student_id, 'covid_complete', v)} saving={sk('covid_complete')} /></TD>
              <TD><CheckCell value={row.covid_exemption} onChange={v => onSave(row.student_id, 'covid_exemption', v)} saving={sk('covid_exemption')} /></TD>
              <TD><CheckCell value={row.tb_test_1_complete} onChange={v => onSave(row.student_id, 'tb_test_1_complete', v)} saving={sk('tb_test_1_complete')} /></TD>
              <TD>
                <div className="flex gap-1">
                  <CheckCell value={row.tb_test_2_complete} onChange={v => onSave(row.student_id, 'tb_test_2_complete', v)} saving={sk('tb_test_2_complete')} />
                  <CheckCell value={row.tb_questionnaire} onChange={v => onSave(row.student_id, 'tb_questionnaire', v)} saving={sk('tb_questionnaire')} />
                </div>
              </TD>
              <TD><CheckCell value={row.physical_complete} onChange={v => onSave(row.student_id, 'physical_complete', v)} saving={sk('physical_complete')} /></TD>
              <TD><CheckCell value={row.health_insurance_complete} onChange={v => onSave(row.student_id, 'health_insurance_complete', v)} saving={sk('health_insurance_complete')} /></TD>
              <TD><CheckCell value={row.bls_complete} onChange={v => onSave(row.student_id, 'bls_complete', v)} saving={sk('bls_complete')} /></TD>
              <TD><CheckCell value={row.flu_shot_complete} onChange={v => onSave(row.student_id, 'flu_shot_complete', v)} saving={sk('flu_shot_complete')} /></TD>
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
              <TD><CheckCell value={row.chh_receipt_complete} onChange={v => onSave(row.student_id, 'chh_receipt_complete', v)} saving={sk('chh_receipt_complete')} /></TD>
              <TD><CheckCell value={row.chh_approval_complete} onChange={v => onSave(row.student_id, 'chh_approval_complete', v)} saving={sk('chh_approval_complete')} /></TD>
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
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-white dark:bg-gray-800 z-10">
        <tr>
          <TH className="sticky left-0 bg-white dark:bg-gray-800 min-w-[130px]">Student</TH>
          <TH>Print</TH>
          <TH>BG</TH>
          <TH>DT</TH>
          <TH>Phys</TH>
          <TH>Ins</TH>
          <TH>Photo</TH>
          <TH>TB</TH>
          <TH>MMR</TH>
          <TH>Flu</TH>
          <TH>Hep B</TH>
          <TH>Tdap</TH>
          <TH>VZV</TH>
          <TH>COVID</TH>
          <TH>BLS</TH>
          <TH>Confid</TH>
          <TH>Flu Dec</TH>
          <TH>Hep B Dec</TH>
          <TH>MMR Dec</TH>
          <TH>Tdap Dec</TH>
          <TH>VZV Dec</TH>
          <TH>NSP</TH>
          <TH>Cult Comp</TH>
          <TH>Parking</TH>
          <TH>ETA 4/5</TH>
          <TH>Attest LGS</TH>
          <TH>WPVP</TH>
          <TH>Orient</TH>
          <TH>Conduct</TH>
          <TH>Notes</TH>
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
              <TD><ThreeStateCell value={row.bg_check_status} onChange={v => save('bg_check_status', v)} saving={sk('bg_check_status')} /></TD>
              <TD><ThreeStateCell value={row.drug_test_status} onChange={v => save('drug_test_status', v)} saving={sk('drug_test_status')} /></TD>
              <TD><CheckCell value={row.physical} onChange={v => save('physical', v)} saving={sk('physical')} /></TD>
              <TD><CheckCell value={row.insurance} onChange={v => save('insurance', v)} saving={sk('insurance')} /></TD>
              <TD><CheckCell value={row.photo} onChange={v => save('photo', v)} saving={sk('photo')} /></TD>
              <TD><CheckCell value={row.tb} onChange={v => save('tb', v)} saving={sk('tb')} /></TD>
              <TD><CheckCell value={row.mmr} onChange={v => save('mmr', v)} saving={sk('mmr')} /></TD>
              <TD><CheckCell value={row.flu} onChange={v => save('flu', v)} saving={sk('flu')} /></TD>
              <TD><CheckCell value={row.hep_b} onChange={v => save('hep_b', v)} saving={sk('hep_b')} /></TD>
              <TD><CheckCell value={row.tdap} onChange={v => save('tdap', v)} saving={sk('tdap')} /></TD>
              <TD><CheckCell value={row.vzv} onChange={v => save('vzv', v)} saving={sk('vzv')} /></TD>
              <TD><CheckCell value={row.covid} onChange={v => save('covid', v)} saving={sk('covid')} /></TD>
              <TD><CheckCell value={row.bls} onChange={v => save('bls', v)} saving={sk('bls')} /></TD>
              <TD><CheckCell value={row.confidentiality} onChange={v => save('confidentiality', v)} saving={sk('confidentiality')} /></TD>
              <TD><CheckCell value={row.flu_declination} onChange={v => save('flu_declination', v)} saving={sk('flu_declination')} /></TD>
              <TD><CheckCell value={row.hep_b_declination} onChange={v => save('hep_b_declination', v)} saving={sk('hep_b_declination')} /></TD>
              <TD><CheckCell value={row.mmr_declination} onChange={v => save('mmr_declination', v)} saving={sk('mmr_declination')} /></TD>
              <TD><CheckCell value={row.tdap_declination} onChange={v => save('tdap_declination', v)} saving={sk('tdap_declination')} /></TD>
              <TD><CheckCell value={row.vzv_declination} onChange={v => save('vzv_declination', v)} saving={sk('vzv_declination')} /></TD>
              <TD><CheckCell value={row.nsp} onChange={v => save('nsp', v)} saving={sk('nsp')} /></TD>
              <TD><CheckCell value={row.cultural_competency} onChange={v => save('cultural_competency', v)} saving={sk('cultural_competency')} /></TD>
              <TD><CheckCell value={row.parking} onChange={v => save('parking', v)} saving={sk('parking')} /></TD>
              <TD><CheckCell value={row.eta_module} onChange={v => save('eta_module', v)} saving={sk('eta_module')} /></TD>
              <TD><CheckCell value={row.attestation_lgs} onChange={v => save('attestation_lgs', v)} saving={sk('attestation_lgs')} /></TD>
              <TD><CheckCell value={row.wpvp} onChange={v => save('wpvp', v)} saving={sk('wpvp')} /></TD>
              <TD><CheckCell value={row.orientation} onChange={v => save('orientation', v)} saving={sk('orientation')} /></TD>
              <TD><CheckCell value={row.conduct} onChange={v => save('conduct', v)} saving={sk('conduct')} /></TD>
              <TD>
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
