'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Clock, ChevronRight, Pause, Play } from 'lucide-react';
import { useVisibilityPolling } from '@/hooks/useVisibilityPolling';

interface TimerState {
  id: string;
  lab_day_id: string;
  rotation_number: number;
  status: 'running' | 'paused' | 'stopped';
  started_at: string | null;
  paused_at: string | null;
  elapsed_when_paused: number;
  duration_seconds: number;
  mode: 'countdown' | 'countup';
}

interface LabDay {
  id: string;
  date: string;
  displayName: string;
}

const BANNER_HEIGHT = 44; // Height in pixels

export default function GlobalTimerBanner() {
  const pathname = usePathname();
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [labDay, setLabDay] = useState<LabDay | null>(null);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [isDismissed, setIsDismissed] = useState(false);
  const [lastRotation, setLastRotation] = useState<number | null>(null);

  // Only show timer banner on relevant pages
  const isTimerRelevantPage = pathname === '/' ||
    pathname.startsWith('/lab-management') ||
    pathname.startsWith('/calendar');

  // Fetch active timer
  const fetchActiveTimer = useCallback(async () => {
    try {
      const res = await fetch('/api/lab-management/timer/active');
      const data = await res.json();

      if (data.success && data.timer) {
        // Un-dismiss when rotation changes
        if (lastRotation !== null && data.timer.rotation_number !== lastRotation) {
          setIsDismissed(false);
        }
        setLastRotation(data.timer.rotation_number);
        setTimer(data.timer);
        setLabDay(data.labDay);
      } else {
        setTimer(null);
        setLabDay(null);
        setLastRotation(null);
        setIsDismissed(false); // Reset dismiss state when no active timer
      }
    } catch (error) {
      console.error('Error fetching active timer:', error);
    }
  }, [lastRotation]);

  // Poll for active timer - optimized interval based on state
  // Uses visibility-aware polling to pause when tab is hidden
  const pollInterval = isTimerRelevantPage
    ? (timer?.status === 'running' ? 5000 : 60000)
    : null;
  useVisibilityPolling(fetchActiveTimer, pollInterval);

  // Add/remove body class and padding when banner is visible
  const isActive = timer && labDay && !isDismissed;
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

  // Calculate display time with visibility-aware updates
  useEffect(() => {
    if (!timer) return;

    const calculateElapsed = () => {
      if (timer.status === 'stopped') {
        return 0;
      } else if (timer.status === 'paused') {
        return timer.elapsed_when_paused || 0;
      } else if (timer.status === 'running' && timer.started_at) {
        const startTime = new Date(timer.started_at).getTime();
        const now = Date.now();
        return Math.floor((now - startTime) / 1000);
      }
      return 0;
    };

    const updateDisplay = () => {
      const elapsed = calculateElapsed();
      const duration = timer.duration_seconds;

      if (timer.mode === 'countdown') {
        setDisplaySeconds(Math.max(0, duration - elapsed));
      } else {
        setDisplaySeconds(Math.min(elapsed, duration));
      }
    };

    updateDisplay();

    // Only run display timer when page is visible
    let intervalId: NodeJS.Timeout | null = setInterval(updateDisplay, 1000);

    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      } else {
        updateDisplay(); // Catch up immediately
        intervalId = setInterval(updateDisplay, 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [timer]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get background color based on time remaining
  const getBannerColor = () => {
    if (!timer) {
      return 'bg-green-600';
    }
    const remaining = timer.mode === 'countdown'
      ? displaySeconds
      : (timer.duration_seconds - displaySeconds);

    if (remaining <= 60) return 'bg-red-600';
    if (remaining <= 300) return 'bg-yellow-600';
    return 'bg-green-600';
  };

  // Auto-dismiss when countdown reaches 0
  const isTimeUp = timer?.mode === 'countdown' && displaySeconds <= 0 && timer?.status === 'running';

  // Don't render if not on a timer-relevant page
  if (!isTimerRelevantPage) {
    return null;
  }

  // Don't render if no active timer, user dismissed, timer is not running, or time is up
  if (!timer || !labDay || isDismissed || timer.status !== 'running' || isTimeUp) {
    return null;
  }

  const isRunning = timer.status === 'running';

  return (
    <div
      role="status"
      aria-label={`Lab timer: Rotation ${timer.rotation_number}, ${formatTime(displaySeconds)} ${timer.mode === 'countdown' ? 'remaining' : 'elapsed'}`}
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
            <Play className="w-4 h-4" aria-hidden="true" />
            <span className="font-mono font-bold text-lg sm:text-xl">
              {formatTime(displaySeconds)}
            </span>
            <span className="text-sm text-white/70 hidden sm:inline">
              {timer.mode === 'countdown' ? 'remaining' : 'elapsed'}
            </span>
          </div>

          {/* Right: Link to timer page */}
          <div className="flex items-center gap-2">
            <Link
              href={`/lab-management/schedule/${labDay.id}?timer=open`}
              aria-label={`Open timer for ${labDay.displayName}`}
              className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              <span className="hidden sm:inline">Open Timer</span>
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <button
              onClick={() => setIsDismissed(true)}
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
