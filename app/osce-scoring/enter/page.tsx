'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface EvaluatorOption {
  id: string;
  name: string;
  label: string;
  role: string;
  source: 'observer' | 'faculty';
}

interface EventInfo {
  id: string;
  title: string;
  subtitle: string | null;
  start_date: string;
  end_date: string;
}

function EnterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // PIN flow state
  const [pin, setPin] = useState('');
  const [pinValidated, setPinValidated] = useState(false);
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  const [evaluators, setEvaluators] = useState<EvaluatorOption[]>([]);
  const [selectedEvaluator, setSelectedEvaluator] = useState<EvaluatorOption | null>(null);

  // Legacy token flow state
  const [showTokenFallback, setShowTokenFallback] = useState(false);
  const [token, setToken] = useState('');

  // Shared state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [evaluator, setEvaluator] = useState<{ name: string; role: string } | null>(null);

  const roleLabels: Record<string, string> = {
    md: 'Medical Director',
    faculty: 'Faculty',
    agency: 'Agency Representative',
  };

  useEffect(() => {
    // Check for token in URL (legacy link flow)
    const t = searchParams.get('token');
    if (t) {
      setToken(t);
      setShowTokenFallback(true);
      validateToken(t);
      return;
    }

    // Check localStorage for existing PIN session
    const savedSession = localStorage.getItem('osce_session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        if (session.eventId && session.evaluatorName) {
          setEvaluator({ name: session.evaluatorName, role: session.evaluatorRole || '' });
          return;
        }
      } catch { /* ignore */ }
    }

    // Check localStorage for existing token session (legacy)
    const savedToken = localStorage.getItem('osce_token');
    if (savedToken) {
      validateToken(savedToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── PIN validation ──────────────────────────────────────────────────────────
  async function validatePin(code: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/osce/validate-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: code.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        setPinValidated(true);
        setEventInfo(data.event);
        setEvaluators(data.evaluators || []);
      } else {
        setError(data.error || 'Invalid event code');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleEvaluatorSelect(evaluatorId: string) {
    const ev = evaluators.find(e => e.id === evaluatorId);
    setSelectedEvaluator(ev || null);
  }

  function handlePinEnter() {
    if (!selectedEvaluator || !eventInfo) return;

    // Store session in localStorage
    const session = {
      eventId: eventInfo.id,
      evaluatorName: selectedEvaluator.name,
      evaluatorRole: selectedEvaluator.role,
      pin: pin.trim(),
      eventTitle: eventInfo.title,
    };
    localStorage.setItem('osce_session', JSON.stringify(session));
    localStorage.setItem('osce_evaluator', JSON.stringify({
      name: selectedEvaluator.name,
      role: selectedEvaluator.role,
    }));

    router.push('/osce-scoring/dashboard');
  }

  // ── Legacy token validation ─────────────────────────────────────────────────
  async function validateToken(t: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/osce/validate-token?token=${encodeURIComponent(t)}`);
      const data = await res.json();
      if (data.valid) {
        setEvaluator({ name: data.evaluator_name, role: data.evaluator_role });
        setToken(t);
      } else {
        setError(data.error || 'Invalid token');
        setEvaluator(null);
        localStorage.removeItem('osce_token');
        localStorage.removeItem('osce_evaluator');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleTokenEnter() {
    if (!evaluator) return;
    localStorage.setItem('osce_token', token);
    localStorage.setItem('osce_evaluator', JSON.stringify(evaluator));
    router.push('/osce-scoring/dashboard');
  }

  function handleLogout() {
    setEvaluator(null);
    setToken('');
    setPin('');
    setPinValidated(false);
    setEventInfo(null);
    setEvaluators([]);
    setSelectedEvaluator(null);
    setShowTokenFallback(false);
    setError('');
    localStorage.removeItem('osce_token');
    localStorage.removeItem('osce_evaluator');
    localStorage.removeItem('osce_session');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* PMI branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl mb-4">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">OSCE Clinical Capstone</h1>
          <p className="text-blue-300 mt-1">Evaluator Portal</p>
          <p className="text-slate-400 text-sm mt-1">Pima Medical Institute</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6">
          {/* ── Already authenticated ─────────────────────────────── */}
          {evaluator ? (
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Welcome, {evaluator.name}
              </h2>
              {evaluator.role && (
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  {roleLabels[evaluator.role] || evaluator.role}
                </p>
              )}
              <button
                onClick={handleTokenEnter}
                className="w-full mt-6 py-4 px-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors text-lg"
              >
                Enter Evaluator Dashboard
              </button>
              <button
                onClick={handleLogout}
                className="mt-3 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Not you? Sign out
              </button>
            </div>
          ) : showTokenFallback ? (
            /* ── Legacy token entry ──────────────────────────────── */
            <>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Enter your access token
              </label>
              <input
                type="text"
                value={token}
                onChange={e => { setToken(e.target.value); setError(''); }}
                placeholder="Paste your token here..."
                className="w-full px-4 py-3 text-lg border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyDown={e => e.key === 'Enter' && token.trim() && validateToken(token.trim())}
              />
              {error && (
                <p className="mt-2 text-sm text-red-500 dark:text-red-400">{error}</p>
              )}
              <button
                onClick={() => token.trim() && validateToken(token.trim())}
                disabled={loading || !token.trim()}
                className="w-full mt-4 py-3 px-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg"
              >
                {loading ? 'Validating...' : 'Validate Token'}
              </button>
              <button
                onClick={() => { setShowTokenFallback(false); setError(''); setToken(''); }}
                className="w-full mt-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Use event code instead
              </button>
            </>
          ) : !pinValidated ? (
            /* ── PIN entry ───────────────────────────────────────── */
            <>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Event Code
              </label>
              <input
                type="text"
                value={pin}
                onChange={e => { setPin(e.target.value); setError(''); }}
                placeholder="Enter event code..."
                className="w-full px-4 py-3 text-lg border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center tracking-wider font-mono"
                onKeyDown={e => e.key === 'Enter' && pin.trim() && validatePin(pin.trim())}
                autoFocus
              />
              {error && (
                <p className="mt-2 text-sm text-red-500 dark:text-red-400">{error}</p>
              )}
              <button
                onClick={() => pin.trim() && validatePin(pin.trim())}
                disabled={loading || !pin.trim()}
                className="w-full mt-4 py-3 px-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg"
              >
                {loading ? 'Validating...' : 'Continue'}
              </button>
              <button
                onClick={() => { setShowTokenFallback(true); setError(''); }}
                className="w-full mt-3 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Have an access token instead?
              </button>
            </>
          ) : (
            /* ── Evaluator selection ─────────────────────────────── */
            <>
              {eventInfo && (
                <div className="text-center mb-4">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-2">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{eventInfo.title}</p>
                  {eventInfo.subtitle && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{eventInfo.subtitle}</p>
                  )}
                </div>
              )}

              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                I am:
              </label>
              <select
                value={selectedEvaluator?.id || ''}
                onChange={e => handleEvaluatorSelect(e.target.value)}
                className="w-full px-4 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select your name...</option>
                {evaluators.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.label}
                  </option>
                ))}
              </select>

              {error && (
                <p className="mt-2 text-sm text-red-500 dark:text-red-400">{error}</p>
              )}

              <button
                onClick={handlePinEnter}
                disabled={!selectedEvaluator}
                className="w-full mt-4 py-4 px-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg"
              >
                Enter Assessment
              </button>

              <button
                onClick={() => {
                  setPinValidated(false);
                  setPin('');
                  setSelectedEvaluator(null);
                  setError('');
                }}
                className="w-full mt-3 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Use a different event code
              </button>
            </>
          )}
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          Spring 2026 &mdash; March 30-31
        </p>
      </div>
    </div>
  );
}

export default function OsceScoringEnterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-blue-950 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <EnterContent />
    </Suspense>
  );
}
