'use client';

import { useState, useCallback } from 'react';
import { Timer, Pause, Play, ExternalLink, Minus, Plus, SkipForward } from 'lucide-react';
import { useLabTimerState } from '@/hooks/useLabTimerState';
import type { LabTimerRow } from '@/lib/lab-timer-state';

interface InlineTimerWidgetProps {
  labDayId: string;
  onOpenFullTimer: () => void;
  /** When true, stops listening/refetching (e.g. when LabTimer modal is open) */
  paused?: boolean;
}

export default function InlineTimerWidget({ labDayId, onOpenFullTimer, paused = false }: InlineTimerWidgetProps) {
  const [actionLoading, setActionLoading] = useState(false);
  const [adjustFlash, setAdjustFlash] = useState<string | null>(null);

  // ONE owner of timer state (hooks/useLabTimerState): realtime + reconnect /
  // visibility re-fetch, no poll. Control responses go through applyTimer so
  // they obey the same version guard.
  const { timer: hookTimer, displaySeconds: hookSeconds, applyTimer } = useLabTimerState({
    url: `/api/lab-management/timer?labDayId=${labDayId}`,
    labDayId,
    enabled: !paused,
  });
  const timerState = hookTimer as LabTimerRow | null;
  // null = no trustworthy reading (e.g. running with no started_at): render
  // --:-- like the other surfaces instead of coercing to 0 (false TIME UP).
  const displaySeconds = hookSeconds;

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
        applyTimer(data.timer);
      }
    } catch (error) {
      console.error('Error sending timer action:', error);
    } finally {
      setActionLoading(false);
    }
  }, [labDayId, applyTimer]);

  // Time adjustment (±N seconds)
  const handleTimeAdjust = useCallback(async (action: 'add_time' | 'subtract_time', seconds: number = 60) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/lab-management/timer/adjust', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lab_day_id: labDayId, action, seconds })
      });
      const data = await res.json();
      if (data.success) {
        applyTimer(data.timer);
        const mins = Math.floor(seconds / 60);
        const flashText = action === 'add_time' ? `+${mins}m` : `-${mins}m`;
        setAdjustFlash(flashText);
        setTimeout(() => setAdjustFlash(null), 1500);
      }
    } catch (error) {
      console.error('Error adjusting timer:', error);
    } finally {
      setActionLoading(false);
    }
  }, [labDayId, applyTimer]);

  // Don't show widget if no timer exists or it's stopped
  if (!timerState || timerState.status === 'stopped') {
    return null;
  }

  const isRunning = timerState.status === 'running';
  const isPaused = timerState.status === 'paused';
  const isTimeUp = timerState.mode === 'countdown' && displaySeconds !== null && displaySeconds <= 0;
  const isDebrief = timerState.mode === 'countdown' &&
    displaySeconds !== null &&
    displaySeconds > 0 &&
    displaySeconds <= (timerState.debrief_seconds ?? 300);

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
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${getBgColor()} print:hidden relative`}>
      <Timer className={`w-4 h-4 flex-shrink-0 ${getTimeColor()}`} />

      {/* Rotation info */}
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
        R{timerState.rotation_number}
      </span>

      {/* Time display */}
      <span className={`text-lg font-mono font-bold tabular-nums ${getTimeColor()}`}>
        {isTimeUp ? 'TIME UP' : displaySeconds === null ? '--:--' : formatTime(displaySeconds)}
      </span>

      {/* Adjustment flash */}
      {adjustFlash && (
        <span className={`text-xs font-bold ${adjustFlash.startsWith('+') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} animate-pulse`}>
          {adjustFlash}
        </span>
      )}

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

      {/* Divider */}
      <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />

      {/* Play/Pause */}
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

      {/* -1 min */}
      <button
        onClick={() => handleTimeAdjust('subtract_time')}
        disabled={actionLoading}
        className="p-1.5 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50"
        title="-1 minute"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>

      {/* +1 min */}
      <button
        onClick={() => handleTimeAdjust('add_time')}
        disabled={actionLoading}
        className="p-1.5 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50"
        title="+1 minute"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      {/* Next Rotation */}
      <button
        onClick={() => sendAction('next')}
        disabled={actionLoading}
        className="p-1.5 rounded-md bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
        title="Next rotation"
      >
        <SkipForward className="w-3.5 h-3.5" />
      </button>

      {/* Open full timer button */}
      <button
        onClick={onOpenFullTimer}
        className="p-1.5 rounded-md bg-gray-500 hover:bg-gray-600 text-white transition-colors"
        title="Open full timer"
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
