'use client';

/**
 * /settings/calendar-setup — guided 3-step Google Calendar onboarding
 *
 * Step 1: Connect Google Calendar (OAuth handoff)
 *   - Click "Connect Google Calendar" → redirects to
 *     /api/calendar/connect (NextAuth-OAuth flow). On callback, the
 *     callback endpoint redirects back to /settings, but the wizard
 *     also re-checks /api/calendar/status when the page loads so a
 *     manual refresh / shareable-link visit lands on Step 2 if the
 *     user has already connected.
 *
 * Step 2: Sync your assigned schedule
 *   - GET /api/calendar/my-assignments → shows count.
 *   - "Sync Now" → POST /api/calendar/sync-my-blocks. Display count
 *     of created + updated events on success.
 *
 * Step 3: Done
 *   - Confirmation + helpful next steps.
 *
 * Mobile-friendly: single column, generous tap targets. Sharable
 * link: pmiparamedic.tools/settings/calendar-setup
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Calendar,
  CheckCircle2,
  ArrowRight,
  Loader2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

type Step = 1 | 2 | 3;

interface CalendarStatus {
  connected: boolean;
  scope: string;
  needs_reauth: boolean;
}

interface AssignmentCounts {
  block_count: number;
  series_count: number;
}

interface SyncResult {
  series_count: number;
  created: number;
  updated: number;
  failed: number;
}

export default function CalendarSetupWizardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status: authStatus } = useSession();

  const [step, setStep] = useState<Step>(1);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [counts, setCounts] = useState<AssignmentCounts | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Surface OAuth callback errors that the API might pass via
  // ?calendar=error&message=... so the user knows why they're back
  // on Step 1.
  useEffect(() => {
    const cal = searchParams.get('calendar');
    if (cal === 'error') {
      setErrorMessage(searchParams.get('message') || 'Connection failed. Please try again.');
    }
  }, [searchParams]);

  // Load /api/calendar/status on mount + whenever auth flips. Also
  // re-fetch when the URL gains ?calendar=success after the OAuth
  // callback redirects through /settings into here.
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/calendar/status');
        if (!res.ok) throw new Error('Failed to fetch calendar status');
        const data = await res.json();
        if (cancelled) return;
        const s: CalendarStatus = {
          connected: !!data.connected,
          scope: data.scope || 'freebusy',
          needs_reauth: !!data.needs_reauth,
        };
        setCalendarStatus(s);
        // Auto-advance on entry: if already connected with the right
        // scope, jump the user to Step 2. Step 3 is reached only after
        // a successful Sync Now.
        if (s.connected && !s.needs_reauth) {
          setStep(prev => (prev === 1 ? 2 : prev));
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : 'Failed to load status');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  // Pre-load assignment counts when step 2 becomes visible.
  useEffect(() => {
    if (step !== 2) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/calendar/my-assignments');
        if (!res.ok) throw new Error('Failed to load assignments');
        const data = await res.json();
        if (!cancelled) {
          setCounts({
            block_count: data.block_count ?? 0,
            series_count: data.series_count ?? 0,
          });
        }
      } catch {
        if (!cancelled) {
          setCounts({ block_count: 0, series_count: 0 });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step]);

  const handleConnect = () => {
    // /api/calendar/connect issues a redirect to Google's OAuth
    // consent screen. Using a direct anchor navigation (rather than
    // fetch) is required for the redirect chain to work.
    window.location.href = '/api/calendar/connect';
  };

  const handleSync = async () => {
    setSyncing(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/calendar/sync-my-blocks', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Sync failed');
      }
      setSyncResult({
        series_count: data.series_count ?? 0,
        created: data.created ?? 0,
        updated: data.updated ?? 0,
        failed: data.failed ?? 0,
      });
      setStep(3);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  if (authStatus === 'loading') {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </main>
    );
  }
  if (authStatus !== 'authenticated') {
    if (typeof window !== 'undefined') router.push('/auth/signin');
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header + step indicator */}
        <div className="mb-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-7 h-7 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Connect Google Calendar
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Three quick steps to sync your PMI schedule.
          </p>
        </div>

        <StepIndicator current={step} />

        {errorMessage && (
          <div className="mb-4 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-3 py-2.5 text-sm text-red-800 dark:text-red-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6">
          {step === 1 && (
            <Step1Connect
              calendarStatus={calendarStatus}
              onConnect={handleConnect}
            />
          )}
          {step === 2 && (
            <Step2Sync
              counts={counts}
              syncing={syncing}
              onSync={handleSync}
            />
          )}
          {step === 3 && <Step3Done syncResult={syncResult} />}
        </div>

        {/* Footer nav — let the user step backwards if they're
            curious, and provide an exit hatch back to home. */}
        <div className="mt-6 flex items-center justify-between text-sm">
          <Link
            href="/"
            className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          >
            ← Back to dashboard
          </Link>
          <Link
            href="/settings"
            className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          >
            All settings
          </Link>
        </div>
      </div>
    </main>
  );
}

