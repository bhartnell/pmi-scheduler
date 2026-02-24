'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Maximize2, Minimize2, Volume2, VolumeX } from 'lucide-react';
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
  const lastFetchRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const hasPlayedChimeRef = useRef<number | null>(null); // track which rotation we played for

  // Play 3 short chime beeps when timer hits zero
  const playChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const beepCount = 3;
      for (let i = 0; i < beepCount; i++) {
        setTimeout(() => {
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(ctx.destination);
          oscillator.frequency.value = 880;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.6, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.4);
        }, i * 500);
      }
    } catch (e) {
      console.warn('Audio not available:', e);
    }
  }, [soundEnabled]);

  // Fullscreen toggle
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

  // Poll for timer status
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

  // Calculate current time display
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
        // Play chime when countdown hits zero (once per rotation)
        if (
          timer.mode === 'countdown' &&
          t <= 0 &&
          hasPlayedChimeRef.current !== timer.rotation_number
        ) {
          hasPlayedChimeRef.current = timer.rotation_number;
          playChime();
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
  }, [timer, serverTimeOffset, playChime]);

  // Reset chime tracker when rotation changes
  useEffect(() => {
    if (timer?.rotation_number !== undefined) {
      // Only reset if we're moving to a new rotation (not null → number)
      if (hasPlayedChimeRef.current !== null && hasPlayedChimeRef.current !== timer.rotation_number) {
        hasPlayedChimeRef.current = null;
      }
    }
  }, [timer?.rotation_number]);

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

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold mb-2">Timer Display Error</h1>
        <p className="text-gray-400 text-center">{error}</p>
        <p className="text-sm text-gray-600 mt-4">Token: {token}</p>
      </div>
    );
  }

  // Loading state
  if (!display) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-pulse text-white text-6xl">Loading...</div>
      </div>
    );
  }

  // No active timer
  if (!timer || !labDay) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-4">
        <h1 className="text-4xl md:text-6xl font-bold mb-4 text-center">{display.room_name}</h1>
        <p className="text-2xl md:text-4xl text-gray-400">No Active Timer</p>
        <p className="text-lg text-gray-600 mt-4">Waiting for lab session to start...</p>
        {/* Controls overlay - always visible */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(v => !v)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
            title={soundEnabled ? 'Mute sound' : 'Enable sound'}
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
        </div>
      </div>
    );
  }

  // Main display
  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center transition-colors duration-300 ${
        showRotateFlash
          ? 'animate-pulse bg-red-600'
          : isDebrief
          ? 'bg-yellow-600'
          : timer.status === 'paused'
          ? 'bg-blue-900'
          : 'bg-black'
      }`}
    >
      {/* Room/Lab Name */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
        <div>
          <h2 className="text-xl md:text-2xl text-white/80 font-medium">{display.room_name}</h2>
          <p className="text-sm md:text-lg text-white/60">{labDay.displayName}</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xl md:text-3xl text-white/80 font-bold">
            Rotation {timer.rotation_number}
          </p>
          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled(v => !v)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
            title={soundEnabled ? 'Mute chime' : 'Enable chime'}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Main Timer Display */}
      <div className="flex flex-col items-center">
        {showRotateFlash ? (
          <>
            <div className="text-[12rem] md:text-[20rem] font-black text-white leading-none tracking-tight animate-bounce">
              ROTATE!
            </div>
            <p className="text-2xl md:text-4xl text-white/80 mt-4">
              Time to switch stations
            </p>
          </>
        ) : (
          <>
            <div
              className={`text-[10rem] md:text-[16rem] font-black leading-none tracking-tight ${
                isDebrief ? 'text-black' : 'text-white'
              }`}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatTime(currentTime)}
            </div>

            {/* Status Indicators */}
            <div className="flex items-center gap-4 mt-4">
              {timer.status === 'paused' && (
                <span className="text-2xl md:text-4xl text-blue-300 font-bold animate-pulse">
                  PAUSED
                </span>
              )}
              {timer.status === 'stopped' && (
                <span className="text-2xl md:text-4xl text-gray-400 font-bold">
                  STOPPED
                </span>
              )}
              {isDebrief && (
                <span className="text-2xl md:text-4xl text-black font-bold">
                  DEBRIEF TIME
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Bottom Status */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end text-white/40 text-sm">
        <div>
          {timer.mode === 'countdown' ? 'Countdown' : 'Count Up'} |{' '}
          {Math.floor(timer.duration_seconds / 60)} min rotation
        </div>
        <div>
          Last update: {new Date(lastFetchRef.current).toLocaleTimeString()}
        </div>
      </div>

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
