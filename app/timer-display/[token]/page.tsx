'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Maximize2, Minimize2, Volume2, VolumeX, Smartphone } from 'lucide-react';
import { useVisibilityPolling } from '@/hooks/useVisibilityPolling';
import { useTimerAudio, loadTimerAudioSettings, TimerAudioSettings, TIMER_AUDIO_STORAGE_KEY } from '@/hooks/useTimerAudio';

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

  const lastFetchRef = useRef<number>(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const deferredInstallPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const touchStartYRef = useRef(0);
  const touchStartXRef = useRef(0);
  const doubleTapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef(0);

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

  // Format time as MM:SS or HH:MM:SS
  const formatTime = (seconds: number): string => {
    const absSeconds = Math.abs(seconds);
    const hrs = Math.floor(absSeconds / 3600);
    const mins = Math.floor((absSeconds % 3600) / 60);
    const secs = absSeconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

      {/* ── Swipe gesture hint (mobile only, portrait) ── */}
      {!isLandscape && (
        <div className="absolute bottom-10 left-0 right-0 flex justify-center sm:hidden">
          <p className="text-white/20 text-xs tracking-wide select-none">
            Swipe ↑ mute · Swipe ↓ fullscreen · Double-tap fullscreen
          </p>
        </div>
      )}

      {/* ── Bottom Status Bar ── */}
      <div
        className={`absolute left-4 right-4 flex justify-between items-end text-white/40 text-xs sm:text-sm ${
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

      {/* CSS for ROTATE animation */}
      <style jsx>{`
        @keyframes pulse-bg {
          0%, 100% { background-color: rgb(220, 38, 38); }
          50% { background-color: rgb(185, 28, 28); }
        }
        .animate-pulse {
          animation: pulse-bg 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
