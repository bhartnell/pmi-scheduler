'use client';

/**
 * ACLS skills-station capture (Airway Management, Adult BLS, Peds BLS).
 * Attestation-level pass/fail/remediated per student per skill, stored in
 * pals_skill_completions via /api/adv-cert/skill-completions. Fail/remediated
 * requires a note. Never blocks anything else on the hub.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';

interface Member { id: string; first_name: string; last_name: string }
interface Completion { student_id: string; skill_key: string; status: 'pass' | 'fail' | 'remediated'; remediation_notes: string | null }

const SKILLS = [
  { key: 'airway_management', label: 'Airway Management' },
  { key: 'adult_bls', label: 'Adult BLS' },
  { key: 'peds_bls', label: 'Peds BLS' },
];

export default function AclsSkillsPanel({ groups }: { groups: { id: string; name: string; members: Member[] }[] }) {
  const [skill, setSkill] = useState(SKILLS[0].key);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
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

  const mark = async (studentId: string, status: 'pass' | 'fail' | 'remediated') => {
    const remediationNotes = notes[studentId] || '';
    if (status !== 'pass' && !remediationNotes.trim()) { setError('Enter a note for fail / remediated.'); return; }
    setError(null); setSaving(studentId);
    try {
      const res = await fetch('/api/adv-cert/skill-completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certCourse: 'acls', skillKey: skill, marks: [{ studentId, status, remediationNotes }] }),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error || 'Save failed'); return; }
      setCompletions((prev) => [...prev.filter((c) => !(c.student_id === studentId && c.skill_key === skill)), ...json.completions]);
    } catch { setError('Save failed'); } finally { setSaving(null); }
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
      </div>
      {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
      {loading ? <Loader2 className="animate-spin text-gray-400" /> : (
        <div className="grid grid-cols-2 max-md:grid-cols-1 gap-2">
          {students.map((s) => {
            const c = byStudent.get(s.id);
            return (
              <div key={s.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.last_name}, {s.first_name} <span className="text-[10px] text-gray-400">{s.group}</span></div>
                  <input value={notes[s.id] ?? c?.remediation_notes ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                    placeholder="Note (required for fail / remediated)"
                    className="mt-1 w-full text-xs px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600" />
                </div>
                {saving === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <div className="flex gap-1">
                    <button title="Pass" onClick={() => mark(s.id, 'pass')} className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded ${c?.status === 'pass' ? 'bg-green-100 dark:bg-green-900/40' : ''}`}><CheckCircle2 className="w-5 h-5 text-green-600" /></button>
                    <button title="Fail" onClick={() => mark(s.id, 'fail')} className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded ${c?.status === 'fail' ? 'bg-red-100 dark:bg-red-900/40' : ''}`}><XCircle className="w-5 h-5 text-red-600" /></button>
                    <button title="Remediated" onClick={() => mark(s.id, 'remediated')} className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded ${c?.status === 'remediated' ? 'bg-amber-100 dark:bg-amber-900/40' : ''}`}><RotateCcw className="w-5 h-5 text-amber-600" /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
