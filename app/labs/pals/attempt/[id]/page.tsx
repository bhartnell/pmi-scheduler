'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, X, Minus, Loader2, Printer, Pencil } from 'lucide-react';
import BreadcrumbNames from '@/components/layout/BreadcrumbNames';

interface Person { id: string; first_name: string; last_name: string }
interface Step { id: string; order: number; text: string; is_critical: boolean; state: string; note: string | null }
interface Rec {
  attempt: { id: string; result: string; attempted_at: string; watch: boolean; watch_note: string | null; performance_notes: string | null; remediation_notes: string | null; lab_day_id: string | null };
  team_lead: Person | null; grader: { id: string; name: string } | null;
  scenario: { id: string; title: string; case_code: string | null; category: string | null } | null;
  group: { id: string; name: string } | null;
  station: { id: string; station_number: number | null; custom_title: string | null } | null;
  lab_day: { id: string; date: string; title: string | null; section_label: string | null } | null;
  team_members: Person[]; steps: Step[];
}

// Read-only PALS attempt record (practice or testing). Opened from the PALS hub board and the coordinator.
export default function PalsAttemptRecordPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [rec, setRec] = useState<Rec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ result: 'PASS', watch: false, watch_note: '', performance_notes: '', remediation_notes: '' });

  useEffect(() => {
    let off = false;
    fetch(`/api/pals/attempts/${id}`)
      .then(r => r.json())
      .then(j => { if (!off) { if (j.success) setRec(j); else setError(j.error || 'Failed to load'); } })
      .catch(() => { if (!off) setError('Failed to load'); });
    return () => { off = true; };
  }, [id]);

  const startEdit = () => {
    if (!rec) return;
    const x = rec.attempt;
    setForm({ result: x.result, watch: !!x.watch, watch_note: x.watch_note ?? '', performance_notes: x.performance_notes ?? '', remediation_notes: x.remediation_notes ?? '' });
    setSaveMsg(null);
    setEditing(true);
  };
  const save = async () => {
    setSaving(true); setSaveMsg(null);
    try {
      const r = await fetch(`/api/pals/attempts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const j = await r.json();
      if (!j.success) { setSaveMsg(j.error || 'Save failed'); return; }
      setRec(j); setEditing(false);
      setSaveMsg(`Saved by ${j.edited_by} at ${new Date(j.edited_at).toLocaleString()}`);
    } catch { setSaveMsg('Save failed'); } finally { setSaving(false); }
  };

  const name = (p: Person) => `${p.first_name} ${p.last_name}`;
  const a = rec?.attempt;
  const pass = a?.result === 'PASS';
  const notChecked = rec ? rec.steps.filter(s => s.state === 'not_checked').length : 0;
  const hubHref = rec?.lab_day ? `/labs/pals-hub?date=${String(rec.lab_day.date).slice(0, 10)}` : '/labs/pals-hub';

  return (
    <div className="w-full max-w-[3000px] mx-auto px-4 md:px-6 2xl:px-8 py-4 text-gray-900 dark:text-gray-100">
      <div className="print:hidden">
        <BreadcrumbNames
          customSegments={{ labs: 'Testing and certification', 'labs/pals': 'PALS Hub', 'labs/pals/attempt': '', [`labs/pals/attempt/${id}`]: 'Attempt record' }}
          customHrefs={{ labs: '/labs/aha-hub', 'labs/pals': hubHref }}
        />
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm text-blue-700 dark:text-blue-300 min-h-[44px]">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          {rec && !editing && (
            <button type="button" onClick={startEdit} className="inline-flex items-center gap-1 text-sm min-h-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600">
              <Pencil className="w-4 h-4" /> Edit result
            </button>
          )}
          {rec && (
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 text-sm min-h-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600">
              <Printer className="w-4 h-4" /> Print
            </button>
          )}
        </div>
      </div>
      {error && <div role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</div>}
      {!rec && !error && <Loader2 className="w-5 h-5 animate-spin" />}
      {rec && a && (
        <div className="space-y-4">
          {saveMsg && <div role="status" className="print:hidden text-sm text-emerald-700 dark:text-emerald-300">{saveMsg}</div>}
          {editing && (
            <section className="print:hidden rounded-xl border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 p-4 grid grid-cols-2 max-md:grid-cols-1 gap-3 text-sm">
              <div>
                <label className="block text-xs uppercase text-gray-500 mb-1" htmlFor="pe-result">Result</label>
                <select id="pe-result" value={form.result} onChange={e => setForm({ ...form, result: e.target.value })} className="w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2">
                  <option value="PASS">PASS</option><option value="NR">NR</option>
                </select>
                <label className="mt-3 flex items-center gap-2 min-h-[44px]">
                  <input type="checkbox" checked={form.watch && form.result === 'PASS'} disabled={form.result !== 'PASS'} onChange={e => setForm({ ...form, watch: e.target.checked })} className="w-5 h-5" />
                  Watch (pass, but keep an eye on this student)
                </label>
                <label className="block text-xs uppercase text-gray-500 mb-1" htmlFor="pe-wn">Watch note</label>
                <textarea id="pe-wn" rows={2} value={form.watch_note} disabled={!(form.watch && form.result === 'PASS')} onChange={e => setForm({ ...form, watch_note: e.target.value })} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2" />
              </div>
              <div>
                <label className="block text-xs uppercase text-gray-500 mb-1" htmlFor="pe-pn">Performance notes</label>
                <textarea id="pe-pn" rows={3} value={form.performance_notes} onChange={e => setForm({ ...form, performance_notes: e.target.value })} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2" />
                <label className="block text-xs uppercase text-gray-500 mb-1 mt-2" htmlFor="pe-rn">Remediation notes</label>
                <textarea id="pe-rn" rows={3} value={form.remediation_notes} onChange={e => setForm({ ...form, remediation_notes: e.target.value })} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2" />
              </div>
              <div className="col-span-2 max-md:col-span-1 flex gap-2 items-center">
                <button type="button" onClick={save} disabled={saving} className="min-h-[44px] px-4 rounded-lg bg-blue-600 text-white disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
                <button type="button" onClick={() => setEditing(false)} disabled={saving} className="min-h-[44px] px-4 rounded-lg border border-gray-300 dark:border-gray-600">Cancel</button>
                <span className="text-xs text-gray-500">Step results are not edited here. Who and when is recorded.</span>
              </div>
              {saveMsg && <div role="alert" className="col-span-2 text-red-700 dark:text-red-300">{saveMsg}</div>}
            </section>
          )}
          <header className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 grid grid-cols-3 max-md:grid-cols-1 gap-3">
            <div>
              <div className="text-xs uppercase text-gray-500">Case</div>
              <div className="font-semibold">{rec.scenario?.case_code ? `${rec.scenario.case_code} - ` : ''}{rec.scenario?.title ?? 'Unknown case'}</div>
              <div className="text-xs text-gray-500">{new Date(a.attempted_at).toLocaleString()}</div>
              <div className="text-xs text-gray-500">{[rec.lab_day?.section_label || rec.lab_day?.title, rec.station ? (rec.station.station_number ? `Station ${rec.station.station_number}` : rec.station.custom_title) : null].filter(Boolean).join(' - ')}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">Team</div>
              <div className="text-sm">{rec.group?.name ?? ''}</div>
              <div className="text-sm">Team lead: {rec.team_lead ? name(rec.team_lead) : 'not recorded'}</div>
              {rec.team_members.length > 0 && <div className="text-xs text-gray-500">{rec.team_members.map(name).join(', ')}</div>}
              <div className="text-xs text-gray-500">Graded by: {rec.grader?.name ?? 'not recorded'}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">Result</div>
              <span className={`inline-block px-2 py-0.5 rounded-full text-sm font-semibold uppercase ${pass ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>{pass ? 'PASS' : 'NR'}</span>
              {a.watch && <span className="ml-2 inline-block px-2 py-0.5 rounded-full text-sm font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">WATCH</span>}
              <div className="text-xs text-gray-500 mt-1">{notChecked} step{notChecked === 1 ? '' : 's'} not checked</div>
              {a.watch && a.watch_note && <div className="text-xs mt-1"><span className="uppercase text-gray-500">Watch note </span>{a.watch_note}</div>}
            </div>
          </header>

          <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <h2 className="font-semibold mb-2">Steps</h2>
            {rec.steps.length === 0 ? <p className="text-sm text-gray-500">No checklist steps on record.</p> : (
              <ul className="space-y-1">
                {rec.steps.map(s => (
                  <li key={s.id} className={`text-sm rounded px-2 py-1 ${s.state === 'not_checked' ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                    <div className="flex items-start gap-2">
                      {s.state === 'checked' ? <Check className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" aria-label="Checked" />
                        : s.state === 'not_checked' ? <X className="w-4 h-4 mt-0.5 text-red-600 shrink-0" aria-label="Not checked" />
                        : <Minus className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" aria-label={s.state === 'na' ? 'Not applicable' : 'Not recorded'} />}
                      <span className={s.state === 'not_checked' ? 'font-medium' : 'text-gray-700 dark:text-gray-200'}>{s.order}. {s.text}</span>
                      {s.state === 'na' && <span className="text-[10px] uppercase text-gray-500">N/A</span>}
                      {s.state === 'not_recorded' && <span className="text-[10px] uppercase text-gray-500">not recorded</span>}
                      {s.is_critical && <span className="text-[10px] uppercase text-red-700">critical</span>}
                    </div>
                    {s.note && <div className="ml-6 text-xs text-gray-600 dark:text-gray-400">Note: {s.note}</div>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {(a.performance_notes || a.remediation_notes) && (
            <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-2 text-sm">
              {a.performance_notes && <p className="whitespace-pre-wrap"><span className="text-xs uppercase text-gray-500">Performance notes </span>{a.performance_notes}</p>}
              {a.remediation_notes && <p className="whitespace-pre-wrap"><span className="text-xs uppercase text-gray-500">Remediation notes </span>{a.remediation_notes}</p>}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
