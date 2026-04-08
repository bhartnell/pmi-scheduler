'use client';

import { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Users,
  CheckCircle,
  Copy,
  Loader2,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OpenLabSession {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_cancelled: boolean;
  cancellation_reason: string | null;
  signup_count: number;
}

interface Instructor {
  id: string;
  name: string;
}

interface SignupResult {
  edit_token: string;
  session_date: string; // date string from the session
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSessionDate(dateStr: string): string {
  const safe = dateStr.includes('T') || dateStr.includes(' ') ? dateStr : dateStr + 'T12:00:00';
  return new Date(safe).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatShortDate(dateStr: string): string {
  const safe = dateStr.includes('T') || dateStr.includes(' ') ? dateStr : dateStr + 'T12:00:00';
  return new Date(safe).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OpenLabSignupPage() {
  const [sessions, setSessions] = useState<OpenLabSession[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<OpenLabSession | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<SignupResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [programLevel, setProgramLevel] = useState('');
  const [whatToWorkOn, setWhatToWorkOn] = useState('');
  const [requestedInstructorId, setRequestedInstructorId] = useState('');

  // Fetch sessions and instructors on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sessRes, instRes] = await Promise.all([
          fetch('/api/open-lab/sessions'),
          fetch('/api/open-lab/instructors'),
        ]);

        if (sessRes.ok) {
          const data = await sessRes.json();
          setSessions((data.sessions || data || []).filter((s: OpenLabSession) => !s.is_cancelled));
        }
        if (instRes.ok) {
          const data = await instRes.json();
          setInstructors(data.instructors || data || []);
        }
      } catch {
        setError('Failed to load session data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/open-lab/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: selectedSession.id,
          student_name: fullName,
          student_email: email,
          program_level: programLevel,
          what_to_work_on: whatToWorkOn,
          requested_instructor_id: requestedInstructorId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to sign up. Please try again.');
      }

      const data = await res.json();
      setConfirmation({
        edit_token: data.signup?.edit_token || data.edit_token,
        session_date: selectedSession.date,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const editUrl =
    confirmation && typeof window !== 'undefined'
      ? `${window.location.origin}/open-lab/edit/${confirmation.edit_token}`
      : '';

  const handleCopyLink = async () => {
    if (!editUrl) return;
    try {
      await navigator.clipboard.writeText(editUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select input text
    }
  };

  // ---- Confirmation screen ----
  if (confirmation) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white dark:from-gray-900 dark:to-gray-950">
        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              You&apos;re signed up!
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              You&apos;re signed up for{' '}
              <span className="font-semibold">{formatSessionDate(confirmation.session_date)}</span>!
              We&apos;ll see you Wednesday from 1&ndash;4 PM.
            </p>

            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-left">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Need to change or cancel? Save this link:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={editUrl}
                  className="flex-1 text-xs font-mono bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-gray-700 dark:text-gray-300"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Loading ----
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white dark:from-gray-900 dark:to-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  // ---- Main page ----
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white dark:from-gray-900 dark:to-gray-950">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            PMI Open Lab Sign-Up
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Drop-in practice sessions every Wednesday 1:00&ndash;4:00 PM
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Session cards */}
        {sessions.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">
              No upcoming open lab sessions available.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Check back later for new sessions.
            </p>
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Choose a date
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {sessions.map((session) => {
                const isSelected = selectedSession?.id === session.id;
                return (
                  <button
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-md'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {formatSessionDate(session.date)}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            1:00 &ndash; 4:00 PM
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {session.signup_count} signed up
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Signup form */}
        {selectedSession && (
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-5"
          >
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 mb-2">
              <ChevronRight className="w-4 h-4" />
              <h2 className="text-lg font-semibold">
                Sign up for {formatShortDate(selectedSession.date)}
              </h2>
            </div>

            {/* Full Name */}
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                placeholder="Jane Doe"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                placeholder="jdoe@my.pmi.edu"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Use your my.pmi.edu email to link to your student account
              </p>
            </div>

            {/* Program Level */}
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Program Level <span className="text-red-500">*</span>
              </legend>
              <div className="flex flex-wrap gap-4">
                {['EMT', 'AEMT', 'Paramedic'].map((level) => (
                  <label
                    key={level}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                      programLevel === level
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="programLevel"
                      value={level}
                      checked={programLevel === level}
                      onChange={(e) => setProgramLevel(e.target.value)}
                      required
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        programLevel === level
                          ? 'border-emerald-500'
                          : 'border-gray-400 dark:border-gray-500'
                      }`}
                    >
                      {programLevel === level && (
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      )}
                    </div>
                    {level}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* What to work on */}
            <div>
              <label
                htmlFor="whatToWorkOn"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                What would you like to work on? <span className="text-red-500">*</span>
              </label>
              <textarea
                id="whatToWorkOn"
                required
                rows={3}
                value={whatToWorkOn}
                onChange={(e) => setWhatToWorkOn(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors resize-y"
                placeholder="e.g., IV skills, cardiac assessment, airway management..."
              />
            </div>

            {/* Request an instructor */}
            <div>
              <label
                htmlFor="instructor"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Request an Instructor (optional)
              </label>
              <select
                id="instructor"
                value={requestedInstructorId}
                onChange={(e) => setRequestedInstructorId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
              >
                <option value="">No preference</option>
                {instructors.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>
              <div className="mt-2 flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Requesting an instructor does not guarantee their availability. If you require a
                  specific instructor, please schedule Office Hours instead.
                </p>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing up...
                </>
              ) : (
                'Sign Me Up'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
