'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, Pause, Play, ExternalLink } from 'lucide-react';
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
}

interface InlineTimerWidgetProps {
  labDayId: string;
  onOpenFullTimer: () => void;
}

export default function InlineTimerWidget({ labDayId, onOpenFullTimer }: InlineTimerWidgetProps) {
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch timer state for this lab day
  const fetchTimerState = useCallback(async () => {
    try {
      const res = await fetch(`/api/lab-management/timer?labDayId=${labDayId}`);
      const data = await res.json();
      if (data.success) {
        setTimerState(data.timer || null);
        if (data.serverTime) {
          const serverTime = new Date(data.serverTime).getTime();
          setServerTimeOffset(serverTime - Date.now());
        }
      }
    } catch (error) {
      console.error('Error fetching timer state:', error);
    }
  }, [labDayId]);

  // Poll every 5 seconds to keep widget in sync
  useVisibilityPolling(fetchTimerState, 5000);

  // Calculate display time
  useEffect(() => {
    if (!timerState) {
      setDisplaySeconds(0);
      return;
    }

    const calculateTime = () => {
      if (timerState.status === 'stopped') {
        return timerState.mode === 'countdown' ? timerState.duration_seconds : 0;
      }
      if (timerState.status === 'paused') {
        return timerState.mode === 'countdown'
          ? timerState.duration_seconds - timerState.elapsed_when_paused
          : timerState.elapsed_when_paused;
      }
      // Running
      if (timerState.started_at) {
        const now = Date.now() + serverTimeOffset;
        const startTime = new Date(timerState.started_at).getTime();
        const elapsed = Math.floor((now - startTime) / 1000);
        if (timerState.mode === 'countdown') {
          return Math.max(0, timerState.duration_seconds - elapsed);
        }
        return elapsed;
      }
      return 0;
    };

    setDisplaySeconds(calculateTime());

    if (timerState.status !== 'running') return;

    let interval: NodeJS.Timeout | null = setInterval(() => {
      setDisplaySeconds(calculateTime());
    }, 1000);

    const handleVisibility = () => {
      if (document.hidden) {
        if (interval) { clearInterval(interval); interval = null; }
      } else {
        setDisplaySeconds(calculateTime());
        interval = setInterval(() => setDisplaySeconds(calculateTime()), 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [timerState, serverTimeOffset]);

  // Format MM:SS
  const formatTime = (seconds: number): string => {
    const absSeconds = Math.abs(seconds);
    const hrs = Math.floor(absSeconds / 3600);
    const mins = Math.floor((absSeconds % 3600) / 60);
    const secs = absSeconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Send action (pause/resume)
  const sendAction = useCallback(async (action: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/lab-management/timer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labDayId, action })
      });
      const data = await res.json();
      if (data.success) {
        setTimerState(data.timer);
      }
    } catch (error) {
      console.error('Error sending timer action:', error);
    } finally {
      setActionLoading(false);
    }
  }, [labDayId]);

  // Don't show widget if no timer exists or it's stopped
  if (!timerState || timerState.status === 'stopped') {
    return null;
  }

  const isRunning = timerState.status === 'running';
  const isPaused = timerState.status === 'paused';
  const isTimeUp = timerState.mode === 'countdown' && displaySeconds <= 0;
  const isDebrief = timerState.mode === 'countdown' &&
    displaySeconds > 0 &&
    displaySeconds <= (timerState.debrief_seconds || 300);

  // Color coding
  const getBgColor = () => {
    if (isTimeUp) return 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700';
    if (isDebrief) return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700';
    if (isPaused) return 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700';
    return 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700';
  };

  const getTimeColor = () => {
    if (isTimeUp) return 'text-red-700 dark:text-red-400';
    if (isDebrief) return 'text-yellow-700 dark:text-yellow-400';
    if (isPaused) return 'text-blue-700 dark:text-blue-400';
    return 'text-green-700 dark:text-green-400';
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border ${getBgColor()} print:hidden`}>
      <Timer className={`w-4 h-4 flex-shrink-0 ${getTimeColor()}`} />

      {/* Rotation info */}
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
        Rotation {timerState.rotation_number}
      </span>

      {/* Time display */}
      <span className={`text-lg font-mono font-bold tabular-nums ${getTimeColor()}`}>
        {isTimeUp ? 'TIME UP' : formatTime(displaySeconds)}
      </span>

      {/* Status badge */}
      {isPaused && (
        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
          Paused
        </span>
      )}
      {isDebrief && !isTimeUp && (
        <span className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wide">
          Debrief
        </span>
      )}

      {/* Pause/Resume button */}
      <button
        onClick={() => sendAction(isRunning ? 'pause' : 'start')}
        disabled={actionLoading}
        className={`p-1.5 rounded-md transition-colors disabled:opacity-50 ${
          isRunning
            ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
            : 'bg-green-500 hover:bg-green-600 text-white'
        }`}
        title={isRunning ? 'Pause timer' : 'Resume timer'}
      >
        {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
      </button>

      {/* Open full timer button */}
      <button
        onClick={onOpenFullTimer}
        className="p-1.5 rounded-md bg-gray-600 hover:bg-gray-700 text-white transition-colors"
        title="Open full timer"
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
