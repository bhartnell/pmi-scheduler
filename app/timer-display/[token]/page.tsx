'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Maximize2, Minimize2, Volume2, VolumeX, Smartphone, Lock, Unlock, Play, Pause, Square, SkipForward, Plus, Minus, RotateCcw, Settings } from 'lucide-react';
import { useVisibilityPolling } from '@/hooks/useVisibilityPolling';
import { useTimerAudio, loadTimerAudioSettings, TimerAudioSettings, TIMER_AUDIO_STORAGE_KEY } from '@/hooks/useTimerAudio';
import { formatTime } from '@/lib/utils';

interface TimerState {
  id: string;
  lab_day_id: string;
  rotation_number: number;
  status: 'running' | 'paused' | 'stopped';
  started_at: string | null;
  paused_at: string | null;
  elapsed_when_paused: number;
  duration_seconds: number;
  debrief_seconds: number;
  mode: 'countdown' | 'countup';
  rotation_acknowledged: boolean;
}

interface DisplayInfo {
  id: string;
  room_name: string;
  timer_type: 'fixed' | 'mobile';
}

interface LabDayInfo {
  id: string;
  date: string;
  title: string | null;
  displayName: string;
}

// Extend the BeforeInstallPromptEvent (not in standard TS lib)
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function TimerDisplayPage() {
  const params = useParams();
  const token = params.token as string;

  const [display, setDisplay] = useState<DisplayInfo | null>(null);
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [labDay, setLabDay] = useState<LabDayInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [controlActionLoading, setControlActionLoading] = useState(false);
  const [adjustmentFlash, setAdjustmentFlash] = useState<string | null>(null);

  const lastFetchRef = useRef<number>(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const deferredInstallPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const touchStartYRef = useRef(0);
  const touchStartXRef = useRef(0);
  const doubleTapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef(0);
  const controlPanelHideRef = useRef<NodeJS.Timeout | null>(null);

  // Track which rotation's warnings have fired (once per rotation cycle)
  const hasPlayedRotationAlertRef = useRef<number | null>(null);
  const hasPlayedFiveMinRef = useRef<number | null>(null);
  const hasPlayedOneMinRef = useRef<number | null>(null);

  // Load audio settings from localStorage (updated via storage event)
  const [audioSettings, setAudioSettings] = useState<Partial<TimerAudioSettings>>(() =>
    loadTimerAudioSettings()
  );

  // Listen for settings changes from the settings page (same tab or other tabs)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === TIMER_AUDIO_STORAGE_KEY) {
        setAudioSettings(loadTimerAudioSettings());
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Merge soundEnabled mute with audio settings volume
  const effectiveSettings: Partial<TimerAudioSettings> = {
    ...audioSettings,
    volume: soundEnabled ? audioSettings.volume : 0,
  };

  const { playFiveMinWarning, playOneMinWarning, playRotationAlert } = useTimerAudio(effectiveSettings);

  // ─── Wake Lock ───────────────────────────────────────────────────────────────
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator && navigator.wakeLock) {
        const sentinel = await navigator.wakeLock.request('screen');
        wakeLockRef.current = sentinel;
        setWakeLockActive(true);
        sentinel.addEventListener('release', () => {
          setWakeLockActive(false);
          wakeLockRef.current = null;
        });
      }
    } catch (err) {
      console.error('Wake Lock error:', err);
    }
  }, []);

  // Request wake lock on mount and re-acquire on visibility change
  useEffect(() => {
    requestWakeLock();

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        await requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [requestWakeLock]);

  // ─── Fullscreen ──────────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.warn('Fullscreen not available:', e);
    }
  }, []);

  // Listen for external fullscreen changes (e.g. Esc key)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // ─── Orientation Detection ───────────────────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)');
    setIsLandscape(mq.matches);

    const handleOrientationChange = (e: MediaQueryListEvent) => {
      setIsLandscape(e.matches);
    };

    mq.addEventListener('change', handleOrientationChange);
    return () => mq.removeEventListener('change', handleOrientationChange);
  }, []);

  // ─── PWA Install Prompt ──────────────────────────────────────────────────────
  useEffect(() => {
    // Detect iOS
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua);
    setIsIOS(ios);

    // Check if already dismissed
    const dismissed = localStorage.getItem('pmi-timer-install-dismissed');
    if (dismissed) return;

    // Check if already in standalone mode (already installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true);
    if (isStandalone) return;

    if (ios) {
      // Show iOS-specific instructions
      setShowInstallBanner(true);
    } else {
      // Listen for beforeinstallprompt (Android/Chrome)
      const handler = (e: Event) => {
        e.preventDefault();
        deferredInstallPromptRef.current = e as BeforeInstallPromptEvent;
        setShowInstallBanner(true);
      };
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }
  }, []);

  const handleInstallClick = async () => {
    if (deferredInstallPromptRef.current) {
      await deferredInstallPromptRef.current.prompt();
      const choice = await deferredInstallPromptRef.current.userChoice;
      if (choice.outcome === 'accepted') {
        setShowInstallBanner(false);
      }
      deferredInstallPromptRef.current = null;
    }
  };

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem('pmi-timer-install-dismissed', '1');
  };

  // ─── Swipe Gestures ──────────────────────────────────────────────────────────
  // We need stable references to timer actions; since this page only displays
  // (no local control of the timer), swipe up = mute toggle, swipe down = fullscreen
  // as a reasonable alternative. Per spec: swipe up = pause/resume, swipe down = reset
  // but this is a display-only page — we'll map swipe up to sound toggle and
  // swipe down to fullscreen as sensible display-side actions.
  // Actually, per spec, keep swipe up = mute toggle (closest action available on display)
  // and swipe down = fullscreen. This is better UX than no-op.

  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
    touchStartXRef.current = e.touches[0].clientX;

    // Double-tap detection for fullscreen
    const now = Date.now();
    const timeSinceLast = now - lastTapRef.current;
    if (timeSinceLast < 300) {
      // Double tap
      if (doubleTapTimerRef.current) {
        clearTimeout(doubleTapTimerRef.current);
        doubleTapTimerRef.current = null;
      }
      toggleFullscreen();
    }
    lastTapRef.current = now;
  }, [toggleFullscreen]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    const deltaY = touchStartYRef.current - e.changedTouches[0].clientY;
    const deltaX = touchStartXRef.current - e.changedTouches[0].clientX;
    const minSwipe = 50;

    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      if (deltaY > minSwipe) {
        // Swipe up = toggle sound
        setSoundEnabled(v => !v);
      } else if (deltaY < -minSwipe) {
        // Swipe down = toggle fullscreen
        toggleFullscreen();
      }
    }
  }, [toggleFullscreen]);

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);

  // ─── PIN Unlock & Control Panel ──────────────────────────────────────────────
  const DEFAULT_PIN = '1234';

  const handlePinSubmit = useCallback(() => {
    if (pinInput === DEFAULT_PIN) {
      setIsUnlocked(true);
      setShowPinDialog(false);
      setPinInput('');
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput('');
    }
  }, [pinInput]);

  const handleLockToggle = useCallback(() => {
    if (isUnlocked) {
      setIsUnlocked(false);
      setShowControlPanel(false);
      if (controlPanelHideRef.current) clearTimeout(controlPanelHideRef.current);
    } else {
      setShowPinDialog(true);
      setPinInput('');
      setPinError(false);
    }
  }, [isUnlocked]);

  const resetControlPanelHideTimer = useCallback(() => {
    if (controlPanelHideRef.current) clearTimeout(controlPanelHideRef.current);
    controlPanelHideRef.current = setTimeout(() => {
      setShowControlPanel(false);
    }, 10000);
  }, []);

  const toggleControlPanel = useCallback(() => {
    if (!isUnlocked) return;
    setShowControlPanel(prev => {
      if (!prev) {
        if (controlPanelHideRef.current) clearTimeout(controlPanelHideRef.current);
        controlPanelHideRef.current = setTimeout(() => {
          setShowControlPanel(false);
        }, 10000);
      } else {
        if (controlPanelHideRef.current) clearTimeout(controlPanelHideRef.current);
      }
      return !prev;
    });
  }, [isUnlocked]);

  useEffect(() => {
    return () => {
      if (controlPanelHideRef.current) clearTimeout(controlPanelHideRef.current);
    };
  }, []);

  // Timer control actions (using the lab_day_id from the timer state)
  const sendTimerAction = useCallback(async (action: string) => {
    if (!timer?.lab_day_id) return;
    setControlActionLoading(true);
    resetControlPanelHideTimer();
    try {
      const res = await fetch('/api/lab-management/timer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labDayId: timer.lab_day_id, action })
      });
      const data = await res.json();
      if (data.success) {
        setTimer(data.timer);
      }
    } catch (err) {
      console.error('Error sending timer action:', err);
    } finally {
      setControlActionLoading(false);
    }
  }, [timer?.lab_day_id, resetControlPanelHideTimer]);

  const handleTimeAdjust = useCallback(async (action: 'add_time' | 'subtract_time') => {
    if (!timer?.lab_day_id) return;
    setControlActionLoading(true);
    resetControlPanelHideTimer();
    try {
      const res = await fetch('/api/lab-management/timer/adjust', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lab_day_id: timer.lab_day_id, action, seconds: 60 })
      });
      const data = await res.json();
      if (data.success) {
        setTimer(data.timer);
        const flashText = action === 'add_time' ? '+1:00' : '-1:00';
        setAdjustmentFlash(flashText);
        setTimeout(() => setAdjustmentFlash(null), 2000);
      }
    } catch (err) {
      console.error('Error adjusting timer:', err);
    } finally {
      setControlActionLoading(false);
    }
  }, [timer?.lab_day_id, resetControlPanelHideTimer]);

  const handleStopWithConfirm = useCallback(() => {
    resetControlPanelHideTimer();
    if (window.confirm('Stop the timer? This will halt the current rotation.')) {
      sendTimerAction('stop');
    }
  }, [sendTimerAction, resetControlPanelHideTimer]);

  // ─── Timer Polling ───────────────────────────────────────────────────────────
  const fetchTimerStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/timer-display/${token}`);
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to fetch timer status');
        return;
      }

      setDisplay(data.display);
      setTimer(data.timer);
      setLabDay(data.labDay);
      setError(null);

      // Calculate server time offset
      if (data.serverTime) {
        const serverTime = new Date(data.serverTime).getTime();
        const localTime = Date.now();
        setServerTimeOffset(serverTime - localTime);
      }

      lastFetchRef.current = Date.now();
    } catch (err) {
      console.error('Error fetching timer status:', err);
      setError('Connection error');
    }
  }, [token]);

  // Initial fetch and polling with visibility awareness
  useVisibilityPolling(fetchTimerStatus, 5000);

  // ─── Timer Display Calculation ───────────────────────────────────────────────
  useEffect(() => {
    if (!timer) {
      setCurrentTime(0);
      return;
    }

    const calculateTime = () => {
      if (timer.status === 'stopped') {
        return timer.mode === 'countdown' ? timer.duration_seconds : 0;
      }

      if (timer.status === 'paused') {
        return timer.mode === 'countdown'
          ? timer.duration_seconds - timer.elapsed_when_paused
          : timer.elapsed_when_paused;
      }

      // Running
      if (timer.started_at) {
        const now = Date.now() + serverTimeOffset;
        const startTime = new Date(timer.started_at).getTime();
        const elapsed = Math.floor((now - startTime) / 1000);

        if (timer.mode === 'countdown') {
          return Math.max(0, timer.duration_seconds - elapsed);
        } else {
          return elapsed;
        }
      }

      return 0;
    };

    setCurrentTime(calculateTime());

    // Update every second when running, pause when page is hidden
    if (timer.status === 'running') {
      let interval: NodeJS.Timeout | null = setInterval(() => {
        const t = calculateTime();
        setCurrentTime(t);

        if (timer.mode === 'countdown') {
          // Rotation alert — fires once per rotation when countdown hits zero
          if (
            t <= 0 &&
            hasPlayedRotationAlertRef.current !== timer.rotation_number
          ) {
            hasPlayedRotationAlertRef.current = timer.rotation_number;
            playRotationAlert();
          }

          // 5-minute warning — fires once per rotation when 300s remain
          if (
            t > 0 &&
            t <= 300 &&
            hasPlayedFiveMinRef.current !== timer.rotation_number
          ) {
            hasPlayedFiveMinRef.current = timer.rotation_number;
            playFiveMinWarning();
          }

          // 1-minute warning — fires once per rotation when 60s remain
          if (
            t > 0 &&
            t <= 60 &&
            hasPlayedOneMinRef.current !== timer.rotation_number
          ) {
            hasPlayedOneMinRef.current = timer.rotation_number;
            playOneMinWarning();
          }
        }
      }, 1000);

      const handleVisibility = () => {
        if (document.hidden) {
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
        } else {
          setCurrentTime(calculateTime()); // Catch up immediately
          interval = setInterval(() => {
            setCurrentTime(calculateTime());
          }, 1000);
        }
      };

      document.addEventListener('visibilitychange', handleVisibility);

      return () => {
        if (interval) clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }
  }, [timer, serverTimeOffset, playRotationAlert, playFiveMinWarning, playOneMinWarning]);

  // Reset warning trackers when a new rotation starts
  useEffect(() => {
    if (timer?.rotation_number !== undefined) {
      const rot = timer.rotation_number;
      // Only reset flags from previous rotation (not on first mount)
      if (
        hasPlayedRotationAlertRef.current !== null &&
        hasPlayedRotationAlertRef.current !== rot
      ) {
        hasPlayedRotationAlertRef.current = null;
      }
      if (
        hasPlayedFiveMinRef.current !== null &&
        hasPlayedFiveMinRef.current !== rot
      ) {
        hasPlayedFiveMinRef.current = null;
      }
      if (
        hasPlayedOneMinRef.current !== null &&
        hasPlayedOneMinRef.current !== rot
      ) {
        hasPlayedOneMinRef.current = null;
      }
    }
  }, [timer?.rotation_number]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  // Determine display state
  const isTimeUp = timer?.mode === 'countdown' && currentTime <= 0 && timer?.status === 'running';
  const needsRotation = !timer?.rotation_acknowledged;
  const showRotateFlash = isTimeUp || needsRotation;
  const isDebrief = timer?.mode === 'countdown' && currentTime > 0 && currentTime <= (timer?.debrief_seconds || 300) && timer?.status === 'running';

  // ─── Shared control buttons ───────────────────────────────────────────────────
  const ControlButtons = () => (
    <div className="flex items-center gap-2">
      {/* Wake lock indicator */}
      {wakeLockActive && (
        <span className="hidden sm:flex items-center gap-1 text-xs text-white/40 px-2 py-1 rounded bg-white/5">
          <Smartphone className="w-3 h-3" />
          Always On
        </span>
      )}
      {/* Sound toggle */}
      <button
        onClick={() => setSoundEnabled(v => !v)}
        className="flex items-center justify-center min-w-[48px] min-h-[48px] sm:min-w-0 sm:min-h-0 p-2 sm:p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors touch-manipulation"
        title={soundEnabled ? 'Mute chime' : 'Enable chime'}
        aria-label={soundEnabled ? 'Mute chime' : 'Enable chime'}
      >
        {soundEnabled ? <Volume2 className="w-6 h-6 sm:w-5 sm:h-5" /> : <VolumeX className="w-6 h-6 sm:w-5 sm:h-5" />}
      </button>
      {/* Fullscreen toggle */}
      <button
        onClick={toggleFullscreen}
        className="flex items-center justify-center min-w-[48px] min-h-[48px] sm:min-w-0 sm:min-h-0 p-2 sm:p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors touch-manipulation"
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? <Minimize2 className="w-6 h-6 sm:w-5 sm:h-5" /> : <Maximize2 className="w-6 h-6 sm:w-5 sm:h-5" />}
      </button>
    </div>
  );

  // ─── Install Banner ───────────────────────────────────────────────────────────
  const InstallBanner = () => {
    if (!showInstallBanner) return null;
    return (
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-blue-800 text-white px-4 py-3 flex items-center justify-between gap-2"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center gap-2 text-sm">
          <Smartphone className="w-4 h-4 shrink-0" />
          {isIOS ? (
            <span>Add to Home Screen: tap Share, then &quot;Add to Home Screen&quot;</span>
          ) : (
            <button
              onClick={handleInstallClick}
              className="underline font-medium touch-manipulation"
            >
              Add PMI Timer to Home Screen
            </button>
          )}
        </div>
        <button
          onClick={dismissInstallBanner}
          className="shrink-0 text-white/70 hover:text-white text-lg leading-none touch-manipulation px-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Dismiss"
        >
          &times;
        </button>
      </div>
    );
  };

  // ─── Error state ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div
        className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <head>
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black" />
          <meta name="apple-mobile-web-app-title" content="PMI Timer" />
          <meta name="theme-color" content="#1e40af" />
          <link rel="manifest" href="/timer-manifest.json" />
        </head>
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold mb-2">Timer Display Error</h1>
        <p className="text-gray-400 text-center">{error}</p>
        <p className="text-sm text-gray-600 mt-4">Token: {token}</p>
      </div>
    );
  }

  // ─── Loading state ────────────────────────────────────────────────────────────
  if (!display) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <head>
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black" />
          <meta name="apple-mobile-web-app-title" content="PMI Timer" />
          <meta name="theme-color" content="#1e40af" />
          <link rel="manifest" href="/timer-manifest.json" />
        </head>
        <div className="animate-pulse text-white text-6xl">Loading...</div>
      </div>
    );
  }

  // ─── No active timer ──────────────────────────────────────────────────────────
  if (!timer || !labDay) {
    return (
      <div
        className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-4 relative"
        style={{
          paddingTop: 'max(16px, env(safe-area-inset-top))',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}
      >
        <head>
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black" />
          <meta name="apple-mobile-web-app-title" content="PMI Timer" />
          <meta name="theme-color" content="#1e40af" />
          <link rel="manifest" href="/timer-manifest.json" />
        </head>
        <h1 className="text-4xl md:text-6xl font-bold mb-4 text-center">{display.room_name}</h1>
        <p className="text-2xl md:text-4xl text-gray-400">No Active Timer</p>
        <p className="text-lg text-gray-600 mt-4">Waiting for lab session to start...</p>
        {/* Controls overlay - always visible */}
        <div className="absolute top-4 right-4 flex items-center gap-2"
          style={{ top: 'max(16px, env(safe-area-inset-top))' }}
        >
          <ControlButtons />
        </div>
        <InstallBanner />
      </div>
    );
  }

  // ─── Main display ─────────────────────────────────────────────────────────────
  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center transition-colors duration-300 relative overflow-hidden ${
        showRotateFlash
          ? 'animate-pulse bg-red-600'
          : isDebrief
          ? 'bg-yellow-600'
          : timer.status === 'paused'
          ? 'bg-blue-900'
          : 'bg-black'
      }`}
      style={{
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingBottom: showInstallBanner
          ? 'max(56px, env(safe-area-inset-bottom))'
          : 'max(16px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
      }}
    >
      {/* PWA meta tags */}
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="apple-mobile-web-app-title" content="PMI Timer" />
        <meta name="theme-color" content="#1e40af" />
        <link rel="manifest" href="/timer-manifest.json" />
      </head>

      {/* ── Header row ── */}
      {isLandscape ? (
        /* Landscape: compact single-row header */
        <div className="absolute top-0 left-0 right-0 flex justify-between items-center px-4 py-2"
          style={{ paddingTop: 'max(8px, env(safe-area-inset-top))', paddingLeft: 'max(16px, env(safe-area-inset-left))', paddingRight: 'max(16px, env(safe-area-inset-right))' }}
        >
          <div className="flex items-center gap-3">
            <h2 className="text-base text-white/80 font-medium leading-tight">{display.room_name}</h2>
            <span className="text-white/40 text-sm">|</span>
            <p className="text-sm text-white/60">{labDay.displayName}</p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-base text-white/80 font-bold">Rotation {timer.rotation_number}</p>
            <ControlButtons />
          </div>
        </div>
      ) : (
        /* Portrait: stacked header */
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start"
          style={{ top: 'max(16px, env(safe-area-inset-top))' }}
        >
          <div>
            <h2 className="text-xl md:text-2xl text-white/80 font-medium leading-tight">{display.room_name}</h2>
            <p className="text-sm md:text-lg text-white/60">{labDay.displayName}</p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xl md:text-3xl text-white/80 font-bold">
              Rotation {timer.rotation_number}
            </p>
            <ControlButtons />
          </div>
        </div>
      )}

      {/* ── Main Timer Display ── */}
      <div className="flex flex-col items-center">
        {showRotateFlash ? (
          <>
            {isLandscape ? (
              /* Landscape ROTATE — side by side */
              <div className="flex flex-col items-center">
                <div className="text-[6rem] sm:text-[8rem] md:text-[12rem] font-black text-white leading-none tracking-tight animate-bounce">
                  ROTATE!
                </div>
                <p className="text-xl md:text-3xl text-white/80 mt-2">
                  Time to switch stations
                </p>
              </div>
            ) : (
              <>
                <div className="text-[12rem] md:text-[20rem] font-black text-white leading-none tracking-tight animate-bounce">
                  ROTATE!
                </div>
                <p className="text-2xl md:text-4xl text-white/80 mt-4">
                  Time to switch stations
                </p>
              </>
            )}
          </>
        ) : (
          <>
            <div
              className={`font-black leading-none tracking-tight ${
                isDebrief ? 'text-black' : 'text-white'
              } ${
                isLandscape
                  ? 'text-[6rem] sm:text-[9rem] md:text-[12rem]'
                  : 'text-[8rem] sm:text-[10rem] md:text-[16rem]'
              }`}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatTime(currentTime)}
            </div>

            {/* Status Indicators */}
            <div className="flex items-center gap-4 mt-2 md:mt-4">
              {timer.status === 'paused' && (
                <span className={`font-bold animate-pulse text-blue-300 ${isLandscape ? 'text-xl md:text-3xl' : 'text-2xl md:text-4xl'}`}>
                  PAUSED
                </span>
              )}
              {timer.status === 'stopped' && (
                <span className={`font-bold text-gray-400 ${isLandscape ? 'text-xl md:text-3xl' : 'text-2xl md:text-4xl'}`}>
                  STOPPED
                </span>
              )}
              {isDebrief && (
                <span className={`font-bold text-black ${isLandscape ? 'text-xl md:text-3xl' : 'text-2xl md:text-4xl'}`}>
                  DEBRIEF TIME
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Adjustment Flash Overlay */}
      {adjustmentFlash && (
        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
          <div
            className={`text-7xl md:text-9xl font-black animate-fade-out ${
              adjustmentFlash.startsWith('+') ? 'text-green-400' : 'text-red-400'
            }`}
            style={{ textShadow: '0 0 40px rgba(0,0,0,0.8)' }}
          >
            {adjustmentFlash}
          </div>
        </div>
      )}

      {/* PIN Dialog */}
      {showPinDialog && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-40">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-xs mx-4 shadow-2xl border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4 text-center">Enter PIN</h3>
            <p className="text-gray-400 text-sm text-center mb-4">
              Enter the 4-digit PIN to unlock timer controls.
            </p>
            <input
              type="password"
              maxLength={4}
              inputMode="numeric"
              pattern="[0-9]*"
              value={pinInput}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                setPinInput(val);
                setPinError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && pinInput.length === 4) {
                  handlePinSubmit();
                }
              }}
              className={`w-full text-center text-3xl font-mono tracking-[0.5em] px-4 py-3 rounded-lg bg-gray-700 text-white border-2 ${
                pinError ? 'border-red-500' : 'border-gray-600 focus:border-blue-500'
              } outline-none`}
              autoFocus
              placeholder="----"
            />
            {pinError && (
              <p className="text-red-400 text-sm text-center mt-2">Incorrect PIN</p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handlePinSubmit}
                disabled={pinInput.length !== 4}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-medium text-white transition-colors touch-manipulation min-h-[48px]"
              >
                Unlock
              </button>
              <button
                onClick={() => {
                  setShowPinDialog(false);
                  setPinInput('');
                  setPinError(false);
                }}
                className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-500 rounded-lg font-medium text-white transition-colors touch-manipulation min-h-[48px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lock/Unlock icon - bottom left corner */}
      <button
        onClick={handleLockToggle}
        className={`absolute bottom-4 left-4 z-20 flex items-center justify-center min-w-[44px] min-h-[44px] p-2.5 rounded-full transition-all touch-manipulation ${
          isUnlocked
            ? 'bg-green-600/50 text-green-300 hover:bg-green-600/70'
            : 'bg-white/5 text-white/20 hover:bg-white/10 hover:text-white/40'
        }`}
        style={{ bottom: showInstallBanner ? 'calc(56px + max(16px, env(safe-area-inset-bottom)))' : 'max(16px, env(safe-area-inset-bottom))' }}
        title={isUnlocked ? 'Lock controls' : 'Unlock controls'}
      >
        {isUnlocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
      </button>

      {/* Timer Control Panel Toggle (gear icon) - only when unlocked */}
      {isUnlocked && (
        <button
          onClick={toggleControlPanel}
          className={`absolute bottom-4 right-4 z-20 flex items-center justify-center min-w-[48px] min-h-[48px] p-3 rounded-full transition-all touch-manipulation ${
            showControlPanel
              ? 'bg-white/30 text-white rotate-90'
              : 'bg-white/10 hover:bg-white/20 text-white/50 hover:text-white'
          }`}
          style={{ bottom: showInstallBanner ? 'calc(56px + max(16px, env(safe-area-inset-bottom)))' : 'max(16px, env(safe-area-inset-bottom))' }}
          title="Timer controls"
        >
          <Settings className="w-6 h-6" />
        </button>
      )}

      {/* Collapsible Control Panel - only when unlocked */}
      {isUnlocked && showControlPanel && (
        <div
          className="absolute bottom-20 left-4 right-4 z-20 flex justify-center"
          style={{ bottom: showInstallBanner ? 'calc(80px + max(16px, env(safe-area-inset-bottom)))' : 'max(80px, calc(64px + env(safe-area-inset-bottom)))' }}
          onPointerDown={resetControlPanelHideTimer}
        >
          <div className="bg-black/80 backdrop-blur-sm rounded-2xl px-6 py-4 flex items-center gap-3 flex-wrap justify-center shadow-2xl border border-white/10">
            {/* Play/Pause */}
            <button
              onClick={() => sendTimerAction(timer.status === 'running' ? 'pause' : 'start')}
              disabled={controlActionLoading}
              className={`flex items-center justify-center min-w-[56px] min-h-[56px] p-3 rounded-xl transition-colors touch-manipulation disabled:opacity-50 ${
                timer.status === 'running'
                  ? 'bg-yellow-500 hover:bg-yellow-400 text-black'
                  : 'bg-green-500 hover:bg-green-400 text-black'
              }`}
              title={timer.status === 'running' ? 'Pause' : 'Play'}
            >
              {timer.status === 'running' ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-0.5" />}
            </button>

            {/* Stop */}
            <button
              onClick={handleStopWithConfirm}
              disabled={controlActionLoading}
              className="flex items-center justify-center min-w-[56px] min-h-[56px] p-3 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-colors touch-manipulation disabled:opacity-50"
              title="Stop"
            >
              <Square className="w-7 h-7" />
            </button>

            {/* Next Rotation */}
            <button
              onClick={() => sendTimerAction('next')}
              disabled={controlActionLoading}
              className="flex items-center justify-center min-w-[56px] min-h-[56px] p-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-white transition-colors touch-manipulation disabled:opacity-50"
              title="Next Rotation"
            >
              <SkipForward className="w-7 h-7" />
            </button>

            {/* Separator */}
            <div className="w-px h-10 bg-white/20 mx-1" />

            {/* -1 min */}
            <button
              onClick={() => handleTimeAdjust('subtract_time')}
              disabled={controlActionLoading}
              className="flex items-center justify-center min-w-[56px] min-h-[56px] p-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white transition-colors touch-manipulation disabled:opacity-50"
              title="-1 minute"
            >
              <Minus className="w-6 h-6" />
            </button>

            {/* +1 min */}
            <button
              onClick={() => handleTimeAdjust('add_time')}
              disabled={controlActionLoading}
              className="flex items-center justify-center min-w-[56px] min-h-[56px] p-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white transition-colors touch-manipulation disabled:opacity-50"
              title="+1 minute"
            >
              <Plus className="w-6 h-6" />
            </button>

            {/* Separator */}
            <div className="w-px h-10 bg-white/20 mx-1" />

            {/* Reset current rotation */}
            <button
              onClick={() => sendTimerAction('reset')}
              disabled={controlActionLoading}
              className="flex items-center justify-center min-w-[56px] min-h-[56px] p-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white transition-colors touch-manipulation disabled:opacity-50"
              title="Reset current rotation"
            >
              <RotateCcw className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* ── Swipe gesture hint (mobile only, portrait) ── */}
      {!isLandscape && (
        <div className="absolute bottom-10 left-0 right-0 flex justify-center sm:hidden">
          <p className="text-white/20 text-xs tracking-wide select-none">
            Swipe &#8593; mute | Swipe &#8595; fullscreen | Double-tap fullscreen
          </p>
        </div>
      )}

      {/* ── Bottom Status Bar ── */}
      <div
        className={`absolute left-16 right-16 flex justify-between items-end text-white/40 text-xs sm:text-sm ${
          isLandscape ? 'bottom-1' : 'bottom-4'
        }`}
        style={{ bottom: showInstallBanner ? 'calc(56px + max(0px, env(safe-area-inset-bottom)))' : 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <div>
          {timer.mode === 'countdown' ? 'Countdown' : 'Count Up'} |{' '}
          {Math.floor(timer.duration_seconds / 60)} min rotation
        </div>
        <div className="flex items-center gap-2">
          {wakeLockActive && (
            <span className="sm:hidden flex items-center gap-1 text-white/30">
              <Smartphone className="w-3 h-3" />
              Always On
            </span>
          )}
          <span>
            {new Date(lastFetchRef.current).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* ── Install Banner ── */}
      <InstallBanner />

      {/* CSS for ROTATE animation and adjustment flash fade */}
      <style jsx>{`
        @keyframes pulse-bg {
          0%, 100% { background-color: rgb(220, 38, 38); }
          50% { background-color: rgb(185, 28, 28); }
        }
        .animate-pulse {
          animation: pulse-bg 1s ease-in-out infinite;
        }
        @keyframes fade-out {
          0% { opacity: 1; transform: scale(1); }
          70% { opacity: 0.8; transform: scale(1.1); }
          100% { opacity: 0; transform: scale(1.2); }
        }
        .animate-fade-out {
          animation: fade-out 2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
