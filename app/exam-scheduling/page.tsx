'use client';

/**
 * Final Written Exam — student self-scheduling.
 *
 * Roster-scoped (email ↔ students table), NOT role-scoped: a student whose
 * lab_users role is 'instructor' (teaching a class) still signs up here as a
 * student, and nothing on this page exposes instructor/admin surfaces.
 *
 * Flow: see open sessions with live seat counts → pick one → answer the
 * LockDown Browser acknowledgement (own computer vs Pima computer; the Pima
 * option closes when those seats fill) → phase-2 confirms instantly,
 * phase-1 lands pending for director approval. One slot per student;
 * reschedule is free and unlimited (releases the old seat).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays, CheckCircle2, Clock, Laptop, Loader2, AlertTriangle,
  Monitor, XCircle, RefreshCw, Hourglass,
} from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';

interface SessionRow {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  total_spots: number;
  pima_computers: number;
  status: string;
  notes: string | null;
  total_used: number;
  pima_used: number;
  total_left: number;
  pima_left: number;
}

interface MySignup {
  id: string;
  session_id: string;
  status: 'pending' | 'confirmed' | 'denied';
  uses_own_computer: boolean;
  session: SessionRow | null;
}

interface MeResponse {
  success: boolean;
  student: { id: string; name: string; isPhase2: boolean; willAutoConfirm: boolean; current_semester: number | null; program: string | null } | null;
  signup: MySignup | null;
  blocked?: string;
  isAdmin?: boolean;
}

function fmtDate(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}
function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export default function ExamSchedulingPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<SessionRow | null>(null); // session being signed up for / moved to
  const [usesOwn, setUsesOwn] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [meRes, sessRes] = await Promise.all([
        fetch('/api/exam-scheduling/signups'),
        fetch('/api/exam-scheduling/sessions'),
      ]);
      const meJson = await meRes.json();
      const sessJson = await sessRes.json();
      if (!meRes.ok || !meJson.success) throw new Error(meJson.error || `HTTP ${meRes.status}`);
      if (!sessRes.ok || !sessJson.success) throw new Error(sessJson.error || `HTTP ${sessRes.status}`);
      setMe(meJson);
      setSessions(sessJson.sessions ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submitPick() {
    if (!picking || usesOwn === null) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const isReschedule = !!me?.signup;
      const res = await fetch(
        isReschedule ? `/api/exam-scheduling/signups/${me!.signup!.id}` : '/api/exam-scheduling/signups',
        {
          method: isReschedule ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: picking.id, uses_own_computer: usesOwn }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setNotice(
        isReschedule
          ? 'Your slot has been moved.'
          : json.autoConfirmed
            ? 'You\'re confirmed! Check your email for details.'
            : 'Signup received — pending director approval. You\'ll get an email when it\'s decided.',
      );
      setPicking(null);
      setUsesOwn(null);
      load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelSignup() {
    if (!me?.signup) return;
    if (!confirm('Cancel your exam slot? Your seat will be released.')) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/exam-scheduling/signups/${me.signup.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setNotice('Your slot was cancelled.');
      load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setSubmitting(false);
    }
  }

  const openSessions = sessions.filter(s => s.status === 'open');
  const mySession = me?.signup?.session ?? null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Breadcrumbs className="mb-3 [&_*]:!text-blue-200 [&_a:hover]:!text-white" />
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg"><CalendarDays className="w-6 h-6" /></div>
            <div>
              <h1 className="text-2xl font-bold">Final Written Exam — Self-Scheduling</h1>
              <p className="text-blue-200 text-sm mt-0.5">Pick a session, tell us about your computer, you&apos;re set.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4 flex items-start gap-2 text-sm text-red-800 dark:text-red-300">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Unlinked account — explicit blocked state, never silent. Staff
            get routed to the ADMIN door instead of a dead-end. */}
        {!loading && me?.blocked && (
          <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-5 text-sm text-amber-900 dark:text-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">{me.isAdmin ? 'This is the student page' : 'Account not linked'}</p>
              <p>{me.blocked}</p>
              {me.isAdmin && (
                <a
                  href="/admin/exam-sessions"
                  className="inline-flex items-center gap-1 mt-3 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
                >
                  <CalendarDays className="w-4 h-4" /> Manage Exam Sessions
                </a>
              )}
            </div>
          </div>
        )}

        {notice && (
          <div className="rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-800 dark:text-blue-300">
            {notice}
          </div>
        )}

        {!loading && me?.student && (
          <>
            {/* Phase banner */}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Signed in as <strong>{me.student.name}</strong>
              {me.student.willAutoConfirm
                ? ' — phase 2: your signup confirms instantly.'
                : ' — signups require director approval before they\'re confirmed.'}
            </p>

            {/* Current slot */}
            {me.signup && mySession && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="font-semibold text-gray-900 dark:text-gray-100">Your exam slot</h2>
                      {me.signup.status === 'confirmed' ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                          <CheckCircle2 className="w-3 h-3" /> Confirmed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                          <Hourglass className="w-3 h-3" /> Pending approval
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{fmtDate(mySession.date)}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {fmtTime(mySession.start_time)} – {fmtTime(mySession.end_time)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                      {me.signup.uses_own_computer
                        ? <><Laptop className="w-3.5 h-3.5" /> Bringing my own computer (LockDown Browser installed)</>
                        : <><Monitor className="w-3.5 h-3.5" /> Using a Pima Lockdown computer</>}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={cancelSignup}
                      disabled={submitting}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <XCircle className="w-4 h-4" /> Cancel
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Need a different day? Pick any open session below — rescheduling is free.
                </p>
              </div>
            )}

            {/* Session list */}
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 pt-1">
              {me.signup ? 'Move to a different session' : 'Open sessions'}
            </h2>
            {openSessions.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No sessions are open for signup right now. Check back later, or contact your program director.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {openSessions.map(s => {
                const isMine = me.signup?.session_id === s.id;
                const full = s.total_left <= 0;
                return (
                  <div
                    key={s.id}
                    className={`bg-white dark:bg-gray-800 rounded-xl border p-4 ${isMine ? 'border-blue-400 dark:border-blue-600 ring-1 ring-blue-300 dark:ring-blue-700' : 'border-gray-200 dark:border-gray-700'}`}
                  >
                    <p className="font-medium text-gray-900 dark:text-gray-100">{fmtDate(s.date)}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-600 dark:text-gray-300">
                      <span>{s.total_left} of {s.total_spots} seats left</span>
                      <span className="inline-flex items-center gap-1">
                        <Monitor className="w-3 h-3" /> {s.pima_left} Pima computer{s.pima_left === 1 ? '' : 's'} left
                      </span>
                    </div>
                    {s.notes && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{s.notes}</p>}
                    <button
                      type="button"
                      disabled={full || isMine || submitting}
                      onClick={() => { setPicking(s); setUsesOwn(null); setNotice(null); }}
                      className="mt-3 w-full px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isMine ? 'Your current slot' : full ? 'Full' : me.signup ? 'Move here' : 'Sign up'}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Lockdown acknowledgement modal */}
      {picking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {fmtDate(picking.date)} · {fmtTime(picking.start_time)}–{fmtTime(picking.end_time)}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              The written exam runs in <strong>LockDown Browser</strong>. Which computer will you use?
            </p>
            <div className="space-y-2">
              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${usesOwn === true ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                <input type="radio" name="computer" className="mt-1" checked={usesOwn === true} onChange={() => setUsesOwn(true)} />
                <span className="text-sm text-gray-800 dark:text-gray-200">
                  <Laptop className="w-4 h-4 inline mr-1" />
                  <strong>I&apos;ll bring my own computer</strong> and install LockDown Browser before exam day.
                </span>
              </label>
              <label className={`flex items-start gap-3 p-3 rounded-lg border ${picking.pima_left <= 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${usesOwn === false ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                <input type="radio" name="computer" className="mt-1" disabled={picking.pima_left <= 0} checked={usesOwn === false} onChange={() => setUsesOwn(false)} />
                <span className="text-sm text-gray-800 dark:text-gray-200">
                  <Monitor className="w-4 h-4 inline mr-1" />
                  <strong>I need a Pima computer</strong> with LockDown Browser.
                  {picking.pima_left <= 0 && <em className="block text-xs text-red-500 mt-0.5">All Pima computers for this session are taken.</em>}
                </span>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => { setPicking(null); setUsesOwn(null); }}
                disabled={submitting}
                className="px-3 py-1.5 text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Back
              </button>
              <button
                type="button"
                onClick={submitPick}
                disabled={usesOwn === null || submitting}
                className="inline-flex items-center gap-2 px-4 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {me?.signup ? 'Move my slot' : me?.student?.willAutoConfirm ? 'Confirm signup' : 'Request slot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
