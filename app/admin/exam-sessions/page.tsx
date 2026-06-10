'use client';

/**
 * Exam Sessions — director console for written-exam self-scheduling.
 *
 * Create/edit sessions (date, time, total seats, Pima Lockdown computers,
 * proctor), work the phase-1 pending queue (approve/deny), and record exam
 * results (the narrow written_exam_passed/date write-back).
 *
 * Calendar model (Rae): every session goes on the MAIN shared calendar with
 * ONLY the proctor as attendee; the other directors get an email naming the
 * proctor instead of a calendar block. If the operator's Google Calendar is
 * lapsed the push is skipped and a reconnect prompt is shown — never silent.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays, CheckCircle2, Loader2, AlertTriangle, Plus, Trash2,
  XCircle, Hourglass, Monitor, Laptop, ClipboardCheck, ExternalLink,
} from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';

interface SignupRow {
  id: string;
  session_id: string;
  status: 'pending' | 'confirmed' | 'denied';
  uses_own_computer: boolean;
  created_at: string;
  student_email: string;
  student: {
    id: string; first_name: string; last_name: string; email: string;
    cohort: { cohort_number: number | null; current_semester: number | null } | null;
  } | null;
}

interface SessionRow {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  total_spots: number;
  pima_computers: number;
  status: string;
  notes: string | null;
  google_event_link: string | null;
  primary_instructor_id: string | null;
  proctor: { id: string; name: string; email: string } | null;
  total_used: number;
  pima_used: number;
  total_left: number;
  pima_left: number;
  signups: SignupRow[];
}

interface Candidate { id: string; name: string; email: string; role: string }

function fmtDate(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

const EMPTY_FORM = { date: '', start_time: '08:00', end_time: '12:00', total_spots: 10, pima_computers: 4, primary_instructor_id: '', notes: '' };

export default function AdminExamSessionsPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [calendarWarning, setCalendarWarning] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/exam-scheduling/sessions?admin=1');
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setSessions(json.sessions ?? []);
      setCandidates(json.proctorCandidates ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createSession() {
    setBusy(true);
    setNotice(null);
    setCalendarWarning(null);
    try {
      const res = await fetch('/api/exam-scheduling/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          primary_instructor_id: form.primary_instructor_id || null,
          total_spots: Number(form.total_spots),
          pima_computers: Number(form.pima_computers),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setNotice('Session created.');
      if (json.calendar && !json.calendar.pushed) setCalendarWarning(json.calendar.reason ?? 'Calendar event was not created.');
      setShowCreate(false);
      setForm({ ...EMPTY_FORM });
      load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function patchSession(id: string, patch: Record<string, unknown>) {
    setBusy(true);
    setCalendarWarning(null);
    try {
      const res = await fetch(`/api/exam-scheduling/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      if (json.calendar && !json.calendar.pushed) setCalendarWarning(json.calendar.reason ?? 'Calendar update failed.');
      load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function deleteSession(id: string) {
    if (!confirm('Delete this session? All signups on it will be removed.')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/exam-scheduling/sessions/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setNotice('Session deleted.');
      load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  async function decide(signupId: string, action: 'approve' | 'deny') {
    setBusy(true);
    try {
      const res = await fetch(`/api/exam-scheduling/signups/${signupId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Decision failed');
    } finally {
      setBusy(false);
    }
  }

  async function recordResult(signupId: string, passed: boolean) {
    if (!confirm(`Record the written exam as ${passed ? 'PASSED' : 'NOT passed'}? This writes written_exam_passed/date on the student's internship record.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/exam-scheduling/signups/${signupId}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passed }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setNotice(`Result recorded (${passed ? 'passed' : 'not passed'}).`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Result recording failed');
    } finally {
      setBusy(false);
    }
  }

  const pendingAll = sessions.flatMap(s => s.signups.filter(g => g.status === 'pending').map(g => ({ ...g, _session: s })));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Breadcrumbs className="mb-3 [&_*]:!text-blue-200 [&_a:hover]:!text-white" />
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg"><CalendarDays className="w-6 h-6" /></div>
              <div>
                <h1 className="text-2xl font-bold">Written Exam Sessions</h1>
                <p className="text-blue-200 text-sm mt-0.5">Build sessions, approve phase-1 signups, record results.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowCreate(v => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> New Session
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>}

        {error && !loading && (
          <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4 flex items-start gap-2 text-sm text-red-800 dark:text-red-300">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}
        {notice && (
          <div className="rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-800 dark:text-blue-300">{notice}</div>
        )}
        {calendarWarning && (
          <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span><strong>Calendar:</strong> {calendarWarning}</span>
          </div>
        )}

        {/* Create form */}
        {showCreate && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-5 space-y-3">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">New exam session</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs text-gray-600 dark:text-gray-300">Date
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="mt-1 w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </label>
              <label className="text-xs text-gray-600 dark:text-gray-300">Start
                <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                  className="mt-1 w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </label>
              <label className="text-xs text-gray-600 dark:text-gray-300">End
                <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                  className="mt-1 w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </label>
              <label className="text-xs text-gray-600 dark:text-gray-300">Total seats
                <input type="number" min={1} value={form.total_spots} onChange={e => setForm(f => ({ ...f, total_spots: Number(e.target.value) }))}
                  className="mt-1 w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
              </label>
              <label className="text-xs text-gray-600 dark:text-gray-300">Pima Lockdown computers
                <input type="number" min={0} value={form.pima_computers} onChange={e => setForm(f => ({ ...f, pima_computers: Number(e.target.value) }))}
                  className="mt-1 w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
                <span className="text-[10px] text-gray-400">~4 on a normal day; higher on reserved computer-lab days</span>
              </label>
              <label className="text-xs text-gray-600 dark:text-gray-300">Proctor (primary instructor)
                <select value={form.primary_instructor_id} onChange={e => setForm(f => ({ ...f, primary_instructor_id: e.target.value }))}
                  className="mt-1 w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                  <option value="">— pick later —</option>
                  {candidates.map(c => <option key={c.id} value={c.id}>{c.name} ({c.role})</option>)}
                </select>
                <span className="text-[10px] text-gray-400">Only the proctor gets the calendar invite; other directors get an email heads-up</span>
              </label>
            </div>
            <label className="block text-xs text-gray-600 dark:text-gray-300">Notes (optional)
              <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Reserved computer lab — extra Pima machines"
                className="mt-1 w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
              <button type="button" onClick={createSession} disabled={busy || !form.date}
                className="inline-flex items-center gap-2 px-4 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Create
              </button>
            </div>
          </div>
        )}

        {/* Pending queue */}
        {pendingAll.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-amber-300 dark:border-amber-700 overflow-hidden">
            <div className="px-5 py-3 bg-amber-50 dark:bg-amber-900/20 flex items-center gap-2">
              <Hourglass className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h2 className="font-semibold text-amber-900 dark:text-amber-200 text-sm">Pending approval ({pendingAll.length}) — phase-1 signups</h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {pendingAll.map(p => (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="text-sm">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {p.student ? `${p.student.first_name} ${p.student.last_name}` : p.student_email}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2">
                      {fmtDate(p._session.date)} · {p.uses_own_computer ? 'own computer' : 'needs Pima computer'}
                      {p.student?.cohort ? ` · Cohort ${p.student.cohort.cohort_number} (S${p.student.cohort.current_semester ?? '?'})` : ''}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={busy} onClick={() => decide(p.id, 'approve')}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button type="button" disabled={busy} onClick={() => decide(p.id, 'deny')}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                      <XCircle className="w-3.5 h-3.5" /> Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sessions */}
        {!loading && sessions.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">No sessions yet — create the first one.</p>
        )}
        {sessions.map(s => (
          <div key={s.id} className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2 border-b border-gray-100 dark:border-gray-700">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{fmtDate(s.date)}</h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</span>
                  <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${s.status === 'open' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                    {s.status}
                  </span>
                  {s.google_event_link && (
                    <a href={s.google_event_link} target="_blank" rel="noreferrer" className="text-xs text-blue-600 dark:text-blue-400 inline-flex items-center gap-0.5 hover:underline">
                      calendar <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {s.total_used}/{s.total_spots} seats · {s.pima_used}/{s.pima_computers} Pima computers
                  {s.proctor ? <> · Proctor: <strong>{s.proctor.name}</strong></> : ' · no proctor assigned'}
                  {s.notes ? ` · ${s.notes}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={s.primary_instructor_id ?? ''}
                  disabled={busy}
                  onChange={e => patchSession(s.id, { primary_instructor_id: e.target.value || null })}
                  className="px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                  title="Proctor"
                >
                  <option value="">proctor…</option>
                  {candidates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" disabled={busy}
                  onClick={() => patchSession(s.id, { status: s.status === 'open' ? 'closed' : 'open' })}
                  className="px-3 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                  {s.status === 'open' ? 'Close signups' : 'Reopen'}
                </button>
                <button type="button" disabled={busy} onClick={() => deleteSession(s.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500" aria-label="Delete session">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {s.signups.length > 0 ? (
              <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {s.signups.map(g => (
                  <div key={g.id} className="px-5 py-2 flex items-center justify-between flex-wrap gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      {g.status === 'confirmed' ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                        : g.status === 'pending' ? <Hourglass className="w-4 h-4 text-amber-500" />
                        : <XCircle className="w-4 h-4 text-gray-400" />}
                      <span className="text-gray-900 dark:text-gray-100">
                        {g.student ? `${g.student.first_name} ${g.student.last_name}` : g.student_email}
                      </span>
                      <span className="text-gray-400 inline-flex items-center gap-1 text-xs">
                        {g.uses_own_computer ? <><Laptop className="w-3 h-3" /> own</> : <><Monitor className="w-3 h-3" /> Pima</>}
                      </span>
                      {g.status === 'denied' && <span className="text-xs text-gray-400">(denied)</span>}
                    </div>
                    {g.status === 'confirmed' && (
                      <div className="flex gap-1">
                        <button type="button" disabled={busy} onClick={() => recordResult(g.id, true)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                          title="Record written exam result: passed">
                          <ClipboardCheck className="w-3 h-3" /> Passed
                        </button>
                        <button type="button" disabled={busy} onClick={() => recordResult(g.id, false)}
                          className="px-2 py-0.5 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          title="Record written exam result: not passed">
                          Not passed
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-5 py-3 text-xs text-gray-400">No signups yet.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
