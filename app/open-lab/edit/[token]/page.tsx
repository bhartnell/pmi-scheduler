'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2,
  AlertTriangle,
  CheckCircle,
  Trash2,
  Save,
  Calendar,
  XCircle,
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
  signup_count: number;
}

interface Instructor {
  id: string;
  name: string;
}

interface SignupData {
  id: string;
  session_id: string;
  student_name: string;
  student_email: string;
  program_level: string;
  what_to_work_on: string;
  requested_instructor_id: string | null;
  session: {
    id: string;
    date: string;
  };
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EditSignupPage() {
  const params = useParams();
  const token = params.token as string;

  const [signup, setSignup] = useState<SignupData | null>(null);
  const [sessions, setSessions] = useState<OpenLabSession[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cancelled, setCancelled] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Form state
  const [sessionId, setSessionId] = useState('');
  const [whatToWorkOn, setWhatToWorkOn] = useState('');
  const [programLevel, setProgramLevel] = useState('');
  const [requestedInstructorId, setRequestedInstructorId] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [signupRes, sessRes, instRes] = await Promise.all([
          fetch(`/api/open-lab/signup/${token}`),
          fetch('/api/open-lab/sessions'),
          fetch('/api/open-lab/instructors'),
        ]);

        if (!signupRes.ok) {
          if (signupRes.status === 404) {
            setNotFound(true);
          } else {
            setError('Failed to load your signup.');
          }
          setLoading(false);
          return;
        }

        const signupData = await signupRes.json();
        const s = signupData.signup || signupData;
        setSignup(s);
        setSessionId(s.session_id);
        setWhatToWorkOn(s.what_to_work_on || '');
        setProgramLevel(s.program_level || '');
        setRequestedInstructorId(s.requested_instructor_id || '');

        if (sessRes.ok) {
          const data = await sessRes.json();
          setSessions(
            (data.sessions || data || []).filter((sess: OpenLabSession) => !sess.is_cancelled)
          );
        }
        if (instRes.ok) {
          const data = await instRes.json();
          setInstructors(data.instructors || data || []);
        }
      } catch {
        setError('Failed to load data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchData();
  }, [token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/open-lab/signup/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          program_level: programLevel,
          what_to_work_on: whatToWorkOn,
          requested_instructor_id: requestedInstructorId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save changes.');
      }

      setSuccess('Your changes have been saved.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    setSaving(true);
    setError('');

    try {
      const res = await fetch(`/api/open-lab/signup/${token}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to cancel signup.');
      }

      setCancelled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
      setShowCancelConfirm(false);
    }
  };

  // ---- Cancelled confirmation ----
  if (cancelled) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white dark:from-gray-900 dark:to-gray-950">
        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-8 h-8 text-gray-500 dark:text-gray-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Your signup has been cancelled
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              You can sign up again anytime at the{' '}
              <a href="/open-lab" className="text-emerald-600 dark:text-emerald-400 underline">
                Open Lab page
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---- Not found ----
  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white dark:from-gray-900 dark:to-gray-950">
        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Signup not found
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              This link may be invalid or the signup may have already been cancelled.
            </p>
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

  // ---- Edit form ----
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white dark:from-gray-900 dark:to-gray-950">
      <div className="max-w-xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            Edit Your Signup
          </h1>
          {signup && (
            <p className="text-gray-600 dark:text-gray-400">
              Currently signed up for{' '}
              <span className="font-medium">
                {formatSessionDate(signup.session.date)}
              </span>
            </p>
          )}
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-700 dark:text-emerald-300">{success}</p>
          </div>
        )}

        <form
          onSubmit={handleSave}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-5"
        >
          {/* Change date */}
          <div>
            <label
              htmlFor="sessionDate"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              <Calendar className="w-4 h-4 inline mr-1" />
              Session Date
            </label>
            <select
              id="sessionDate"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
            >
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {formatSessionDate(session.date)}
                </option>
              ))}
            </select>
          </div>

          {/* Program Level */}
          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Program Level
            </legend>
            <div className="flex flex-wrap gap-3">
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
              What would you like to work on?
            </label>
            <textarea
              id="whatToWorkOn"
              rows={3}
              value={whatToWorkOn}
              onChange={(e) => setWhatToWorkOn(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors resize-y"
            />
          </div>

          {/* Requested instructor */}
          <div>
            <label
              htmlFor="instructor"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Requested Instructor
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
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Changes
            </button>
            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              className="py-2.5 px-4 bg-white dark:bg-gray-700 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Cancel Signup
            </button>
          </div>
        </form>

        {/* Cancel confirmation dialog */}
        {showCancelConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm w-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Cancel signup?
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                This will remove your signup. You can always sign up again later.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 py-2 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                >
                  Keep Signup
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Yes, Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
