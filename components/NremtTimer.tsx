'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, RotateCcw, SkipForward, Clock } from 'lucide-react';

// Time limits in minutes per station
const NREMT_TIME_LIMITS: Record<string, number> = {
  'Cardiac Arrest Management / AED': 15,
  'Patient Assessment - Medical': 15,
  'Patient Assessment - Trauma': 10,
  'Spinal Immobilization (Supine Patient)': 10,
  'BVM Ventilation of an Apneic Adult Patient': 15,
  'Oxygen Administration by Non-Rebreather Mask': 15,
  'Bleeding Control/Shock Management': 10,
};
const DEFAULT_TIME_LIMIT = 15;

// Dual station phases (seconds)
export const DUAL_PHASES = [
  { name: 'O2 Prep', seconds: 2 * 60 },
  { name: 'O2 Evaluation', seconds: 5 * 60 },
  { name: 'BVM Prep', seconds: 2 * 60 },
  { name: 'BVM Evaluation', seconds: 5 * 60 },
];

export function isDualStation(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes('bvm') || lower.includes('oxygen');
}

function getTimeLimit(name: string): number {
  if (!name) return DEFAULT_TIME_LIMIT;
  const lower = name.toLowerCase();
  for (const [key, mins] of Object.entries(NREMT_TIME_LIMITS)) {
    if (key.toLowerCase() === lower) return mins;
  }
  for (const [key, mins] of Object.entries(NREMT_TIME_LIMITS)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return mins;
  }
  for (const [key, mins] of Object.entries(NREMT_TIME_LIMITS)) {
    const keyWords = key.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const matchCount = keyWords.filter(w => lower.includes(w)).length;
    if (matchCount >= 2) return mins;
  }
  return DEFAULT_TIME_LIMIT;
}

function formatMmSs(totalSeconds: number): string {
  const mins = Math.floor(Math.max(0, totalSeconds) / 60);
  const secs = Math.max(0, totalSeconds) % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Web Audio API beep
function playBeep(frequency: number = 880, durationMs: number = 200, count: number = 1) {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    let startTime = ctx.currentTime;
    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = frequency;
      osc.type = 'sine';
      gain.gain.value = 0.3;
      osc.start(startTime);
      osc.stop(startTime + durationMs / 1000);
      startTime += (durationMs + 100) / 1000;
    }
  } catch {
    // Audio not available
  }
}

type TimerStatus = 'ready' | 'running' | 'expired';

interface NremtTimerProps {
  stationName: string;
  instructionsRead: boolean;
  /** When true, renders as a fixed bottom bar instead of inline */
  stickyBottom?: boolean;
  /** Callback fired when the dual-station timer transitions to a new phase (0-based index) */
  onPhaseChange?: (phaseIndex: number, phaseName: string) => void;
}

