'use client';

import { useEffect, useState, useCallback, useRef, use } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Maximize2, Minimize2, Volume2, VolumeX, Smartphone, LogOut, CheckCircle, Circle, Settings, Play, Pause, Square, SkipForward, Plus, Minus, RotateCcw } from 'lucide-react';
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

interface ReadyStatus {
  id: string;
  station_id: string;
  user_email: string;
  user_name: string;
  is_ready: boolean;
  station?: {
    id: string;
    station_number: number;
    station_type: string;
    room: string | null;
  };
}

interface Station {
  id: string;
  station_number: number;
  station_type: string;
  room: string | null;
}

export default function LiveTimerDisplayPage({ params }: { params: Promise<{ labDayId: string }> }) {
  const { labDayId } = use(params);
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [timer, setTimer] = useState<TimerState | null>(null);
  const [labDayTitle, setLabDayTitle] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [readyStatuses, setReadyStatuses] = useState<ReadyStatus[]>([]);
  const [allStations, setAllStations] = useState<Station[]>([]);
  const [showExitButton, setShowExitButton] = useState(true);
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [adjustmentFlash, setAdjustmentFlash] = useState<string | null>(null);
  const [controlActionLoading, setControlActionLoading] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const lastFetchRef = useRef<number>(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const hideExitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const controlPanelHideRef = useRef<NodeJS.Timeout | null>(null);
  const versionRef = useRef<number>(0);

  // Track which rotation's warnings have fired
  const hasPlayedRotationAlertRef = useRef<number | null>(null);
  const hasPlayedFiveMinRef = useRef<number | null>(null);
  const hasPlayedOneMinRef = useRef<number | null>(null);

  // Audio settings
  const [audioSettings, setAudioSettings] = useState<Partial<TimerAudioSettings>>(() =>
    loadTimerAudioSettings()
  );

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === TIMER_AUDIO_STORAGE_KEY) {
        setAudioSettings(loadTimerAudioSettings());
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const effectiveSettings: Partial<TimerAudioSettings> = {
    ...audioSettings,
    volume: soundEnabled ? audioSettings.volume : 0,
  };

  const { playFiveMinWarning, playOneMinWarning, playRotationAlert } = useTimerAudio(effectiveSettings);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push(`/api/auth/signin?callbackUrl=${encodeURIComponent(`/timer-display/live/${labDayId}`)}`);
    }
  }, [sessionStatus, router, labDayId]);

  // --- Wake Lock ---
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

  // --- Fullscreen ---
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

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // --- Auto-fullscreen on first interaction ---
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);
    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  // --- Keyboard: Escape to exit fullscreen ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Auto-hide exit button after 5s of no mouse movement ---
  useEffect(() => {
    const handleMouseMove = () => {
      setShowExitButton(true);
      if (hideExitTimerRef.current) clearTimeout(hideExitTimerRef.current);
      hideExitTimerRef.current = setTimeout(() => {
        setShowExitButton(false);
      }, 5000);
    };
    window.addEventListener('mousemove', handleMouseMove);
    handleMouseMove(); // Show initially
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (hideExitTimerRef.current) clearTimeout(hideExitTimerRef.current);
    };
  }, []);

  // --- Control Panel auto-hide after 10s of no interaction ---
  const resetControlPanelHideTimer = useCallback(() => {
    if (controlPanelHideRef.current) clearTimeout(controlPanelHideRef.current);
    controlPanelHideRef.current = setTimeout(() => {
      setShowControlPanel(false);
    }, 10000);
  }, []);

  const toggleControlPanel = useCallback(() => {
    setShowControlPanel(prev => {
      if (!prev) {
        // Opening: start auto-hide timer
        if (controlPanelHideRef.current) clearTimeout(controlPanelHideRef.current);
        controlPanelHideRef.current = setTimeout(() => {
          setShowControlPanel(false);
        }, 10000);
      } else {
        // Closing: clear auto-hide timer
        if (controlPanelHideRef.current) clearTimeout(controlPanelHideRef.current);
      }
      return !prev;
    });
  }, []);

  // Clean up control panel timer on unmount
  useEffect(() => {
    return () => {
      if (controlPanelHideRef.current) clearTimeout(controlPanelHideRef.current);
    };
  }, []);

  // --- Timer Control Actions ---
  const sendTimerAction = useCallback(async (action: string) => {
    setControlActionLoading(true);
    resetControlPanelHideTimer();
    try {
      const res = await fetch('/api/lab-management/timer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labDayId, action })
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
  }, [labDayId, resetControlPanelHideTimer]);

  const handleTimeAdjust = useCallback(async (action: 'add_time' | 'subtract_time') => {
    setControlActionLoading(true);
    resetControlPanelHideTimer();
    try {
      const res = await fetch('/api/lab-management/timer/adjust', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lab_day_id: labDayId, action, seconds: 60 })
      });
      const data = await res.json();
      if (data.success) {
        setTimer(data.timer);
        // Show adjustment flash
        if (data.adjustment_applied || true) {
          const flashText = action === 'add_time' ? '+1:00' : '-1:00';
          setAdjustmentFlash(flashText);
          setTimeout(() => setAdjustmentFlash(null), 2000);
        }
      }
    } catch (err) {
      console.error('Error adjusting timer:', err);
    } finally {
      setControlActionLoading(false);
    }
  }, [labDayId, resetControlPanelHideTimer]);

  const handleStopWithConfirm = useCallback(() => {
    resetControlPanelHideTimer();
    if (window.confirm('Stop the timer? This will halt the current rotation.')) {
      sendTimerAction('stop');
    }
  }, [sendTimerAction, resetControlPanelHideTimer]);

  // --- Timer Polling with version tracking ---
  const fetchTimerStatus = useCallback(async () => {
    try {
      const url = versionRef.current > 0
        ? `/api/lab-management/timer?labDayId=${labDayId}&version=${versionRef.current}`
        : `/api/lab-management/timer?labDayId=${labDayId}`;
      const res = await fetch(url);
      if (res.status === 401) {
        setSessionExpired(true);
        return;
      }
      const data = await res.json();

      // If not modified, skip state update to save re-renders
      if (data.not_modified) {
        lastFetchRef.current = Date.now();
        return;
      }

      if (!data.success) {
        setError(data.error || 'Failed to fetch timer status');
        return;
      }

      if (data.version !== undefined) {
        versionRef.current = data.version;
      }

      if (data.timer) {
        setTimer(data.timer);

        // Get lab day title from the joined data
        if (data.timer.lab_day) {
          const ld = data.timer.lab_day;
          setLabDayTitle(ld.title || new Date(ld.date).toLocaleDateString());
        }
      } else {
        setTimer(null);
      }
      setError(null);

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
  }, [labDayId]);

  // Fetch ready statuses
  const fetchReadyStatuses = useCallback(async () => {
    try {
      const res = await fetch(`/api/lab-management/timer/ready?labDayId=${labDayId}`);
      if (res.status === 401) {
        setSessionExpired(true);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setReadyStatuses(data.readyStatuses || []);
        setAllStations(data.allStations || []);
      }
    } catch (err) {
      console.error('Error fetching ready statuses:', err);
    }
  }, [labDayId]);

  // Adaptive poll interval based on timer state
  const getTimerPollInterval = (): number | null => {
    if (sessionExpired) return null;       // Stop polling on session expiry
    if (!timer) return 10000;              // No timer yet, 10s (detect start quickly)
    if (timer.status === 'stopped') return 10000; // Stopped, 10s
    if (timer.status === 'paused') return 10000;  // Paused, 10s
    return 5000;                           // Running, 5s
  };
  useVisibilityPolling(fetchTimerStatus, getTimerPollInterval());

  // Ready statuses only need polling when timer is actively running
  const readyPollInterval = sessionExpired ? null : (timer?.status === 'running' ? 5000 : null);
  useVisibilityPolling(fetchReadyStatuses, readyPollInterval);

  // --- Timer Display Calculation ---
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

    if (timer.status === 'running') {
      let interval: NodeJS.Timeout | null = setInterval(() => {
        const t = calculateTime();
        setCurrentTime(t);

        if (timer.mode === 'countdown') {
          if (t <= 0 && hasPlayedRotationAlertRef.current !== timer.rotation_number) {
            hasPlayedRotationAlertRef.current = timer.rotation_number;
            playRotationAlert();
          }
          if (t > 0 && t <= 300 && hasPlayedFiveMinRef.current !== timer.rotation_number) {
            hasPlayedFiveMinRef.current = timer.rotation_number;
            playFiveMinWarning();
          }
          if (t > 0 && t <= 60 && hasPlayedOneMinRef.current !== timer.rotation_number) {
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
          setCurrentTime(calculateTime());
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

  // Reset warning trackers when rotation changes
  useEffect(() => {
    if (timer?.rotation_number !== undefined) {
      const rot = timer.rotation_number;
      if (hasPlayedRotationAlertRef.current !== null && hasPlayedRotationAlertRef.current !== rot) {
        hasPlayedRotationAlertRef.current = null;
      }
      if (hasPlayedFiveMinRef.current !== null && hasPlayedFiveMinRef.current !== rot) {
        hasPlayedFiveMinRef.current = null;
      }
      if (hasPlayedOneMinRef.current !== null && hasPlayedOneMinRef.current !== rot) {
        hasPlayedOneMinRef.current = null;
      }
    }
  }, [timer?.rotation_number]);

  // --- Derived State ---
  const isTimeUp = timer?.mode === 'countdown' && currentTime <= 0 && timer?.status === 'running';
  const needsRotation = timer ? !timer.rotation_acknowledged : false;
  const showRotateFlash = isTimeUp || (needsRotation && timer?.status === 'running' && currentTime <= 0);
  const isDebrief = timer?.mode === 'countdown' && currentTime > 0 && currentTime <= (timer?.debrief_seconds || 300) && timer?.status === 'running';

  // Color transitions based on time remaining percentage
  const getTimeColorClass = () => {
    if (!timer || timer.status === 'stopped') return 'text-white';
    if (timer.status === 'paused') return 'text-blue-300';
    if (isDebrief) return 'text-black';
    if (timer.mode === 'countdown') {
      const pctRemaining = currentTime / timer.duration_seconds;
      if (pctRemaining > 0.5) return 'text-green-400';
      if (pctRemaining > 0.25) return 'text-yellow-400';
      return 'text-red-400';
    }
    return 'text-white';
  };

  // Background color based on state
  const getBackgroundClass = () => {
    if (showRotateFlash) return 'bg-red-600 animate-pulse';
    if (isDebrief) return 'bg-yellow-600';
    if (timer?.status === 'paused') return 'bg-blue-900';
    if (timer?.mode === 'countdown' && timer?.status === 'running') {
      const pctRemaining = currentTime / timer.duration_seconds;
      if (pctRemaining <= 0.25) return 'bg-red-900/50';
      if (pctRemaining <= 0.5) return 'bg-yellow-900/30';
    }
    return 'bg-black';
  };

  // Progress bar percentage
  const getProgress = () => {
    if (!timer) return 0;
    if (timer.mode === 'countdown') {
      return ((timer.duration_seconds - currentTime) / timer.duration_seconds) * 100;
    }
    return (currentTime / timer.duration_seconds) * 100;
  };

  // Station ready info
  const readyCount = readyStatuses.filter(s => s.is_ready).length;
  const totalStationCount = allStations.length;

  const getStationStatus = (station: Station) => {
    return readyStatuses.find(s => s.station_id === station.id);
  };

  // --- Auth loading / redirecting ---
  if (sessionStatus === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-pulse text-white text-4xl">Loading...</div>
      </div>
    );
  }

  if (sessionStatus === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-2xl">Redirecting to login...</div>
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4">
        <div className="text-4xl mb-4">!</div>
        <h1 className="text-2xl font-bold mb-2">Timer Display Error</h1>
        <p className="text-gray-400 text-center">{error}</p>
        <button
          onClick={() => window.close()}
          className="mt-6 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  // --- No active timer ---
  if (!timer) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-4 relative">
        <h1 className="text-4xl md:text-6xl font-bold mb-4 text-center">Live Timer Display</h1>
        <p className="text-2xl md:text-4xl text-gray-400">No Active Timer</p>
        <p className="text-lg text-gray-600 mt-4">Waiting for lab session to start...</p>
        {labDayTitle && (
          <p className="text-sm text-gray-500 mt-2">{labDayTitle}</p>
        )}
        {/* Controls */}
        <div className={`absolute top-4 right-4 flex items-center gap-2 transition-opacity duration-300 ${showExitButton ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={() => setSoundEnabled(v => !v)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
            title={soundEnabled ? 'Mute' : 'Unmute'}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          <button
            onClick={() => window.close()}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
            title="Close"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // --- Main Display ---
  const progress = getProgress();

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center transition-colors duration-500 relative overflow-hidden ${getBackgroundClass()}`}
      style={{
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
      }}
    >
      {/* Top controls - auto-hide */}
      <div
        className={`absolute top-4 right-4 z-20 flex items-center gap-2 transition-opacity duration-300 ${showExitButton ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ top: 'max(16px, env(safe-area-inset-top))' }}
      >
        {wakeLockActive && (
          <span className="hidden sm:flex items-center gap-1 text-xs text-white/40 px-2 py-1 rounded bg-white/5">
            <Smartphone className="w-3 h-3" />
            Always On
          </span>
        )}
        <button
          onClick={() => setSoundEnabled(v => !v)}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors touch-manipulation"
          title={soundEnabled ? 'Mute' : 'Unmute'}
        >
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>
        <button
          onClick={toggleFullscreen}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors touch-manipulation"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
        <button
          onClick={() => window.close()}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors touch-manipulation"
          title="Close display"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Top left: rotation info */}
      <div
        className={`absolute top-4 left-4 z-10 transition-opacity duration-300 ${showExitButton ? 'opacity-100' : 'opacity-70'}`}
        style={{ top: 'max(16px, env(safe-area-inset-top))' }}
      >
        <p className="text-xl md:text-3xl text-white/80 font-bold">
          Rotation {timer.rotation_number}
        </p>
        {labDayTitle && (
          <p className="text-sm md:text-base text-white/50 mt-1">{labDayTitle}</p>
        )}
      </div>

      {/* Main Timer Area */}
      <div className="flex flex-col items-center justify-center flex-1 w-full">
        {showRotateFlash ? (
          <div className="flex flex-col items-center">
            <div className="text-[8rem] sm:text-[10rem] md:text-[14rem] lg:text-[18rem] font-black text-white leading-none tracking-tight animate-bounce">
              ROTATE!
            </div>
            <p className="text-2xl md:text-4xl text-white/80 mt-4">
              Time to switch stations
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center w-full">
            {/* Large countdown time */}
            <div
              className={`font-black leading-none tracking-tight transition-colors duration-500 ${getTimeColorClass()} text-[7rem] sm:text-[9rem] md:text-[13rem] lg:text-[17rem]`}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatTime(currentTime)}
            </div>

            {/* Status */}
            <div className="flex items-center gap-4 mt-2 md:mt-4">
              {timer.status === 'paused' && (
                <span className="text-2xl md:text-4xl font-bold animate-pulse text-blue-300">
                  PAUSED
                </span>
              )}
              {timer.status === 'stopped' && (
                <span className="text-2xl md:text-4xl font-bold text-gray-400">
                  STOPPED
                </span>
              )}
              {isDebrief && (
                <span className="text-2xl md:text-4xl font-bold text-black">
                  DEBRIEF TIME
                </span>
              )}
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-3xl mt-6 md:mt-8 px-8">
              <div className="h-3 md:h-4 bg-gray-700/50 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 rounded-full ${
                    progress > 90 ? 'bg-red-500' :
                    progress > 75 ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Station Ready Status Grid - bottom area */}
      {totalStationCount > 0 && (
        <div className="absolute bottom-16 left-4 right-4 z-10"
          style={{ bottom: 'max(56px, env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {allStations.map(station => {
              const status = getStationStatus(station);
              const isReady = status?.is_ready;
              return (
                <div
                  key={station.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isReady
                      ? 'bg-green-900/60 text-green-400 border border-green-700/50'
                      : 'bg-red-900/40 text-red-400 border border-red-700/30'
                  }`}
                  title={isReady ? `Station ${station.station_number} ready - ${status?.user_name || status?.user_email}` : `Station ${station.station_number} not ready`}
                >
                  {isReady ? (
                    <CheckCircle className="w-3.5 h-3.5" />
                  ) : (
                    <Circle className="w-3.5 h-3.5" />
                  )}
                  <span>#{station.station_number}</span>
                </div>
              );
            })}
            <span className={`ml-2 px-3 py-1.5 rounded-full text-xs font-medium ${
              readyCount === totalStationCount && totalStationCount > 0
                ? 'bg-green-600 text-white'
                : 'bg-yellow-600/80 text-white'
            }`}>
              {readyCount}/{totalStationCount} ready
            </span>
          </div>
        </div>
      )}

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

      {/* Timer Control Panel Toggle (gear icon) */}
      <button
        onClick={toggleControlPanel}
        className={`absolute bottom-4 right-4 z-20 flex items-center justify-center min-w-[48px] min-h-[48px] p-3 rounded-full transition-all touch-manipulation ${
          showControlPanel
            ? 'bg-white/30 text-white rotate-90'
            : 'bg-white/10 hover:bg-white/20 text-white/50 hover:text-white'
        }`}
        style={{ bottom: 'max(16px, env(safe-area-inset-bottom))' }}
        title="Timer controls"
      >
        <Settings className="w-6 h-6" />
      </button>

      {/* Collapsible Control Panel */}
      {showControlPanel && (
        <div
          className="absolute bottom-20 left-4 right-4 z-20 flex justify-center"
          style={{ bottom: 'max(80px, calc(64px + env(safe-area-inset-bottom)))' }}
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

      {/* Bottom status bar */}
      <div
        className="absolute left-4 bottom-4 text-white/40 text-xs sm:text-sm"
        style={{ bottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <div>
          {timer.mode === 'countdown' ? 'Countdown' : 'Count Up'} |{' '}
          {Math.floor(timer.duration_seconds / 60)} min rotation
        </div>
      </div>

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
