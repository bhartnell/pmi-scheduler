'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Clock, ChevronRight, Pause, Play } from 'lucide-react';
import { useLabTimerState } from '@/hooks/useLabTimerState';
import { formatTime } from '@/lib/utils';

interface LabDay {
  id: string;
  date: string;
  displayName: string;
}

const BANNER_HEIGHT = 44; // Height in pixels

export default function GlobalTimerBanner() {
  const pathname = usePathname();
  const [labDay, setLabDay] = useState<LabDay | null>(null);
  // Dismissal is keyed to a rotation number: a new rotation un-dismisses by
  // inequality, no effect needed.
  const [dismissedRotation, setDismissedRotation] = useState<number | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Show timer banner on all authenticated pages (not on login/auth/public pages)
  const isTimerRelevantPage = !pathname.startsWith('/auth') &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/timer-display') &&
    !pathname.startsWith('/volunteer-lab') &&
    !pathname.startsWith('/volunteer');

  // Pages that already have their own dedicated timer component (LabTimer, TimerBanner)
  // GlobalTimerBanner should NOT render on these pages to avoid showing two timers
  const hasOwnTimerComponent = pathname.startsWith('/labs/schedule/') ||
    pathname.startsWith('/labs/grade/');

  const handleResponse = useCallback(({ status, body }: { status: number; body: any }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    // Stop on 401 / stop_polling: session expired (prevents wasting Vercel invocations)
    if (status === 401 || body?.stop_polling) {
      setSessionExpired(true);
      setLabDay(null);
      return;
    }
    if (body?.success && body.labDay) setLabDay(body.labDay);
  }, []);

  // ONE owner of timer state (hooks/useLabTimerState): realtime push plus
  // re-fetch on reconnect/visibility. The only poll left is a 60s discovery
  // heartbeat (hook clamps to >= 60s) as a safety net.
  const { timer, displaySeconds: hookSeconds, refetch } = useLabTimerState({
    url: '/api/lab-management/timer/active?readonly=1',
    enabled: isTimerRelevantPage && !hasOwnTimerComponent && !sessionExpired,
    heartbeatMs: 60000,
    onResponse: handleResponse,
  });
  // null = no trustworthy reading: show --:-- rather than coercing to 0.
  const displaySeconds = hookSeconds;

  // A realtime row for a different lab day than the one we have a name for:
  // fetch the active timer's labDay info.
  const labDayMismatch = !!timer && !!labDay && labDay.id !== timer.lab_day_id;
  useEffect(() => {
    if (labDayMismatch) refetch();
  }, [labDayMismatch, refetch]);

  const isDismissed = !!timer && dismissedRotation === timer.rotation_number;

  // Add/remove body class and padding when banner is visible
  const isActive = !!(timer && labDay && !labDayMismatch && !isDismissed && timer.status !== 'stopped');
  useEffect(() => {
    if (isActive) {
      document.body.classList.add('has-timer-banner');
      document.body.style.paddingTop = `${BANNER_HEIGHT}px`;
    } else {
      document.body.classList.remove('has-timer-banner');
      document.body.style.paddingTop = '';
    }
    return () => {
      document.body.classList.remove('has-timer-banner');
      document.body.style.paddingTop = '';
    };
  }, [isActive]);

  // Get background color based on time remaining
  const getBannerColor = () => {
    if (!timer) {
      return 'bg-green-600';
    }
    if (timer.status === 'paused') return 'bg-blue-600';
    if (displaySeconds === null) return 'bg-gray-600';
    const remaining = timer.mode === 'countdown'
      ? displaySeconds
      : (timer.duration_seconds - displaySeconds);

    if (remaining <= 60) return 'bg-red-600';
    if (remaining <= 300) return 'bg-yellow-600';
    return 'bg-green-600';
  };

  // Auto-dismiss when countdown reaches 0
  const isTimeUp = timer?.mode === 'countdown' && displaySeconds !== null && displaySeconds <= 0 && timer?.status === 'running';

  // Don't render if not on a timer-relevant page or if page has its own timer component
  if (!isTimerRelevantPage || hasOwnTimerComponent) {
    return null;
  }

  // Don't render if no active timer, user dismissed, timer is stopped, or time is up
  if (!timer || !labDay || labDayMismatch || isDismissed || timer.status === 'stopped' || isTimeUp) {
    return null;
  }

  const isPaused = timer.status === 'paused';

  return (
    <div
      role="status"
      aria-label={`Lab timer: Rotation ${timer.rotation_number}, ${displaySeconds === null ? '--:--' : formatTime(displaySeconds)} ${isPaused ? 'paused' : timer.mode === 'countdown' ? 'remaining' : 'elapsed'}`}
      className={`fixed top-0 left-0 right-0 z-[100] ${getBannerColor()} text-white shadow-lg transition-colors duration-300 print:hidden`}
      style={{ height: `${BANNER_HEIGHT}px` }}
    >
      <div className="max-w-7xl mx-auto px-4 h-full">
        <div className="flex items-center justify-between h-full">
          {/* Left: Lab info */}
          <div className="flex items-center gap-2 min-w-0">
            <Clock className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span className="font-medium truncate">
              {labDay.displayName}
            </span>
            <span className="text-white/70 text-sm hidden sm:inline" aria-hidden="true">
              | Rotation {timer.rotation_number}
            </span>
          </div>

          {/* Center: Time display */}
          <div className="flex items-center gap-2" aria-hidden="true">
            {isPaused ? (
              <Pause className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Play className="w-4 h-4" aria-hidden="true" />
            )}
            <span className="font-mono font-bold text-lg sm:text-xl">
              {displaySeconds === null ? '--:--' : formatTime(displaySeconds)}
            </span>
            <span className="text-sm text-white/70 hidden sm:inline">
              {isPaused ? 'paused' : timer.mode === 'countdown' ? 'remaining' : 'elapsed'}
            </span>
          </div>

          {/* Right: Link to timer page */}
          <div className="flex items-center gap-2">
            <Link
              href={`/labs/schedule/${labDay.id}?timer=open`}
              aria-label={`Open timer for ${labDay.displayName}`}
              className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              <span className="hidden sm:inline">Open Timer</span>
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <button
              onClick={() => setDismissedRotation(timer.rotation_number)}
              aria-label="Dismiss timer banner"
              className="p-1 hover:bg-white/20 rounded transition-colors text-white/70 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
