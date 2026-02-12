'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';

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
  const lastFetchRef = useRef<number>(0);

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

  // Initial fetch and polling
  useEffect(() => {
    fetchTimerStatus();
    const interval = setInterval(fetchTimerStatus, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [fetchTimerStatus]);

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

    // Update every second when running
    if (timer.status === 'running') {
      const interval = setInterval(() => {
        setCurrentTime(calculateTime());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer, serverTimeOffset]);

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
        <div className="text-right">
          <p className="text-xl md:text-3xl text-white/80 font-bold">
            Rotation {timer.rotation_number}
          </p>
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