// ─── Step components ─────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps: { n: Step; label: string }[] = [
    { n: 1, label: 'Connect' },
    { n: 2, label: 'Sync' },
    { n: 3, label: 'Done' },
  ];
  return (
    <ol className="flex items-center justify-center gap-2 mb-6">
      {steps.map((s, i) => {
        const done = current > s.n;
        const active = current === s.n;
        return (
          <li key={s.n} className="flex items-center gap-2">
            <span
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${
                done
                  ? 'bg-emerald-500 text-white'
                  : active
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/40'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              {done ? <CheckCircle2 className="w-4 h-4" /> : s.n}
            </span>
            <span
              className={`text-xs font-medium ${
                active
                  ? 'text-gray-900 dark:text-gray-100'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="w-6 h-px bg-gray-300 dark:bg-gray-600" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Step1Connect({
  calendarStatus,
  onConnect,
}: {
  calendarStatus: CalendarStatus | null;
  onConnect: () => void;
}) {
  const needsReauth = calendarStatus?.needs_reauth;
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {needsReauth ? 'Reconnect your Google Calendar' : 'Connect your Google Calendar'}
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {needsReauth
          ? 'Your previous connection used an older permission level. Reconnect to enable two-way sync.'
          : 'PMI Tools will connect to your Google account so we can add your assigned classes and labs to your calendar.'}
      </p>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4 mb-4">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-gray-700 dark:text-gray-300">
            <p className="font-semibold mb-1">What we&apos;ll request</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Read your calendar list and free/busy windows</li>
              <li>Create &amp; update events that PMI Tools manages</li>
            </ul>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              We never read your private events or share your data.
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={onConnect}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm"
      >
        <Calendar className="w-4 h-4" />
        {needsReauth ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
      </button>
    </div>
  );
}

function Step2Sync({
  counts,
  syncing,
  onSync,
}: {
  counts: AssignmentCounts | null;
  syncing: boolean;
  onSync: () => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Your assigned schedule
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        We&apos;ll add your assigned classes and labs to your Google Calendar as recurring events.
      </p>

      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 mb-4">
        {counts === null ? (
          <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
            <Loader2 className="w-4 h-4 animate-spin" /> Counting assignments…
          </div>
        ) : counts.block_count === 0 ? (
          <p className="text-sm text-blue-800 dark:text-blue-200">
            You don&apos;t have any published classes or labs assigned right now. You can still finish setup — when classes are scheduled, your calendar will sync automatically.
          </p>
        ) : (
          <p className="text-sm text-blue-900 dark:text-blue-100">
            We found <strong>{counts.series_count}</strong> recurring series across <strong>{counts.block_count}</strong> sessions.
          </p>
        )}
      </div>

      <button
        onClick={onSync}
        disabled={syncing}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm disabled:opacity-60"
      >
        {syncing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <RefreshCw className="w-4 h-4" />
        )}
        {syncing ? 'Syncing…' : 'Sync Now'}
      </button>
    </div>
  );
}

function Step3Done({ syncResult }: { syncResult: SyncResult | null }) {
  const total = (syncResult?.created ?? 0) + (syncResult?.updated ?? 0);
  return (
    <div>
      <div className="flex flex-col items-center text-center mb-4">
        <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mb-3">
          <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          You&apos;re all set!
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {total > 0 ? (
            <>
              <strong>{total}</strong> event{total === 1 ? '' : 's'} added to your Google Calendar.
            </>
          ) : (
            'Your Google Calendar is connected. New assignments will sync automatically.'
          )}
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4 mb-4">
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
          What happens next
        </p>
        <ul className="list-disc pl-4 text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
          <li>New class assignments push to your calendar automatically.</li>
          <li>If you change instructor on a block, the event moves with you.</li>
          <li>Manage which categories sync at <Link href="/settings#calendar" className="underline">Settings → Google Calendar</Link>.</li>
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <a
          href="https://calendar.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40 text-sm font-medium"
        >
          Open Google Calendar
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <Link
          href="/"
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
        >
          Go to Dashboard
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
