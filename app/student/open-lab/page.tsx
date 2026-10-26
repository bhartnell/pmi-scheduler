'use client';

/**
 * Student Open lab (STUDENT VIEW 5b). Lists only sessions designated open lab
 * (the open_lab_sessions module); scheduled lab days never appear here.
 * Sign up / remove reuse the existing /api/open-lab/signup routes.
 */

import { useCallback, useEffect, useState } from 'react';
import { Calendar, Clock, Loader2, CheckCircle } from 'lucide-react';
import { parseDateSafe } from '@/lib/utils';

interface Session {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
}

interface MySignup {
  id: string;
  session_id: string;
  program_level: string;
  what_to_work_on: string;
  edit_token: string;
}

interface Me {
  name: string;
  email: string;
  programLevel: string | null;
}

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export default function StudentOpenLabPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [mine, setMine] = useState<MySignup[]>([]);
  const [canWrite, setCanWrite] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [level, setLevel] = useState('');
  const [workOn, setWorkOn] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/student/open-lab');
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setMe(json.student);
      setSessions(json.sessions ?? []);
      setMine(json.mySignups ?? []);
      setCanWrite(json.canWrite !== false);
      if (json.student?.programLevel) setLevel((l) => l || json.student.programLevel);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function signUp(sessionId: string) {
    if (!me || !level || !workOn.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch('/api/open-lab/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          student_name: me.name,
          student_email: me.email,
          program_level: level,
          what_to_work_on: workOn.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Sign up failed');
      setNotice("You're in. See you there.");
      setPicking(null);
      setWorkOn('');
      load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Sign up failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove(signup: MySignup) {
    if (!confirm('Remove yourself from this open lab session?')) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/open-lab/signup/${signup.edit_token}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not remove signup');
      setNotice('You were removed from that session.');
      load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not remove signup');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-cyan-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-[clamp(16px,2.75vw,96px)] py-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Open lab</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Drop-in practice sessions. Sign up for the ones you want to attend.
      </p>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">{error}</div>}
      {notice && <div className="mb-4 p-3 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 text-cyan-800 dark:text-cyan-200 text-sm">{notice}</div>}
      {!canWrite && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm">
          Viewing as a student: sign up is read-only.
        </div>
      )}
      {!me && !error && (
        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400">
          Your student record was not found. Please contact your instructor.
        </div>
      )}

      {me && sessions.length === 0 && !error && (
        <div className="p-4 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400">
          No open lab sessions are scheduled right now.
        </div>
      )}

      <div className="grid grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-1 gap-4">
        {me && sessions.map((s) => {
          const signup = mine.find((m) => m.session_id === s.id);
          const open = picking === s.id;
          return (
            <div key={s.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                <Calendar className="w-4 h-4 text-cyan-600" />
                {parseDateSafe(s.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
                <Clock className="w-4 h-4" />
                {fmtTime(s.start_time)} - {fmtTime(s.end_time)}
              </div>
              {s.notes && <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{s.notes}</p>}

              {signup ? (
                <div className="mt-3">
                  <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                    <CheckCircle className="w-4 h-4" /> You&apos;re signed up
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Working on: {signup.what_to_work_on}</p>
                  <button
                    onClick={() => remove(signup)}
                    disabled={busy || !canWrite}
                    className="mt-2 min-h-[44px] px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    Remove me
                  </button>
                </div>
              ) : open ? (
                <div className="mt-3 space-y-2">
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                  >
                    <option value="">Program level</option>
                    {['EMT', 'AEMT', 'Paramedic'].map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <textarea
                    value={workOn}
                    onChange={(e) => setWorkOn(e.target.value)}
                    rows={3}
                    placeholder="What do you want to work on?"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => signUp(s.id)}
                      disabled={busy || !canWrite || !level || !workOn.trim()}
                      className="min-h-[44px] px-4 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700 disabled:opacity-50"
                    >
                      Confirm sign up
                    </button>
                    <button
                      onClick={() => setPicking(null)}
                      className="min-h-[44px] px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setPicking(s.id); setNotice(null); }}
                  disabled={!canWrite}
                  className="mt-3 min-h-[44px] px-4 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700 disabled:opacity-50"
                >
                  Sign up
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
