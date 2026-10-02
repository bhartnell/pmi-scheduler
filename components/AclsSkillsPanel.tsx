'use client';

/**
 * ACLS skills-station capture (Airway Management, Adult BLS, Peds BLS).
 * Attestation-level pass/fail/remediated per student per skill, stored in
 * pals_skill_completions via /api/adv-cert/skill-completions. The sheet opens
 * with everyone defaulted to pass; fail/remediated is one click and requires a
 * note; the whole sheet saves in one action (verifier/initials recorded by the API). Never blocks anything else on the hub.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';

interface Member { id: string; first_name: string; last_name: string }
type Status = 'pass' | 'fail' | 'remediated';
interface Completion { student_id: string; skill_key: string; status: Status; remediation_notes: string | null }

const SKILLS = [
  { key: 'airway_management', label: 'Airway Management' },
  { key: 'adult_bls', label: 'Adult BLS' },
  { key: 'peds_bls', label: 'Peds BLS' },
];

export default function AclsSkillsPanel({ groups }: { groups: { id: string; name: string; members: Member[] }[] }) {
  const [skill, setSkill] = useState(SKILLS[0].key);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<string, Record<string, Status>>>({});
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const students = useMemo(() => groups.flatMap((g) => g.members.map((m) => ({ ...m, group: g.name }))), [groups]);
  const idsKey = students.map((s) => s.id).join(',');

  const load = useCallback(async () => {
    if (!idsKey) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/adv-cert/skill-completions?certCourse=acls&studentIds=${idsKey}`);
      const json = await res.json();
      if (json.success) setCompletions(json.completions);
      else setError(json.error || 'Failed to load');
    } catch { setError('Failed to load'); } finally { setLoading(false); }
  }, [idsKey]);
  useEffect(() => { load(); }, [load]);

  const byStudent = useMemo(() => {
    const m = new Map<string, Completion>();
    for (const c of completions) if (c.skill_key === skill) m.set(c.student_id, c);
    return m;
  }, [completions, skill]);

  // Sheet opens complete: every student without a saved row defaults to pass in the UI only.
  // Nothing is written until the sheet is saved by an instructor (verifier = signed-in user).
  const statusOf = (studentId: string): Status =>
    draft[skill]?.[studentId] ?? byStudent.get(studentId)?.status ?? 'pass';

  const setStatus = (studentId: string, status: Status) => {
    setError(null);
    setDraft((d) => ({ ...d, [skill]: { ...d[skill], [studentId]: status } }));
  };

  const pending = students.filter((s) => !byStudent.has(s.id) || statusOf(s.id) !== byStudent.get(s.id)?.status
    || (statusOf(s.id) !== 'pass' && (notes[s.id] ?? '') !== (byStudent.get(s.id)?.remediation_notes ?? (notes[s.id] ?? ''))));

  const saveSheet = async () => {
    const marks = students.map((s) => ({
      studentId: s.id,
      status: statusOf(s.id),
      remediationNotes: notes[s.id] ?? byStudent.get(s.id)?.remediation_notes ?? '',
    }));
    const missing = marks.find((m) => m.status !== 'pass' && !m.remediationNotes.trim());
    if (missing) { setError('Enter a note for every fail / remediated student.'); return; }
    setError(null); setSaving(true);
    try {
      const res = await fetch('/api/adv-cert/skill-completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certCourse: 'acls', skillKey: skill, marks }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error || 'Save failed'); return; }
      setCompletions((prev) => [...prev.filter((c) => c.skill_key !== skill), ...json.completions]);
      setDraft((d) => ({ ...d, [skill]: {} }));
    } catch { setError('Save failed'); } finally { setSaving(false); }
  };

  const done = students.filter((s) => byStudent.has(s.id)).length;

  return (
    <section className="print:hidden">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Skills stations — capture</h2>
      <div className="flex flex-wrap gap-2 mb-2">
        {SKILLS.map((s) => (
          <button key={s.key} onClick={() => setSkill(s.key)}
            className={`px-3 min-h-[44px] rounded-lg text-sm border ${skill === s.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'}`}>
            {s.label}
          </button>
        ))}
        <span className="self-center text-xs text-gray-500">{done} / {students.length} recorded</span>
        <button onClick={saveSheet} disabled={saving || !students.length}
          className="ml-auto px-4 min-h-[44px] rounded-lg text-sm bg-green-600 text-white disabled:opacity-50 flex items-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {pending.length ? `Save sheet (${pending.length} unsaved)` : 'Sheet saved'}
        </button>
      </div>
      {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
      {loading ? <Loader2 className="animate-spin text-gray-400" /> : (
        <div className="grid grid-cols-2 max-md:grid-cols-1 gap-2">
          {students.map((s) => {
            const c = byStudent.get(s.id);
            const st = statusOf(s.id);
            return (
              <div key={s.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.last_name}, {s.first_name} <span className="text-[10px] text-gray-400">{s.group}</span></div>
                  <input value={notes[s.id] ?? c?.remediation_notes ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                    placeholder="Note (required for fail / remediated)"
                    className="mt-1 w-full text-xs px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600" />
                </div>
                <div className="flex gap-1">
                  <button title="Pass" onClick={() => setStatus(s.id, 'pass')} className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded ${st === 'pass' ? 'bg-green-100 dark:bg-green-900/40' : ''}`}><CheckCircle2 className="w-5 h-5 text-green-600" /></button>
                  <button title="Fail" onClick={() => setStatus(s.id, 'fail')} className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded ${st === 'fail' ? 'bg-red-100 dark:bg-red-900/40' : ''}`}><XCircle className="w-5 h-5 text-red-600" /></button>
                  <button title="Remediated" onClick={() => setStatus(s.id, 'remediated')} className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded ${st === 'remediated' ? 'bg-amber-100 dark:bg-amber-900/40' : ''}`}><RotateCcw className="w-5 h-5 text-amber-600" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