export default function NremtTimer({ stationName, instructionsRead, stickyBottom = false, onPhaseChange }: NremtTimerProps) {
  const dual = isDualStation(stationName);

  // Standard timer state
  const [status, setStatus] = useState<TimerStatus>('ready');
  const [remaining, setRemaining] = useState(() => getTimeLimit(stationName) * 60);
  const totalSeconds = getTimeLimit(stationName) * 60;

  // Dual timer state
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [phaseRemaining, setPhaseRemaining] = useState(DUAL_PHASES[0].seconds);
  const [dualStatus, setDualStatus] = useState<TimerStatus>('ready');

  // Refs for intervals and alert tracking
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const oneMinAlertFired = useRef(false);
  const expiredAlertFired = useRef(false);
  const phaseAlertFired = useRef(false);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  // ─── Standard Timer Logic ───
  const startStandard = useCallback(() => {
    if (status !== 'ready') return;
    setStatus('running');
    oneMinAlertFired.current = false;
    expiredAlertFired.current = false;

    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        const next = prev - 1;
        // 1-minute warning
        if (next === 60 && !oneMinAlertFired.current) {
          oneMinAlertFired.current = true;
          playBeep(660, 300, 2);
        }
        // Expired
        if (next <= 0) {
          if (!expiredAlertFired.current) {
            expiredAlertFired.current = true;
            playBeep(440, 500, 3);
          }
          clearTimer();
          setStatus('expired');
          return 0;
        }
        return next;
      });
    }, 1000);
  }, [status, clearTimer]);

  const resetStandard = useCallback(() => {
    clearTimer();
    setStatus('ready');
    setRemaining(getTimeLimit(stationName) * 60);
    oneMinAlertFired.current = false;
    expiredAlertFired.current = false;
  }, [clearTimer, stationName]);

  // ─── Dual Timer Logic ───
  const advancePhase = useCallback((currentPhase: number) => {
    const nextPhase = currentPhase + 1;
    if (nextPhase >= DUAL_PHASES.length) {
      // All phases done
      clearTimer();
      setDualStatus('expired');
      playBeep(440, 500, 3);
      return;
    }
    setPhaseIndex(nextPhase);
    setPhaseRemaining(DUAL_PHASES[nextPhase].seconds);
    phaseAlertFired.current = false;
    playBeep(880, 200, 2);
  }, [clearTimer]);

  // Ref to keep latest onPhaseChange callback accessible inside intervals
  const onPhaseChangeRef = useRef(onPhaseChange);
  useEffect(() => { onPhaseChangeRef.current = onPhaseChange; }, [onPhaseChange]);

  const startDual = useCallback(() => {
    if (dualStatus !== 'ready') return;
    setDualStatus('running');
    phaseAlertFired.current = false;
    // Notify phase 0 started
    onPhaseChangeRef.current?.(0, DUAL_PHASES[0].name);

    intervalRef.current = setInterval(() => {
      setPhaseRemaining(prev => {
        const next = prev - 1;
        // 1-minute warning within phase
        if (next === 60 && !phaseAlertFired.current) {
          phaseAlertFired.current = true;
          playBeep(660, 300, 1);
        }
        if (next <= 0) {
          // Use functional approach: read phaseIndex via a ref-like pattern
          setPhaseIndex(currentPhase => {
            const nextPhase = currentPhase + 1;
            if (nextPhase >= DUAL_PHASES.length) {
              clearTimer();
              setDualStatus('expired');
              playBeep(440, 500, 3);
              return currentPhase;
            }
            phaseAlertFired.current = false;
            playBeep(880, 200, 2);
            setPhaseRemaining(DUAL_PHASES[nextPhase].seconds);
            // Notify parent of phase change
            onPhaseChangeRef.current?.(nextPhase, DUAL_PHASES[nextPhase].name);
            return nextPhase;
          });
          return 0;
        }
        return next;
      });
    }, 1000);
  }, [dualStatus, clearTimer]);

  const resetDual = useCallback(() => {
    clearTimer();
    setDualStatus('ready');
    setPhaseIndex(0);
    setPhaseRemaining(DUAL_PHASES[0].seconds);
    phaseAlertFired.current = false;
  }, [clearTimer]);

  const manualAdvance = useCallback(() => {
    if (dualStatus !== 'running') return;
    // Stop current interval, advance, then restart
    clearTimer();
    const nextIdx = phaseIndex + 1;
    if (nextIdx >= DUAL_PHASES.length) {
      setDualStatus('expired');
      playBeep(440, 500, 3);
      return;
    }
    setPhaseIndex(nextIdx);
    setPhaseRemaining(DUAL_PHASES[nextIdx].seconds);
    phaseAlertFired.current = false;
    playBeep(880, 200, 1);
    // Notify parent of manual phase advance
    onPhaseChangeRef.current?.(nextIdx, DUAL_PHASES[nextIdx].name);

    // Restart interval
    intervalRef.current = setInterval(() => {
      setPhaseRemaining(prev => {
        const next = prev - 1;
        if (next === 60 && !phaseAlertFired.current) {
          phaseAlertFired.current = true;
          playBeep(660, 300, 1);
        }
        if (next <= 0) {
          setPhaseIndex(currentPhase => {
            const np = currentPhase + 1;
            if (np >= DUAL_PHASES.length) {
              clearTimer();
              setDualStatus('expired');
              playBeep(440, 500, 3);
              return currentPhase;
            }
            phaseAlertFired.current = false;
            playBeep(880, 200, 2);
            setPhaseRemaining(DUAL_PHASES[np].seconds);
            // Notify parent of phase change
            onPhaseChangeRef.current?.(np, DUAL_PHASES[np].name);
            return np;
          });
          return 0;
        }
        return next;
      });
    }, 1000);
  }, [dualStatus, phaseIndex, clearTimer]);

  // ─── Color helpers ───
  function getBarColor(secondsLeft: number, total: number, isRunning: boolean): string {
    if (!isRunning) return 'bg-gray-300 dark:bg-gray-600';
    if (secondsLeft <= 30) return 'bg-red-500';
    if (secondsLeft <= 120) return 'bg-yellow-500';
    return 'bg-green-500';
  }

  function getTextColor(secondsLeft: number, isRunning: boolean): string {
    if (!isRunning) return 'text-gray-600 dark:text-gray-300';
    if (secondsLeft <= 30) return 'text-red-600 dark:text-red-400';
    if (secondsLeft <= 120) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  }

  // ─── Render Dual Timer ───
  if (dual) {
    const isRunning = dualStatus === 'running';
    const isExpired = dualStatus === 'expired';
    const currentPhase = DUAL_PHASES[phaseIndex];
    const phaseTotalSeconds = currentPhase?.seconds ?? 0;
    const progress = phaseTotalSeconds > 0 ? ((phaseTotalSeconds - phaseRemaining) / phaseTotalSeconds) * 100 : 100;

    if (stickyBottom) {
      const bgColor = isExpired ? 'bg-red-900' : isRunning ? (phaseRemaining <= 30 ? 'bg-red-800' : phaseRemaining <= 120 ? 'bg-yellow-700' : 'bg-gray-900') : 'bg-gray-900';
      return (
        <div className={`fixed bottom-0 left-0 right-0 z-50 ${bgColor} text-white shadow-lg ${isExpired ? 'animate-pulse' : ''}`}>
          {isRunning && (
            <div className="h-1 bg-black/20">
              <div
                className={`h-full transition-all duration-1000 ${isExpired ? 'bg-red-500' : getBarColor(phaseRemaining, phaseTotalSeconds, true)}`}
                style={{ width: `${isExpired ? 100 : progress}%` }}
              />
            </div>
          )}
          <div className="max-w-5xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Clock className="w-5 h-5 shrink-0 opacity-70" />
                <div className="truncate">
                  <span className="font-semibold text-sm truncate">{stationName}</span>
                  {isRunning && (
                    <span className="ml-2 text-xs opacity-70">
                      {currentPhase?.name} ({phaseIndex + 1}/{DUAL_PHASES.length})
                    </span>
                  )}
                </div>
              </div>
              <span className={`text-3xl font-mono font-bold tabular-nums shrink-0 ${isExpired ? 'text-red-300' : ''}`}>
                {isExpired ? 'TIME EXPIRED' : formatMmSs(phaseRemaining)}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {dualStatus === 'ready' && (
                  <button
                    onClick={startDual}
                    disabled={!instructionsRead}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                      instructionsRead
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <Play className="w-4 h-4" />
                    Start Timer
                  </button>
                )}
                {isRunning && (
                  <button
                    onClick={manualAdvance}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                  >
                    <SkipForward className="w-4 h-4" />
                    Next
                  </button>
                )}
                {(isRunning || isExpired) && (
                  <button
                    onClick={resetDual}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`rounded-lg shadow overflow-hidden ${isExpired ? 'animate-pulse ring-2 ring-red-500' : ''} bg-white dark:bg-gray-800`}>
        <div className="px-4 py-3 space-y-2">
          {/* Phase indicator dots */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">NREMT Dual Station Timer</span>
            </div>
            <div className="flex items-center gap-1.5">
              {DUAL_PHASES.map((phase, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full ${
                    i < phaseIndex ? 'bg-green-500' :
                    i === phaseIndex && isRunning ? 'bg-blue-500' :
                    i === phaseIndex && isExpired ? 'bg-red-500' :
                    'bg-gray-300 dark:bg-gray-600'
                  }`}
                  title={phase.name}
                />
              ))}
            </div>
          </div>

          {/* Current phase info */}
          <div className="flex items-center justify-between">
            <div>
              <span className={`text-lg font-bold ${isExpired ? 'text-red-600 dark:text-red-400' : getTextColor(phaseRemaining, isRunning)}`}>
                {isExpired ? 'TIME EXPIRED' : currentPhase?.name}
              </span>
              {!isExpired && isRunning && (
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  Phase {phaseIndex + 1} of {DUAL_PHASES.length}
                </span>
              )}
            </div>
            <span className={`text-2xl font-mono font-bold tabular-nums ${isExpired ? 'text-red-600 dark:text-red-400' : getTextColor(phaseRemaining, isRunning)}`}>
              {isExpired ? '00:00' : formatMmSs(phaseRemaining)}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${isExpired ? 'bg-red-500' : getBarColor(phaseRemaining, phaseTotalSeconds, isRunning)}`}
              style={{ width: `${isExpired ? 100 : progress}%` }}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 pt-1">
            {dualStatus === 'ready' && (
              <button
                onClick={startDual}
                disabled={!instructionsRead}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm min-h-[44px] transition-colors ${
                  instructionsRead
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
                title={!instructionsRead ? 'Read instructions to candidate first' : 'Start timer'}
              >
                <Play className="w-4 h-4" />
                Start Timer
              </button>
            )}
            {isRunning && (
              <button
                onClick={manualAdvance}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                <SkipForward className="w-4 h-4" />
                Next Phase
              </button>
            )}
            {(isRunning || isExpired) && (
              <button
                onClick={resetDual}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm min-h-[44px] bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            )}
            {!instructionsRead && dualStatus === 'ready' && (
              <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">
                Read instructions to candidate before starting
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Render Standard Timer ───
  const isRunning = status === 'running';
  const isExpired = status === 'expired';
  const progress = totalSeconds > 0 ? ((totalSeconds - remaining) / totalSeconds) * 100 : 100;

  if (stickyBottom) {
    const bgColor = isExpired ? 'bg-red-900' : isRunning ? (remaining <= 30 ? 'bg-red-800' : remaining <= 120 ? 'bg-yellow-700' : 'bg-gray-900') : 'bg-gray-900';
    return (
      <div className={`fixed bottom-0 left-0 right-0 z-50 ${bgColor} text-white shadow-lg ${isExpired ? 'animate-pulse' : ''}`}>
        {isRunning && (
          <div className="h-1 bg-black/20">
            <div
              className={`h-full transition-all duration-1000 ${isExpired ? 'bg-red-500' : getBarColor(remaining, totalSeconds, true)}`}
              style={{ width: `${isExpired ? 100 : progress}%` }}
            />
          </div>
        )}
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Clock className="w-5 h-5 shrink-0 opacity-70" />
              <span className="font-semibold text-sm truncate">{stationName}</span>
              <span className="text-xs opacity-50">({getTimeLimit(stationName)} min)</span>
            </div>
            <span className={`text-3xl font-mono font-bold tabular-nums shrink-0 ${isExpired ? 'text-red-300' : ''}`}>
              {isExpired ? 'TIME EXPIRED' : formatMmSs(remaining)}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              {status === 'ready' && (
                <button
                  onClick={startStandard}
                  disabled={!instructionsRead}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    instructionsRead
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Play className="w-4 h-4" />
                  Start Timer
                </button>
              )}
              {(isRunning || isExpired) && (
                <button
                  onClick={resetStandard}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
              )}
              {isExpired && (
                <span className="text-sm font-bold text-red-300 ml-1">EXPIRED</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg shadow overflow-hidden ${isExpired ? 'animate-pulse ring-2 ring-red-500' : ''} bg-white dark:bg-gray-800`}>
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              NREMT Station Timer
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              ({getTimeLimit(stationName)} min)
            </span>
          </div>
          <span className={`text-2xl font-mono font-bold tabular-nums ${isExpired ? 'text-red-600 dark:text-red-400' : getTextColor(remaining, isRunning)}`}>
            {formatMmSs(remaining)}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${isExpired ? 'bg-red-500' : getBarColor(remaining, totalSeconds, isRunning)}`}
            style={{ width: `${isExpired ? 100 : progress}%` }}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 pt-1">
          {status === 'ready' && (
            <button
              onClick={startStandard}
              disabled={!instructionsRead}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm min-h-[44px] transition-colors ${
                instructionsRead
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
              title={!instructionsRead ? 'Read instructions to candidate first' : 'Start timer'}
            >
              <Play className="w-4 h-4" />
              Start Timer
            </button>
          )}
          {(isRunning || isExpired) && (
            <button
              onClick={resetStandard}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm min-h-[44px] bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          )}
          {isExpired && (
            <span className="text-sm font-bold text-red-600 dark:text-red-400 ml-2">
              TIME EXPIRED
            </span>
          )}
          {!instructionsRead && status === 'ready' && (
            <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">
              Read instructions to candidate before starting
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
